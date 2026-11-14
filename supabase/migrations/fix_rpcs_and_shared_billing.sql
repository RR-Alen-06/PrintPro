-- ============================================================================
-- Migration: Purge Business Data RPC + Atomic Shared Billing & Group Payment
-- ============================================================================

-- 1. Atomic Full Business Data Purge (preserves settings & auth.users)
CREATE OR REPLACE FUNCTION public.purge_all_business_data(
  p_reset_sequences BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.group_bill_items WHERE user_id = v_uid;
  DELETE FROM public.bill_items WHERE user_id = v_uid;
  DELETE FROM public.payments WHERE user_id = v_uid;
  DELETE FROM public.bills WHERE user_id = v_uid;
  DELETE FROM public.group_bills WHERE user_id = v_uid;
  DELETE FROM public.expenses WHERE user_id = v_uid;
  DELETE FROM public.internal_transfers WHERE user_id = v_uid;
  DELETE FROM public.accounting_closings WHERE user_id = v_uid;
  DELETE FROM public.loyalty_transactions WHERE user_id = v_uid;
  DELETE FROM public.audit_logs WHERE user_id = v_uid;
  DELETE FROM public.customers WHERE user_id = v_uid;
  DELETE FROM public.products WHERE user_id = v_uid;

  IF COALESCE(p_reset_sequences, TRUE) THEN
    UPDATE public.sequences
       SET current_val = 0,
           updated_at = now()
     WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sequences_reset', COALESCE(p_reset_sequences, TRUE)
  );
END;
$$;

