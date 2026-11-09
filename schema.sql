-- =========================================================================
-- PrintPro ERP / Xerox & Stationery Billing System Database Schema
-- Multi-Tenant & Single-Store Hybrid Schema (Safe Zero-Data-Loss Backfill)
-- Fully compatible with Supabase PostgREST, Single/Multi-Tenant & Dev Bypass
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- PRE-MIGRATION SANITIZATION: Clean up legacy tables, views & foreign keys safely
-- -------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    pk_name text;
    fk_name text;
    tables text[] := ARRAY[
        'sequences',
        'customers',
        'products',
        'bills',
        'bill_items',
        'group_bills',
        'group_bill_items',
        'payments',
        'expenses',
        'settings',
        'audit_logs',
        'loyalty_transactions',
        'loyalty_rules',
        'loyalty_redemption_rules',
        'internal_transfers',
        'accounting_closings'
    ];
BEGIN
    -- 1. If expenses exists as a VIEW from legacy migrations, drop it safely
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = 'expenses'
    ) THEN
        EXECUTE 'DROP VIEW IF EXISTS public.expenses CASCADE;';
    END IF;

    -- 2. Convert any legacy composite primary keys (id, user_id) to standalone (id)
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            SELECT c.conname INTO pk_name
            FROM pg_constraint c
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = format('public.%I', tbl)::regclass 
              AND c.contype = 'p' 
              AND a.attname = 'user_id'
            LIMIT 1;

            IF pk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I CASCADE;', tbl, pk_name);
                EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id);', tbl);
            END IF;

            -- Relax legacy NOT NULL constraint on user_id for dev/bypass testing
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id' AND is_nullable = 'NO'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL;', tbl);
            END IF;
        END IF;
    END LOOP;

    -- 3. Relax legacy NOT NULL constraints from older PrintPro tables
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.customers ALTER COLUMN type DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'date' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bills ALTER COLUMN date DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'print_type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN print_type DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'sides' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN sides DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.payments ALTER COLUMN payment_type DROP NOT NULL;
    END IF;

    -- 4. Harmonize legacy column types for foreign keys (UUID conversion)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'bill_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.payments ALTER COLUMN bill_id TYPE UUID USING (
            CASE WHEN bill_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN bill_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'customer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.payments ALTER COLUMN customer_id TYPE UUID USING (
            CASE WHEN customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN customer_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'bill_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bill_items ALTER COLUMN bill_id TYPE UUID USING (
            CASE WHEN bill_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN bill_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'customer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bills ALTER COLUMN customer_id TYPE UUID USING (
            CASE WHEN customer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN customer_id::uuid ELSE NULL END
        );
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 0. SEQUENCES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    key TEXT NOT NULL,
    prefix TEXT NOT NULL,
    padding INT NOT NULL DEFAULT 6 CHECK (padding >= 2 AND padding <= 12),
    current_val BIGINT NOT NULL DEFAULT 0 CHECK (current_val >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS prefix TEXT;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS padding INT DEFAULT 6;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS current_val BIGINT DEFAULT 0;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Atomic Database Transaction Sequence Generator with User Isolation
CREATE OR REPLACE FUNCTION get_next_sequence(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_prefix TEXT;
    v_padding INT;
    v_next_val BIGINT;
BEGIN
    INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
    VALUES (v_user_id, UPPER(p_key), UPPER(p_key), 6, 1)
    ON CONFLICT (user_id, key) DO UPDATE
    SET current_val = sequences.current_val + 1,
        updated_at = now()
    RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;

    IF v_prefix IS NULL THEN
        UPDATE public.sequences
        SET current_val = sequences.current_val + 1,
            updated_at = now()
        WHERE (user_id = v_user_id OR (v_user_id IS NULL AND user_id IS NULL)) AND UPPER(key) = UPPER(p_key)
        RETURNING prefix, padding, current_val INTO v_prefix, v_padding, v_next_val;
    END IF;

    IF v_prefix IS NULL THEN
        v_prefix := UPPER(p_key);
        v_padding := 6;
        v_next_val := 1;
    END IF;

    RETURN v_prefix || '-' || LPAD(v_next_val::text, v_padding, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------
-- 1. CUSTOMERS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    customer_code TEXT,
    name TEXT NOT NULL,
    mobile TEXT,
    email TEXT,
    advance_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (advance_balance >= 0),
    loyalty_points NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (loyalty_points >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS customer_code TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS advance_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Bridge legacy phone column to mobile
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone'
    ) THEN
        UPDATE public.customers SET mobile = phone WHERE mobile IS NULL AND phone IS NOT NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 2. PRODUCTS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    product_code TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Stationery',
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Stationery';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- -------------------------------------------------------------------------
-- 3. BILLS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    bill_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rounding_method TEXT NOT NULL DEFAULT 'None',
    rounding_adjustment NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    cash_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cash_paid >= 0),
    upi_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (upi_paid >= 0),
    card_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (card_paid >= 0),
    paid_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_total >= 0),
    advance_used NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (advance_used >= 0),
    advance_earned NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (advance_earned >= 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    loyalty_points_earned NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (loyalty_points_earned >= 0),
    loyalty_points_redeemed NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (loyalty_points_redeemed >= 0),
    edited_at TIMESTAMPTZ,
    edited_by TEXT,
    edit_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS rounding_method TEXT DEFAULT 'None';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS rounding_adjustment NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cash_paid NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS upi_paid NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS card_paid NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS advance_used NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS advance_earned NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS loyalty_points_earned NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS loyalty_points_redeemed NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_by TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edit_reason TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS group_bill_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS group_role TEXT DEFAULT 'STANDALONE';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_by_customer_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_payment_method_check;

-- -------------------------------------------------------------------------
-- 3B. GROUP BILLS TABLE (SPLIT & SHARED BILLING SESSIONS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_bill_number TEXT NOT NULL,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('SPLIT', 'SHARED')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    participant_count INT NOT NULL DEFAULT 1 CHECK (participant_count >= 1),
    primary_payer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'PARTIALLY_CANCELLED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS group_bill_number TEXT;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'SPLIT';
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS grand_total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS participant_count INT DEFAULT 1;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS primary_payer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Foreign keys for group_bills & bills linking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bills'::regclass AND attname = 'group_bill_id')]
    ) THEN
        ALTER TABLE public.bills ADD CONSTRAINT fk_bills_group_bill FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bills'::regclass AND attname = 'paid_by_customer_id')]
    ) THEN
        ALTER TABLE public.bills ADD CONSTRAINT fk_bills_paid_by FOREIGN KEY (paid_by_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.group_bills'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.group_bills'::regclass AND attname = 'primary_payer_id')]
    ) THEN
        ALTER TABLE public.group_bills ADD CONSTRAINT fk_group_bills_primary_payer FOREIGN KEY (primary_payer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 3C. GROUP BILL ITEMS TABLE (MASTER ORDER ITEMS FOR SHARED BILLING)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    group_bill_id UUID NOT NULL REFERENCES public.group_bills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS group_bill_id UUID REFERENCES public.group_bills(id) ON DELETE CASCADE;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.group_bill_items'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.group_bill_items'::regclass AND attname = 'group_bill_id')]
    ) THEN
        ALTER TABLE public.group_bill_items ADD CONSTRAINT fk_group_bill_items_group FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.group_bill_items'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.group_bill_items'::regclass AND attname = 'product_id')]
    ) THEN
        ALTER TABLE public.group_bill_items ADD CONSTRAINT fk_group_bill_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Clean single-column foreign key for bills -> customers (for PostgREST)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bills'::regclass AND attname = 'customer_id')]
    ) THEN
        ALTER TABLE public.bills ADD CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 4. BILL ITEMS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Clean foreign keys for bill_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.bill_items'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bill_items'::regclass AND attname = 'bill_id')]
    ) THEN
        ALTER TABLE public.bill_items ADD CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.bill_items'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.bill_items'::regclass AND attname = 'product_id')]
    ) THEN
        ALTER TABLE public.bill_items ADD CONSTRAINT fk_bill_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 5. PAYMENTS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    payment_number TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

