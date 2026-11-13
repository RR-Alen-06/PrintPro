-- =========================================================================
-- ATOMIC BILLING & PAYMENT RPCs + FINANCIAL INTEGRITY CONSTRAINTS
-- =========================================================================

-- 1. Non-negative financial CHECK constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_customers_non_negative_balances') THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT chk_customers_non_negative_balances
      CHECK (advance_balance >= 0 AND loyalty_points >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_bills_non_negative_totals') THEN
    ALTER TABLE public.bills
      ADD CONSTRAINT chk_bills_non_negative_totals
      CHECK (
        total >= 0 AND discount >= 0 AND grand_total >= 0 AND
        cash_paid >= 0 AND upi_paid >= 0 AND paid_total >= 0 AND
        advance_used >= 0 AND advance_earned >= 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_positive_amount') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT chk_payments_positive_amount
      CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

-- 2. Server-side PIN verification RPC (SECURITY INVOKER, respects tenant RLS)
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_stored_pin TEXT;
BEGIN
  IF v_uid IS NULL OR p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(value->>'super_admin_pin', '1234')
    INTO v_stored_pin
    FROM public.settings
   WHERE key = 'security' AND user_id = v_uid
   LIMIT 1;

  IF v_stored_pin IS NULL THEN
    v_stored_pin := '1234';
  END IF;

  RETURN trim(p_pin) = trim(v_stored_pin);
END;
$$;

-- 3. Atomic Payment Recording RPC (locks customer row, records payment, allocates FIFO, updates advance)
CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_customer_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_bill_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_user_name TEXT DEFAULT 'Admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pay_number TEXT;
  v_pay_id UUID;
  v_unallocated NUMERIC := ROUND(COALESCE(p_amount, 0), 2);
  v_bill RECORD;
  v_due NUMERIC;
  v_alloc NUMERIC;
  v_new_paid NUMERIC;
  v_new_cash NUMERIC;
  v_new_upi NUMERIC;
  v_new_method TEXT;
  v_group_ids UUID[] := ARRAY[]::UUID[];
  v_gid UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF v_unallocated <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  -- Lock customer row for update
  PERFORM 1 FROM public.customers WHERE id = p_customer_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF p_bill_id IS NOT NULL THEN
    SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id AND user_id = v_uid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bill not found';
    END IF;
    IF v_bill.status IN ('CANCELLED', 'VOID') THEN
      RAISE EXCEPTION 'Cannot record payment against a cancelled or voided bill';
    END IF;
  END IF;

  v_pay_number := public.get_next_sequence('PAYMENT');

  INSERT INTO public.payments (
    user_id, payment_number, customer_id, bill_id, amount, payment_method, status, notes
  ) VALUES (
    v_uid, v_pay_number, p_customer_id, p_bill_id, v_unallocated, COALESCE(p_payment_method, 'Cash'), 'COMPLETED', p_notes
  ) RETURNING id INTO v_pay_id;

  -- Direct bill allocation first
  IF p_bill_id IS NOT NULL THEN
    v_due := GREATEST(0, COALESCE(v_bill.grand_total, 0) - COALESCE(v_bill.paid_total, 0));
    v_alloc := LEAST(v_due, v_unallocated);
    IF v_alloc > 0 THEN
      v_new_paid := ROUND(COALESCE(v_bill.paid_total, 0) + v_alloc, 2);
      v_new_cash := COALESCE(v_bill.cash_paid, 0) + CASE WHEN p_payment_method = 'Cash' THEN v_alloc ELSE 0 END;
      v_new_upi := COALESCE(v_bill.upi_paid, 0) + CASE WHEN p_payment_method = 'UPI' THEN v_alloc ELSE 0 END;
      v_new_method := CASE
        WHEN v_new_upi > 0 AND v_new_cash = 0 THEN 'UPI'
        WHEN v_new_cash > 0 AND v_new_upi = 0 THEN 'Cash'
        WHEN v_new_cash > 0 AND v_new_upi > 0 THEN 'Split Payment'
        ELSE COALESCE(v_bill.payment_method, p_payment_method)
      END;

      UPDATE public.bills
         SET paid_total = v_new_paid,
             cash_paid = v_new_cash,
             upi_paid = v_new_upi,
             payment_method = v_new_method,
             paid_by_customer_id = CASE
               WHEN customer_id IS DISTINCT FROM p_customer_id THEN p_customer_id
               ELSE paid_by_customer_id
             END
       WHERE id = v_bill.id;

      IF v_bill.group_bill_id IS NOT NULL THEN
        v_group_ids := array_append(v_group_ids, v_bill.group_bill_id);
      END IF;
      v_unallocated := ROUND(v_unallocated - v_alloc, 2);
    END IF;
  END IF;

  -- FIFO across active unpaid bills (self-first)
  IF v_unallocated > 0 THEN
    FOR v_bill IN
      SELECT * FROM public.bills
       WHERE user_id = v_uid
         AND (customer_id = p_customer_id OR paid_by_customer_id = p_customer_id)
         AND COALESCE(status, 'COMPLETED') NOT IN ('CANCELLED', 'VOID')
         AND (p_bill_id IS NULL OR id <> p_bill_id)
         AND COALESCE(paid_total, 0) < COALESCE(grand_total, 0)
       ORDER BY (CASE WHEN customer_id = p_customer_id THEN 0 ELSE 1 END), created_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_unallocated <= 0;
      v_due := GREATEST(0, COALESCE(v_bill.grand_total, 0) - COALESCE(v_bill.paid_total, 0));
      v_alloc := LEAST(v_due, v_unallocated);
      IF v_alloc > 0 THEN
        v_new_paid := ROUND(COALESCE(v_bill.paid_total, 0) + v_alloc, 2);
        v_new_cash := COALESCE(v_bill.cash_paid, 0) + CASE WHEN p_payment_method = 'Cash' THEN v_alloc ELSE 0 END;
        v_new_upi := COALESCE(v_bill.upi_paid, 0) + CASE WHEN p_payment_method = 'UPI' THEN v_alloc ELSE 0 END;
        v_new_method := CASE
          WHEN v_new_upi > 0 AND v_new_cash = 0 THEN 'UPI'
          WHEN v_new_cash > 0 AND v_new_upi = 0 THEN 'Cash'
          WHEN v_new_cash > 0 AND v_new_upi > 0 THEN 'Split Payment'
          ELSE COALESCE(v_bill.payment_method, p_payment_method)
        END;

        UPDATE public.bills
           SET paid_total = v_new_paid,
               cash_paid = v_new_cash,
               upi_paid = v_new_upi,
               payment_method = v_new_method
         WHERE id = v_bill.id;

        IF v_bill.group_bill_id IS NOT NULL THEN
          v_group_ids := array_append(v_group_ids, v_bill.group_bill_id);
        END IF;
        v_unallocated := ROUND(v_unallocated - v_alloc, 2);
      END IF;
    END LOOP;
  END IF;

  -- Sync any affected group_bills
  FOREACH v_gid IN ARRAY v_group_ids LOOP
    UPDATE public.group_bills gb
       SET paid_amount = COALESCE((
             SELECT ROUND(SUM(COALESCE(paid_total, 0)), 2)
               FROM public.bills
              WHERE group_bill_id = v_gid AND COALESCE(status, 'COMPLETED') NOT IN ('CANCELLED', 'VOID')
           ), 0),
           balance_due = GREATEST(0, COALESCE((
             SELECT ROUND(SUM(COALESCE(grand_total, 0) - COALESCE(paid_total, 0)), 2)
               FROM public.bills
              WHERE group_bill_id = v_gid AND COALESCE(status, 'COMPLETED') NOT IN ('CANCELLED', 'VOID')
           ), 0))
     WHERE gb.id = v_gid;
  END LOOP;

  -- Remainder becomes customer advance balance
  IF v_unallocated > 0 THEN
    UPDATE public.customers
       SET advance_balance = ROUND(COALESCE(advance_balance, 0) + v_unallocated, 2)
     WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_pay_id,
    'payment_number', v_pay_number,
    'customer_id', p_customer_id,
    'bill_id', p_bill_id,
    'amount', p_amount,
    'payment_method', COALESCE(p_payment_method, 'Cash'),
    'status', 'COMPLETED',
    'unallocated_advance', v_unallocated
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