-- 2. Atomic Shared Billing Creation (strictly equal split total / N, Pay Later until collected)
CREATE OR REPLACE FUNCTION public.create_shared_billing_atomic(
  p_items JSONB,
  p_participants JSONB,
  p_discount NUMERIC DEFAULT 0,
  p_gst_rate NUMERIC DEFAULT 0,
  p_gst_enabled BOOLEAN DEFAULT FALSE,
  p_rounding_method TEXT DEFAULT 'None',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group_num TEXT;
  v_group_id UUID;
  v_item JSONB;
  v_part JSONB;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := GREATEST(0, COALESCE(p_discount, 0));
  v_after_disc NUMERIC;
  v_gst NUMERIC := 0;
  v_before_round NUMERIC;
  v_grand_total NUMERIC;
  v_n INT;
  v_base_share NUMERIC;
  v_remainder_cents INT;
  v_idx INT := 0;
  v_share NUMERIC;
  v_bill_num TEXT;
  v_bill_id UUID;
  v_cust_id UUID;
  v_part_name TEXT;
  v_items_summary TEXT := '';
  v_qty NUMERIC;
  v_price NUMERIC;
  v_line_total NUMERIC;
  v_prod_id UUID;
  v_prod_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_n := COALESCE(jsonb_array_length(p_participants), 0);
  IF v_n <= 0 THEN
    RAISE EXCEPTION 'At least one participant is required for Shared Billing';
  END IF;
  IF COALESCE(jsonb_array_length(p_items), 0) <= 0 THEN
    RAISE EXCEPTION 'At least one item is required for Shared Billing';
  END IF;

  -- Compute master subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := GREATEST(0.001, COALESCE((v_item->>'quantity')::NUMERIC, 1));
    v_price := GREATEST(0, COALESCE((v_item->>'price')::NUMERIC, 0));
    v_line_total := ROUND(v_qty * v_price, 2);
    v_subtotal := ROUND(v_subtotal + v_line_total, 2);
    v_prod_name := COALESCE(NULLIF(trim(v_item->>'product_name'), ''), 'Item');
    IF v_items_summary = '' THEN
      v_items_summary := v_qty || 'x ' || v_prod_name;
    ELSE
      v_items_summary := v_items_summary || ', ' || v_qty || 'x ' || v_prod_name;
    END IF;
  END LOOP;

  v_after_disc := GREATEST(0, ROUND(v_subtotal - v_discount, 2));
  IF COALESCE(p_gst_enabled, FALSE) AND COALESCE(p_gst_rate, 0) > 0 THEN
    v_gst := ROUND((v_after_disc * p_gst_rate) / 100.0, 2);
  END IF;
  v_before_round := v_after_disc + v_gst;

  v_grand_total := CASE COALESCE(p_rounding_method, 'None')
    WHEN 'Round Down' THEN FLOOR(v_before_round)
    WHEN 'Round Up' THEN CEIL(v_before_round)
    WHEN 'Standard' THEN ROUND(v_before_round)
    ELSE ROUND(v_before_round, 2)
  END;

  v_group_num := public.get_next_sequence('GROUP_BILL');

  INSERT INTO public.group_bills (
    user_id, group_bill_number, billing_type, total_amount, discount,
    grand_total, paid_amount, balance_due, participant_count, status, notes
  ) VALUES (
    v_uid, v_group_num, 'SHARED', v_subtotal, v_discount,
    v_grand_total, 0, v_grand_total, v_n, 'COMPLETED', p_notes
  ) RETURNING id INTO v_group_id;

  -- Insert master items & deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := NULLIF(v_item->>'product_id', '')::UUID;
    v_prod_name := COALESCE(NULLIF(trim(v_item->>'product_name'), ''), 'Item');
    v_qty := GREATEST(0.001, COALESCE((v_item->>'quantity')::NUMERIC, 1));
    v_price := GREATEST(0, COALESCE((v_item->>'price')::NUMERIC, 0));
    v_line_total := ROUND(v_qty * v_price, 2);

    INSERT INTO public.group_bill_items (
      user_id, group_bill_id, product_id, product_name, quantity, price, total
    ) VALUES (
      v_uid, v_group_id, v_prod_id, v_prod_name, v_qty, v_price, v_line_total
    );

    IF v_prod_id IS NOT NULL THEN
      UPDATE public.products
         SET stock = GREATEST(0, COALESCE(stock, 0) - v_qty)
       WHERE id = v_prod_id AND user_id = v_uid;
    END IF;
  END LOOP;

  -- Equal split in paise/cents so sum(shares) == v_grand_total exactly
  v_base_share := FLOOR((v_grand_total * 100.0) / v_n) / 100.0;
  v_remainder_cents := ROUND(v_grand_total * 100)::INT - (ROUND(v_base_share * 100)::INT * v_n);

  FOR v_part IN SELECT * FROM jsonb_array_elements(p_participants) LOOP
    v_idx := v_idx + 1;
    v_share := v_base_share + CASE WHEN v_idx <= v_remainder_cents THEN 0.01 ELSE 0 END;
    v_cust_id := NULLIF(v_part->>'customer_id', '')::UUID;
    v_part_name := COALESCE(NULLIF(trim(v_part->>'customer_name'), ''), 'Guest ' || v_idx);
    v_bill_num := public.get_next_sequence('BILL');

    INSERT INTO public.bills (
      user_id, bill_number, customer_id, group_bill_id, group_role,
      total, discount, gst_amount, rounding_method, rounding_adjustment,
      grand_total, cash_paid, upi_paid, paid_total, advance_used, advance_earned,
      payment_method, status, notes
    ) VALUES (
      v_uid, v_bill_num, v_cust_id, v_group_id, 'MEMBER',
      v_share, 0, ROUND(v_gst / v_n, 2), 'None', 0,
      v_share, 0, 0, 0, 0, 0,
      'Pay Later', 'COMPLETED', 'Shared Bill Share (' || v_group_num || ') - ' || v_part_name
    ) RETURNING id INTO v_bill_id;

    INSERT INTO public.bill_items (
      user_id, bill_id, product_id, product_name, quantity, price, total
    ) VALUES (
      v_uid, v_bill_id, NULL,
      'Group Bill Share (' || v_group_num || '): ' || LEFT(v_items_summary, 80),
      1, v_share, v_share
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_group_id,
    'group_bill_number', v_group_num,
    'grand_total', v_grand_total
  );
END;
$$;

-- 3. Atomic Group Bill Post-Billing Payment (supports self-pay, full-pay, cross-pay, multi-day)
CREATE OR REPLACE FUNCTION public.record_group_bill_payment_atomic(
  p_group_bill_id UUID,
  p_paying_customer_id UUID,
  p_payment_method TEXT,
  p_allocations JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group RECORD;
  v_payer RECORD;
  v_alloc JSONB;
  v_bill RECORD;
  v_req_amt NUMERIC;
  v_due NUMERIC;
  v_apply NUMERIC;
  v_total_applied NUMERIC := 0;
  v_pay_num TEXT;
  v_pay_id UUID;
  v_new_paid NUMERIC;
  v_new_cash NUMERIC;
  v_new_upi NUMERIC;
  v_new_adv NUMERIC;
  v_new_method TEXT;
  v_grp_paid NUMERIC;
  v_grp_due NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_group FROM public.group_bills WHERE id = p_group_bill_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group bill not found';
  END IF;

  SELECT * INTO v_payer FROM public.customers WHERE id = p_paying_customer_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paying customer not found';
  END IF;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_req_amt := ROUND(COALESCE((v_alloc->>'amount')::NUMERIC, 0), 2);
    IF v_req_amt <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_bill
      FROM public.bills
     WHERE id = (v_alloc->>'bill_id')::UUID
       AND group_bill_id = p_group_bill_id
       AND user_id = v_uid
       AND COALESCE(status, 'COMPLETED') NOT IN ('CANCELLED', 'VOID')
       FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_due := GREATEST(0, ROUND(COALESCE(v_bill.grand_total, 0) - COALESCE(v_bill.paid_total, 0), 2));
    v_apply := LEAST(v_due, v_req_amt);
    IF v_apply <= 0 THEN
      CONTINUE;
    END IF;

    IF p_payment_method = 'Advance' THEN
      IF COALESCE(v_payer.advance_balance, 0) < v_total_applied + v_apply THEN
        RAISE EXCEPTION 'Insufficient customer advance balance';
      END IF;
    END IF;

    v_new_paid := ROUND(COALESCE(v_bill.paid_total, 0) + v_apply, 2);
    v_new_cash := COALESCE(v_bill.cash_paid, 0) + CASE WHEN p_payment_method = 'Cash' THEN v_apply ELSE 0 END;
    v_new_upi := COALESCE(v_bill.upi_paid, 0) + CASE WHEN p_payment_method = 'UPI' THEN v_apply ELSE 0 END;
    v_new_adv := COALESCE(v_bill.advance_used, 0) + CASE WHEN p_payment_method = 'Advance' THEN v_apply ELSE 0 END;

    v_new_method := CASE
      WHEN v_new_upi > 0 AND v_new_cash = 0 THEN 'UPI'
      WHEN v_new_cash > 0 AND v_new_upi = 0 THEN 'Cash'
      WHEN v_new_cash > 0 AND v_new_upi > 0 THEN 'Split Payment'
      WHEN v_new_adv > 0 THEN 'Advance Used'
      ELSE COALESCE(v_bill.payment_method, p_payment_method)
    END;

    UPDATE public.bills
       SET paid_total = v_new_paid,
           cash_paid = v_new_cash,
           upi_paid = v_new_upi,
           advance_used = v_new_adv,
           payment_method = v_new_method,
           paid_by_customer_id = CASE
             WHEN customer_id IS DISTINCT FROM p_paying_customer_id THEN p_paying_customer_id
             ELSE paid_by_customer_id
           END
     WHERE id = v_bill.id;

    v_total_applied := ROUND(v_total_applied + v_apply, 2);
  END LOOP;

  IF v_total_applied <= 0 THEN
    RAISE EXCEPTION 'No payable balance selected';
  END IF;

  IF p_payment_method = 'Advance' THEN
    UPDATE public.customers
       SET advance_balance = GREATEST(0, ROUND(COALESCE(advance_balance, 0) - v_total_applied, 2))
     WHERE id = p_paying_customer_id;
  ELSE
    v_pay_num := public.get_next_sequence('PAYMENT');
    INSERT INTO public.payments (
      user_id, payment_number, customer_id, bill_id, amount, payment_method, status, notes
    ) VALUES (
      v_uid, v_pay_num, p_paying_customer_id, NULL, v_total_applied,
      COALESCE(p_payment_method, 'Cash'), 'COMPLETED',
      COALESCE(p_notes, 'Group Bill Payment (' || v_group.group_bill_number || ')')
    ) RETURNING id INTO v_pay_id;
  END IF;

  SELECT
    COALESCE(ROUND(SUM(COALESCE(paid_total, 0)), 2), 0),
    GREATEST(0, COALESCE(ROUND(SUM(COALESCE(grand_total, 0) - COALESCE(paid_total, 0)), 2), 0))
  INTO v_grp_paid, v_grp_due
  FROM public.bills
  WHERE group_bill_id = p_group_bill_id
    AND COALESCE(status, 'COMPLETED') NOT IN ('CANCELLED', 'VOID');

  UPDATE public.group_bills
     SET paid_amount = v_grp_paid,
         balance_due = v_grp_due
   WHERE id = p_group_bill_id;

  RETURN jsonb_build_object(
    'payment_id', v_pay_id,
    'payment_number', v_pay_num,
    'total_paid', v_total_applied,
    'group_paid_amount', v_grp_paid,
    'group_balance_due', v_grp_due
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