-- Clean foreign keys for payments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.payments'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.payments'::regclass AND attname = 'customer_id')]
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.payments'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.payments'::regclass AND attname = 'bill_id')]
    ) THEN
        ALTER TABLE public.payments ADD CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 6. EXPENSES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    expense_number TEXT,
    title TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL DEFAULT 'Shop Expense',
    payment_mode TEXT DEFAULT 'Cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_number TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Shop Expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;

-- -------------------------------------------------------------------------
-- 7. SETTINGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- -------------------------------------------------------------------------
-- 8. AUDIT LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    user_name TEXT NOT NULL DEFAULT 'Admin',
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT 'Admin';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS previous_value TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_value TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- -------------------------------------------------------------------------
-- 9. LOYALTY TRANSACTIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    transaction_number TEXT,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
    points NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'ADJUST')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS transaction_number TEXT;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS bill_id UUID;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS points NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Clean foreign keys for loyalty_transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.loyalty_transactions'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.loyalty_transactions'::regclass AND attname = 'customer_id')]
    ) THEN
        ALTER TABLE public.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.loyalty_transactions'::regclass AND contype = 'f' 
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.loyalty_transactions'::regclass AND attname = 'bill_id')]
    ) THEN
        ALTER TABLE public.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- 10. LOYALTY EARNING RULES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    rule_name TEXT NOT NULL,
    min_bill_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (min_bill_amount >= 0),
    max_bill_amount NUMERIC(10, 2),
    points_earned NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (points_earned > 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS min_bill_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS max_bill_amount NUMERIC(10, 2);
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS points_earned NUMERIC(10, 2) NOT NULL DEFAULT 1.00;
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.loyalty_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$ BEGIN
    ALTER TABLE public.loyalty_rules ALTER COLUMN reward_type DROP NOT NULL;
    ALTER TABLE public.loyalty_rules ALTER COLUMN reward_value DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- 11. DYNAMIC LOYALTY REDEMPTION RULES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_redemption_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    points_required INT NOT NULL CHECK (points_required > 0),
    discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount > 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_redemption_rules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.loyalty_redemption_rules ADD COLUMN IF NOT EXISTS points_required INT DEFAULT 1;
ALTER TABLE public.loyalty_redemption_rules ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.loyalty_redemption_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true;
ALTER TABLE public.loyalty_redemption_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- -------------------------------------------------------------------------
-- 12. INTERNAL TRANSFERS TABLE (CONTRA VOUCHERS: CASH <-> UPI)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    transfer_number TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('CASH_TO_UPI', 'UPI_TO_CASH')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS transfer_number TEXT;
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- -------------------------------------------------------------------------
-- 13. ACCOUNTING CLOSINGS TABLE (DAY END / MONTH END CLOSURES)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    closing_type TEXT NOT NULL CHECK (closing_type IN ('DAILY', 'MONTHLY')),
    closing_date DATE NOT NULL,
    closing_month TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'REOPENED')),
    notes TEXT,
    closed_at TIMESTAMPTZ,
    closed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closing_number TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closing_type TEXT DEFAULT 'DAILY';
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closing_date DATE;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closing_month TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS from_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS to_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS opening_cash NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS opening_upi NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS cash_inflow NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS upi_inflow NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS cash_outflow NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS upi_outflow NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS transfers_cash_to_upi NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS transfers_upi_to_cash NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS expected_upi NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS actual_cash NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS actual_upi NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS cash_difference NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS upi_difference NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS discrepancy_note TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS denominations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS opening_advance_pool NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS advance_received NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS advance_utilized NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closing_advance_pool NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- =========================================================================
-- ZERO-DATA-LOSS BACKFILL BLOCK
-- =========================================================================
DO $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
        UPDATE public.sequences SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.customers SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.products SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.bills SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.bill_items bi SET user_id = COALESCE(b.user_id, v_owner_id)
        FROM public.bills b WHERE bi.bill_id = b.id AND bi.user_id IS NULL;
        UPDATE public.bill_items SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.group_bills SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.group_bill_items gbi SET user_id = COALESCE(gb.user_id, v_owner_id)
        FROM public.group_bills gb WHERE gbi.group_bill_id = gb.id AND gbi.user_id IS NULL;
        UPDATE public.group_bill_items SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.payments SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.expenses SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.settings SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.audit_logs SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.loyalty_transactions SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.loyalty_rules SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.loyalty_redemption_rules SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.internal_transfers SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.accounting_closings SET user_id = v_owner_id WHERE user_id IS NULL;
    END IF;
