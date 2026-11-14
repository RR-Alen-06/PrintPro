-- =============================================================================
-- PrintPro / SimpleBilling — Consolidated PostgreSQL / Supabase Schema
-- =============================================================================
-- Clean, single-file schema for cloning or provisioning a fresh Supabase DB.
-- Incremental production migrations live in ./supabase/migrations/.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sequences (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  key text NOT NULL,
  prefix text NOT NULL,
  padding integer DEFAULT 6 NOT NULL,
  current_val bigint DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (user_id, key),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (user_id, key),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  customer_code text,
  name text NOT NULL,
  mobile text,
  email text,
  advance_balance numeric DEFAULT 0.00 NOT NULL,
  loyalty_points numeric DEFAULT 0.00 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  product_code text,
  name text NOT NULL,
  category text DEFAULT 'Stationery'::text NOT NULL,
  price numeric DEFAULT 0.00 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.group_bills (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  group_bill_number text NOT NULL,
  billing_type text NOT NULL,
  total_amount numeric DEFAULT 0.00 NOT NULL,
  discount numeric DEFAULT 0.00 NOT NULL,
  grand_total numeric DEFAULT 0.00 NOT NULL,
  paid_amount numeric DEFAULT 0.00 NOT NULL,
  balance_due numeric DEFAULT 0.00 NOT NULL,
  participant_count integer DEFAULT 1 NOT NULL,
  primary_payer_id uuid,
  status text DEFAULT 'COMPLETED'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (primary_payer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.group_bill_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  group_bill_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.bills (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  bill_number text NOT NULL,
  customer_id uuid,
  total numeric DEFAULT 0.00 NOT NULL,
  discount numeric DEFAULT 0.00 NOT NULL,
  gst_amount numeric DEFAULT 0.00 NOT NULL,
  rounding_method text DEFAULT 'None'::text NOT NULL,
  rounding_adjustment numeric DEFAULT 0.00 NOT NULL,
  grand_total numeric DEFAULT 0.00 NOT NULL,
  cash_paid numeric DEFAULT 0.00 NOT NULL,
  upi_paid numeric DEFAULT 0.00 NOT NULL,
  card_paid numeric DEFAULT 0.00 NOT NULL,
  paid_total numeric DEFAULT 0.00 NOT NULL,
  advance_used numeric DEFAULT 0.00 NOT NULL,
  advance_earned numeric DEFAULT 0.00 NOT NULL,
  payment_method text DEFAULT 'Cash'::text NOT NULL,
  loyalty_points_earned numeric DEFAULT 0.00 NOT NULL,
  loyalty_points_redeemed numeric DEFAULT 0.00 NOT NULL,
  edited_at timestamp with time zone,
  edited_by text,
  edit_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  group_bill_id uuid,
  group_role text DEFAULT 'STANDALONE'::text,
  paid_by_customer_id uuid,
  notes text,
  status text DEFAULT 'COMPLETED'::text,
  cancelled_at timestamp with time zone,
  cancelled_by text,
  cancellation_reason text,
  PRIMARY KEY (id),
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  FOREIGN KEY (paid_by_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.bill_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  bill_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  total numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  payment_number text,
  customer_id uuid,
  bill_id uuid,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'Cash'::text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'COMPLETED'::text,
  cancellation_reason text,
  cancelled_at timestamp with time zone,
  cancelled_by text,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  expense_number text,
  title text NOT NULL,
  amount numeric NOT NULL,
  category text DEFAULT 'Shop Expense'::text NOT NULL,
  payment_mode text DEFAULT 'Cash'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.internal_transfers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  transfer_number text,
  direction text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  transfer_date timestamp with time zone DEFAULT now() NOT NULL,
  created_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.accounting_closings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  closing_type text NOT NULL,
  closing_date date NOT NULL,
  closing_month text,
  status text DEFAULT 'OPEN'::text NOT NULL,
  notes text,
  closed_at timestamp with time zone,
  closed_by text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  closing_number text,
  from_date timestamp with time zone DEFAULT now(),
  to_date timestamp with time zone DEFAULT now(),
  opening_cash numeric DEFAULT 0.00,
  opening_upi numeric DEFAULT 0.00,
  cash_inflow numeric DEFAULT 0.00,
  upi_inflow numeric DEFAULT 0.00,
  cash_outflow numeric DEFAULT 0.00,
  upi_outflow numeric DEFAULT 0.00,
  transfers_cash_to_upi numeric DEFAULT 0.00,
  transfers_upi_to_cash numeric DEFAULT 0.00,
  expected_cash numeric DEFAULT 0.00,
  expected_upi numeric DEFAULT 0.00,
  actual_cash numeric DEFAULT 0.00,
  actual_upi numeric DEFAULT 0.00,
  cash_difference numeric DEFAULT 0.00,
  upi_difference numeric DEFAULT 0.00,
  discrepancy_note text,
  is_locked boolean DEFAULT true,
  denominations jsonb DEFAULT '{}'::jsonb,
  opening_advance_pool numeric DEFAULT 0.00,
  advance_received numeric DEFAULT 0.00,
  advance_utilized numeric DEFAULT 0.00,
  closing_advance_pool numeric DEFAULT 0.00,
  last_audited_at timestamp with time zone,
  last_audited_by text,
  audit_notes text,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.loyalty_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  rule_name text NOT NULL,
  min_bill_amount numeric DEFAULT 0.00 NOT NULL,
  max_bill_amount numeric,
  points_earned numeric DEFAULT 1.00 NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.loyalty_redemption_rules (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  points_required integer NOT NULL,
  discount_amount numeric NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  transaction_number text,
  customer_id uuid NOT NULL,
  bill_id uuid,
  points numeric NOT NULL,
  type text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid DEFAULT auth.uid(),
  audit_number text,
  user_name text DEFAULT 'Admin'::text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  previous_value text,
  new_value text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_user_id ON public.bill_items (user_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills (created_at);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills (customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_group_bill_id ON public.bills (group_bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills (status);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills (user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_group_bill_items_group_bill_id ON public.group_bill_items (group_bill_id);
CREATE INDEX IF NOT EXISTS idx_group_bill_items_user_id ON public.group_bill_items (user_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_created_at ON public.group_bills (created_at);
CREATE INDEX IF NOT EXISTS idx_group_bills_primary_payer ON public.group_bills (primary_payer_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_user_id ON public.group_bills (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_redemption_unique ON public.loyalty_redemption_rules (user_id, points_required);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_user ON public.loyalty_redemption_rules (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_rules_unique ON public.loyalty_rules (user_id, rule_name);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user_id ON public.loyalty_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products (user_id);

-- -----------------------------------------------------------------------------
-- 3. FUNCTIONS & RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_next_sequence(p_key text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_prefix TEXT;
    v_padding INT;
    v_next_val BIGINT;
BEGIN
    -- 1. First try atomic UPDATE on existing sequence row for this user
    UPDATE public.sequences
    SET current_val = COALESCE(current_val, 0) + 1,
        updated_at = now()
    WHERE (user_id = v_user_id OR (v_user_id IS NULL AND user_id IS NULL))
      AND UPPER(key) = UPPER(p_key)
    RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;

    -- 2. If no sequence row exists yet for this user & key, insert initial row
    IF v_prefix IS NULL THEN
        INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
        VALUES (v_user_id, UPPER(p_key), UPPER(LEFT(p_key, 3)), 6, 1)
        RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;
    END IF;

    IF v_prefix IS NULL THEN
        v_prefix := UPPER(LEFT(p_key, 3));
        v_padding := 6;
        v_next_val := 1;
    END IF;

    RETURN v_prefix || '-' || LPAD(v_next_val::text, COALESCE(v_padding, 6), '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_customer_id uuid, p_amount numeric, p_payment_method text, p_bill_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_user_name text DEFAULT 'Admin'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.sync_bill_items_legacy_compat()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Synchronize product_name <-> item_name
    IF NEW.product_name IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.product_name IS DISTINCT FROM OLD.product_name) THEN
        BEGIN
            NEW.item_name := NEW.product_name;
        EXCEPTION WHEN undefined_column THEN
        END;
    ELSIF NEW.product_name IS NULL THEN
        BEGIN
            NEW.product_name := NEW.item_name;
        EXCEPTION WHEN undefined_column THEN
        END;
    END IF;

    -- Synchronize quantity <-> qty
    IF NEW.quantity IS NOT NULL THEN
        BEGIN
            NEW.qty := ROUND(NEW.quantity)::INT;
        EXCEPTION WHEN undefined_column THEN
        END;
    ELSIF NEW.quantity IS NULL THEN
        BEGIN
            NEW.quantity := NEW.qty;
        EXCEPTION WHEN undefined_column THEN
        END;
    END IF;

    -- Synchronize price <-> unit_price
    IF NEW.price IS NOT NULL THEN
        BEGIN
            NEW.unit_price := NEW.price;
        EXCEPTION WHEN undefined_column THEN
        END;
    ELSIF NEW.price IS NULL THEN
        BEGIN
            NEW.price := NEW.unit_price;
        EXCEPTION WHEN undefined_column THEN
        END;
    END IF;

    -- Synchronize total <-> amount
    IF NEW.total IS NOT NULL THEN
        BEGIN
            NEW.amount := NEW.total;
        EXCEPTION WHEN undefined_column THEN
        END;
    ELSIF NEW.total IS NULL THEN
        BEGIN
            NEW.total := NEW.amount;
        EXCEPTION WHEN undefined_column THEN
        END;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_sequences_key_compat()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    BEGIN
        IF NEW.key IS NULL AND NEW.entity_type IS NOT NULL THEN
            NEW.key := UPPER(NEW.entity_type);
        END IF;
        IF NEW.entity_type IS NULL AND NEW.key IS NOT NULL THEN
            NEW.entity_type := LOWER(NEW.key);
        END IF;
    EXCEPTION WHEN undefined_column THEN
    END;

    BEGIN
        IF NEW.current_val IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.current_val IS DISTINCT FROM OLD.current_val) THEN
            NEW.last_seq := NEW.current_val;
        ELSIF NEW.current_val IS NULL OR NEW.current_val = 0 THEN
            NEW.current_val := COALESCE(NEW.last_seq, 0);
        END IF;
    EXCEPTION WHEN undefined_column THEN
    END;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
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
$function$;

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

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_bill_items_legacy_compat ON public.bill_items;
CREATE TRIGGER trg_sync_bill_items_legacy_compat
  BEFORE INSERT OR UPDATE ON public.bill_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_bill_items_legacy_compat();

DROP TRIGGER IF EXISTS trg_sync_sequences_key_compat ON public.sequences;
CREATE TRIGGER trg_sync_sequences_key_compat
  BEFORE INSERT OR UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.sync_sequences_key_compat();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (TENANT ISOLATION)
-- -----------------------------------------------------------------------------

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on sequences" ON public.sequences;
CREATE POLICY "Tenant isolation on sequences" ON public.sequences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on settings" ON public.settings;
CREATE POLICY "Tenant isolation on settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on customers" ON public.customers;
CREATE POLICY "Tenant isolation on customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on products" ON public.products;
CREATE POLICY "Tenant isolation on products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.group_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on group_bills" ON public.group_bills;
CREATE POLICY "Tenant isolation on group_bills" ON public.group_bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.group_bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on group_bill_items" ON public.group_bill_items;
CREATE POLICY "Tenant isolation on group_bill_items" ON public.group_bill_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on bills" ON public.bills;
CREATE POLICY "Tenant isolation on bills" ON public.bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on bill_items" ON public.bill_items;
CREATE POLICY "Tenant isolation on bill_items" ON public.bill_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on payments" ON public.payments;
CREATE POLICY "Tenant isolation on payments" ON public.payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on expenses" ON public.expenses;
CREATE POLICY "Tenant isolation on expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on internal_transfers" ON public.internal_transfers;
CREATE POLICY "Tenant isolation on internal_transfers" ON public.internal_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.accounting_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on accounting_closings" ON public.accounting_closings;
CREATE POLICY "Tenant isolation on accounting_closings" ON public.accounting_closings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on loyalty_rules" ON public.loyalty_rules;
CREATE POLICY "Tenant isolation on loyalty_rules" ON public.loyalty_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.loyalty_redemption_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on loyalty_redemption_rules" ON public.loyalty_redemption_rules;
CREATE POLICY "Tenant isolation on loyalty_redemption_rules" ON public.loyalty_redemption_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant isolation on loyalty_transactions" ON public.loyalty_transactions;
CREATE POLICY "Tenant isolation on loyalty_transactions" ON public.loyalty_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant select on audit_logs" ON public.audit_logs;
CREATE POLICY "Tenant select on audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Tenant insert on audit_logs" ON public.audit_logs;
CREATE POLICY "Tenant insert on audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