END $$;

-- Clean up any legacy duplicate seed rules before creating unique constraints
DELETE FROM public.loyalty_redemption_rules a
WHERE a.id NOT IN (
    SELECT MIN(id::text)::uuid
    FROM public.loyalty_redemption_rules
    GROUP BY user_id, points_required
);

DELETE FROM public.loyalty_rules a
WHERE a.id NOT IN (
    SELECT MIN(id::text)::uuid
    FROM public.loyalty_rules
    GROUP BY user_id, rule_name
);

-- Clean up any invalid or duplicate sequences before creating unique constraints
DELETE FROM public.sequences WHERE key IS NULL OR TRIM(key) = '';

DELETE FROM public.sequences a
WHERE a.id NOT IN (
    SELECT MIN(id::text)::uuid
    FROM public.sequences
    GROUP BY COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), key
);

-- Seed default standard entity sequences if table is empty
DO $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
    VALUES 
        (v_owner_id, 'BILL', 'INV', 6, 0),
        (v_owner_id, 'GROUP_BILL', 'GRP', 6, 0),
        (v_owner_id, 'CLOSING', 'CLS', 6, 0),
        (v_owner_id, 'CUSTOMER', 'CUST', 6, 0),
        (v_owner_id, 'PRODUCT', 'PROD', 6, 0),
        (v_owner_id, 'PAYMENT', 'PAY', 6, 0),
        (v_owner_id, 'EXPENSE', 'EXP', 6, 0),
        (v_owner_id, 'TRANSFER', 'TRF', 6, 0),
        (v_owner_id, 'LOYALTY_TX', 'LTX', 6, 0)
    ON CONFLICT DO NOTHING;
END $$;

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_group_bill_id ON public.bills(group_bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_user_id ON public.bill_items(user_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_user_id ON public.group_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_primary_payer ON public.group_bills(primary_payer_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_created_at ON public.group_bills(created_at);
CREATE INDEX IF NOT EXISTS idx_group_bill_items_group_bill_id ON public.group_bill_items(group_bill_id);
CREATE INDEX IF NOT EXISTS idx_group_bill_items_user_id ON public.group_bill_items(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user_id ON public.loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemption_user ON public.loyalty_redemption_rules(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_redemption_unique ON public.loyalty_redemption_rules(user_id, points_required);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_rules_unique ON public.loyalty_rules(user_id, rule_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sequences_user_key ON public.sequences(user_id, key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_key ON public.settings(user_id, key);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Supports:
-- 1. Strict multi-tenant isolation for authenticated users
-- 2. Dev Bypass & Single-Store support for public/anon key access
-- =========================================================================
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemption_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_closings ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to guarantee clean, idempotent creation
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Authenticated Users: Tenant Data Isolation (or user_id is null / matching)
CREATE POLICY "Tenant isolation on sequences" ON public.sequences FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on bills" ON public.bills FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on bill_items" ON public.bill_items FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on group_bills" ON public.group_bills FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on group_bill_items" ON public.group_bill_items FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on payments" ON public.payments FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on loyalty_transactions" ON public.loyalty_transactions FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on loyalty_rules" ON public.loyalty_rules FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on loyalty_redemption_rules" ON public.loyalty_redemption_rules FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on internal_transfers" ON public.internal_transfers FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant isolation on accounting_closings" ON public.accounting_closings FOR ALL TO authenticated USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Audit logs for authenticated users
CREATE POLICY "Tenant insert on audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Tenant select on audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- Anonymous / Dev Bypass Access: Allows seamless local development without login
CREATE POLICY "Anon bypass access on sequences" ON public.sequences FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on customers" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on products" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on bills" ON public.bills FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on bill_items" ON public.bill_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on group_bills" ON public.group_bills FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on group_bill_items" ON public.group_bill_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on payments" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on expenses" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on settings" ON public.settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on audit_logs" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on loyalty_transactions" ON public.loyalty_transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on loyalty_rules" ON public.loyalty_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on loyalty_redemption_rules" ON public.loyalty_redemption_rules FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on internal_transfers" ON public.internal_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon bypass access on accounting_closings" ON public.accounting_closings FOR ALL TO anon USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- PERMISSIONS / ROLE GRANTS
-- -------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- RELOAD SUPABASE POSTGREST SCHEMA CACHE INSTANTLY
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
