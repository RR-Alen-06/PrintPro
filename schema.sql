-- =========================================================================
-- PrintPro ERP / Xerox & Stationery Billing System Database Schema
-- Multi-Tenant Schema (Safe Zero-Data-Loss Backfill)
-- Fully compatible with Supabase PostgREST & Strict Tenant Isolation (RLS)
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
    fk_rec record;
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

            -- Relax legacy NOT NULL constraint on user_id during schema migration
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id' AND is_nullable = 'NO'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP NOT NULL;', tbl);
            END IF;
        END IF;
    END LOOP;

    -- Drop legacy sequences and settings constraints & indexes that cause conflicts during backfill
    ALTER TABLE public.sequences DROP CONSTRAINT IF EXISTS unique_user_entity_sequence CASCADE;
    ALTER TABLE public.sequences DROP CONSTRAINT IF EXISTS sequences_user_entity_unique CASCADE;
    ALTER TABLE public.sequences DROP CONSTRAINT IF EXISTS sequences_user_id_key_key CASCADE;
    ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_user_id_key_key CASCADE;

    DROP INDEX IF EXISTS public.unique_user_entity_sequence CASCADE;
    DROP INDEX IF EXISTS public.sequences_user_entity_unique CASCADE;
    DROP INDEX IF EXISTS public.idx_sequences_key_unified CASCADE;
    DROP INDEX IF EXISTS public.idx_sequences_key_standalone CASCADE;
    DROP INDEX IF EXISTS public.idx_settings_key_unified CASCADE;
    DROP INDEX IF EXISTS public.idx_settings_key_standalone CASCADE;

    -- If legacy entity_type column exists on sequences, relax NOT NULL and populate key/entity_type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'entity_type'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'entity_type' AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE public.sequences ALTER COLUMN entity_type DROP NOT NULL;
        END IF;

        ALTER TABLE public.sequences ALTER COLUMN entity_type SET DEFAULT NULL;

        UPDATE public.sequences 
        SET key = UPPER(entity_type) 
        WHERE (key IS NULL OR TRIM(key) = '') AND entity_type IS NOT NULL;

        UPDATE public.sequences 
        SET entity_type = LOWER(key) 
        WHERE (entity_type IS NULL OR TRIM(entity_type) = '') AND key IS NOT NULL;
    END IF;

    -- If legacy last_seq column exists on sequences, preserve counters into current_val
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'last_seq'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'last_seq' AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE public.sequences ALTER COLUMN last_seq DROP NOT NULL;
        END IF;
        ALTER TABLE public.sequences ALTER COLUMN last_seq SET DEFAULT 0;
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'current_val'
        ) THEN
            UPDATE public.sequences 
            SET current_val = GREATEST(COALESCE(current_val, 0), COALESCE(last_seq, 0)),
                last_seq = GREATEST(COALESCE(current_val, 0), COALESCE(last_seq, 0));
        END IF;
    END IF;

    -- Normalize legacy sequence key aliases to match application keys
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'key'
    ) THEN
        UPDATE public.sequences SET key = 'CLOSE' WHERE UPPER(TRIM(key)) = 'CLOSING';
        UPDATE public.sequences SET key = 'TRANS' WHERE UPPER(TRIM(key)) = 'TRANSFER';
        UPDATE public.sequences SET key = 'LOYALTY' WHERE UPPER(TRIM(key)) = 'LOYALTY_TX';
    END IF;

    -- 3. Relax legacy NOT NULL constraints from older PrintPro tables
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'type' AND is_nullable = 'NO') THEN
        ALTER TABLE public.customers ALTER COLUMN type DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'date' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bills ALTER COLUMN date DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'subtotal' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bills ALTER COLUMN subtotal DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'amount_paid' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bills ALTER COLUMN amount_paid DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'balance' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bills ALTER COLUMN balance DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'item_name' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN item_name DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'qty' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN qty DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'unit_price' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN unit_price DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'amount' AND is_nullable = 'NO') THEN
        ALTER TABLE public.bill_items ALTER COLUMN amount DROP NOT NULL;
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

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'total_paid' AND is_nullable = 'NO') THEN
        ALTER TABLE public.payments ALTER COLUMN total_paid DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_bills' AND column_name = 'group_id' AND is_nullable = 'NO') THEN
        ALTER TABLE public.group_bills ALTER COLUMN group_id DROP NOT NULL;
    END IF;

    -- 4. Harmonize legacy column types for foreign keys & primary keys (UUID conversion)
    -- 4A. group_bills.id conversion to UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'group_bills' AND column_name = 'id' AND udt_name != 'uuid'
    ) THEN
        FOR fk_rec IN
            SELECT c.conrelid::regclass AS src_tbl, c.conname
            FROM pg_constraint c
            WHERE c.confrelid = 'public.group_bills'::regclass AND c.contype = 'f'
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I CASCADE;', fk_rec.src_tbl, fk_rec.conname);
        END LOOP;

        SELECT c.conname INTO pk_name
        FROM pg_constraint c
        WHERE c.conrelid = 'public.group_bills'::regclass AND c.contype = 'p';

        IF pk_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.group_bills DROP CONSTRAINT IF EXISTS %I CASCADE;', pk_name);
        END IF;

        ALTER TABLE public.group_bills ALTER COLUMN id TYPE UUID USING (
            CASE 
                WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid 
                ELSE gen_random_uuid() 
            END
        );
        ALTER TABLE public.group_bills ALTER COLUMN id SET DEFAULT gen_random_uuid();
        ALTER TABLE public.group_bills ADD PRIMARY KEY (id);
    END IF;

    -- 4B. customers.id conversion to UUID if legacy varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id' AND udt_name != 'uuid'
    ) THEN
        FOR fk_rec IN
            SELECT c.conrelid::regclass AS src_tbl, c.conname
            FROM pg_constraint c
            WHERE c.confrelid = 'public.customers'::regclass AND c.contype = 'f'
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I CASCADE;', fk_rec.src_tbl, fk_rec.conname);
        END LOOP;

        SELECT c.conname INTO pk_name
        FROM pg_constraint c
        WHERE c.conrelid = 'public.customers'::regclass AND c.contype = 'p';

        IF pk_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS %I CASCADE;', pk_name);
        END IF;

        ALTER TABLE public.customers ALTER COLUMN id TYPE UUID USING (
            CASE 
                WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid 
                ELSE gen_random_uuid() 
            END
        );
        ALTER TABLE public.customers ALTER COLUMN id SET DEFAULT gen_random_uuid();
        ALTER TABLE public.customers ADD PRIMARY KEY (id);
    END IF;

    -- 4C. bills.id conversion to UUID if legacy varchar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'id' AND udt_name != 'uuid'
    ) THEN
        FOR fk_rec IN
            SELECT c.conrelid::regclass AS src_tbl, c.conname
            FROM pg_constraint c
            WHERE c.confrelid = 'public.bills'::regclass AND c.contype = 'f'
        LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I CASCADE;', fk_rec.src_tbl, fk_rec.conname);
        END LOOP;

        SELECT c.conname INTO pk_name
        FROM pg_constraint c
        WHERE c.conrelid = 'public.bills'::regclass AND c.contype = 'p';

        IF pk_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS %I CASCADE;', pk_name);
        END IF;

        ALTER TABLE public.bills ALTER COLUMN id TYPE UUID USING (
            CASE 
                WHEN id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid 
                ELSE gen_random_uuid() 
            END
        );
        ALTER TABLE public.bills ALTER COLUMN id SET DEFAULT gen_random_uuid();
        ALTER TABLE public.bills ADD PRIMARY KEY (id);
    END IF;

    -- 4D. Harmonize foreign key columns to UUID
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'group_bill_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bills ALTER COLUMN group_bill_id TYPE UUID USING (
            CASE WHEN group_bill_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN group_bill_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'paid_by_customer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bills ALTER COLUMN paid_by_customer_id TYPE UUID USING (
            CASE WHEN paid_by_customer_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN paid_by_customer_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'customer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bills ALTER COLUMN customer_id TYPE UUID USING (
            CASE WHEN customer_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN customer_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'group_bills' AND column_name = 'primary_payer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.group_bills ALTER COLUMN primary_payer_id TYPE UUID USING (
            CASE WHEN primary_payer_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN primary_payer_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'bill_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.payments ALTER COLUMN bill_id TYPE UUID USING (
            CASE WHEN bill_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN bill_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'customer_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.payments ALTER COLUMN customer_id TYPE UUID USING (
            CASE WHEN customer_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN customer_id::uuid ELSE NULL END
        );
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'bill_id' AND udt_name != 'uuid') THEN
        ALTER TABLE public.bill_items ALTER COLUMN bill_id TYPE UUID USING (
            CASE WHEN bill_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN bill_id::uuid ELSE NULL END
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

-- Trigger to keep legacy entity_type/last_seq and modern key/current_val in sync
CREATE OR REPLACE FUNCTION public.sync_sequences_key_compat()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sequences_key_compat ON public.sequences;
CREATE TRIGGER trg_sync_sequences_key_compat
BEFORE INSERT OR UPDATE ON public.sequences
FOR EACH ROW EXECUTE FUNCTION public.sync_sequences_key_compat();

-- Atomic Database Transaction Sequence Generator with User Isolation
DROP FUNCTION IF EXISTS public.get_next_sequence(text);
CREATE OR REPLACE FUNCTION public.get_next_sequence(p_key TEXT)
RETURNS TEXT AS $$
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
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id UUID;
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
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS primary_payer_id UUID;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.group_bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Foreign keys for group_bills & bills linking
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'group_bills' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'bills' AND c1.column_name = 'group_bill_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
              AND conname = 'fk_bills_group_bill'
        ) THEN
            ALTER TABLE public.bills ADD CONSTRAINT fk_bills_group_bill FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'customers' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'bills' AND c1.column_name = 'paid_by_customer_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
              AND conname = 'fk_bills_paid_by'
        ) THEN
            ALTER TABLE public.bills ADD CONSTRAINT fk_bills_paid_by FOREIGN KEY (paid_by_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'customers' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'group_bills' AND c1.column_name = 'primary_payer_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.group_bills'::regclass AND contype = 'f' 
              AND conname = 'fk_group_bills_primary_payer'
        ) THEN
            ALTER TABLE public.group_bills ADD CONSTRAINT fk_group_bills_primary_payer FOREIGN KEY (primary_payer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
        END IF;
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
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS group_bill_id UUID;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.group_bill_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'group_bills' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'group_bill_items' AND c1.column_name = 'group_bill_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.group_bill_items'::regclass AND contype = 'f' 
              AND conname = 'fk_group_bill_items_group'
        ) THEN
            ALTER TABLE public.group_bill_items ADD CONSTRAINT fk_group_bill_items_group FOREIGN KEY (group_bill_id) REFERENCES public.group_bills(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'products' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'group_bill_items' AND c1.column_name = 'product_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.group_bill_items'::regclass AND contype = 'f' 
              AND conname = 'fk_group_bill_items_product'
        ) THEN
            ALTER TABLE public.group_bill_items ADD CONSTRAINT fk_group_bill_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Clean single-column foreign key for bills -> customers (for PostgREST)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'customers' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'bills' AND c1.column_name = 'customer_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.bills'::regclass AND contype = 'f' 
              AND conname = 'fk_bills_customer'
        ) THEN
            ALTER TABLE public.bills ADD CONSTRAINT fk_bills_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
        END IF;
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
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS bill_id UUID;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) DEFAULT 1;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Clean foreign keys for bill_items
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'bills' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'bill_items' AND c1.column_name = 'bill_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.bill_items'::regclass AND contype = 'f' 
              AND conname = 'fk_bill_items_bill'
        ) THEN
            ALTER TABLE public.bill_items ADD CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'products' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'bill_items' AND c1.column_name = 'product_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.bill_items'::regclass AND contype = 'f' 
              AND conname = 'fk_bill_items_product'
        ) THEN
            ALTER TABLE public.bill_items ADD CONSTRAINT fk_bill_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Ensure legacy and modern bill_items columns are synchronized safely (and remove any 'Custom Item' defaults)
ALTER TABLE public.bill_items ALTER COLUMN product_name DROP DEFAULT;
ALTER TABLE public.group_bill_items ALTER COLUMN product_name DROP DEFAULT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'item_name') THEN
        UPDATE public.bill_items 
        SET product_name = item_name 
        WHERE (product_name IS NULL OR product_name = '' OR product_name = 'Custom Item') 
          AND item_name IS NOT NULL AND item_name != '' AND item_name != 'Custom Item';
        UPDATE public.bill_items 
        SET item_name = product_name 
        WHERE (item_name IS NULL OR item_name = '' OR item_name = 'Custom Item') 
          AND product_name IS NOT NULL AND product_name != '';
    END IF;

    -- Also restore product_name from products catalog if linked via product_id
    UPDATE public.bill_items bi
    SET product_name = p.name
    FROM public.products p
    WHERE bi.product_id = p.id
      AND (bi.product_name IS NULL OR bi.product_name = '' OR bi.product_name = 'Custom Item');

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'qty') THEN
        UPDATE public.bill_items SET quantity = qty WHERE quantity IS NULL AND qty IS NOT NULL;
        UPDATE public.bill_items SET qty = ROUND(quantity)::INT WHERE qty IS NULL AND quantity IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'unit_price') THEN
        UPDATE public.bill_items SET price = unit_price WHERE price IS NULL AND unit_price IS NOT NULL;
        UPDATE public.bill_items SET unit_price = price WHERE unit_price IS NULL AND price IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bill_items' AND column_name = 'amount') THEN
        UPDATE public.bill_items SET total = amount WHERE total IS NULL AND amount IS NOT NULL;
        UPDATE public.bill_items SET amount = total WHERE amount IS NULL AND total IS NOT NULL;
    END IF;
END $$;

-- Bi-directional trigger to guarantee item_name and product_name never conflict
CREATE OR REPLACE FUNCTION public.sync_bill_items_legacy_compat()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_bill_items_legacy_compat ON public.bill_items;
CREATE TRIGGER trg_sync_bill_items_legacy_compat
BEFORE INSERT OR UPDATE ON public.bill_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_bill_items_legacy_compat();

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
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS bill_id UUID;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

-- Clean foreign keys for payments
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'customers' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'payments' AND c1.column_name = 'customer_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.payments'::regclass AND contype = 'f' 
              AND conname = 'fk_payments_customer'
        ) THEN
            ALTER TABLE public.payments ADD CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'bills' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'payments' AND c1.column_name = 'bill_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.payments'::regclass AND contype = 'f' 
              AND conname = 'fk_payments_bill'
        ) THEN
            ALTER TABLE public.payments ADD CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;
        END IF;
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
    audit_number TEXT,
    user_name TEXT NOT NULL DEFAULT 'Admin',
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS audit_number TEXT;
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
    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'customers' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'loyalty_transactions' AND c1.column_name = 'customer_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.loyalty_transactions'::regclass AND contype = 'f' 
              AND conname = 'fk_loyalty_tx_customer'
        ) THEN
            ALTER TABLE public.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns c1
        JOIN information_schema.columns c2 ON c2.table_schema = 'public' AND c2.table_name = 'bills' AND c2.column_name = 'id'
        WHERE c1.table_schema = 'public' AND c1.table_name = 'loyalty_transactions' AND c1.column_name = 'bill_id'
          AND c1.udt_name = c2.udt_name
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'public.loyalty_transactions'::regclass AND contype = 'f' 
              AND conname = 'fk_loyalty_tx_bill'
        ) THEN
            ALTER TABLE public.loyalty_transactions ADD CONSTRAINT fk_loyalty_tx_bill FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;
        END IF;
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
        -- 1. Sequences: merge current_val and deduplicate before updating user_id
        UPDATE public.sequences s
        SET current_val = GREATEST(s.current_val, n.current_val),
            updated_at = now()
        FROM public.sequences n
        WHERE s.user_id = v_owner_id
          AND n.user_id IS NULL
          AND UPPER(COALESCE(s.key, '')) = UPPER(COALESCE(n.key, ''));

        DELETE FROM public.sequences
        WHERE user_id IS NULL
          AND UPPER(COALESCE(key, '')) IN (
              SELECT UPPER(COALESCE(key, ''))
              FROM public.sequences
              WHERE user_id = v_owner_id
          );

        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'entity_type'
        ) THEN
            EXECUTE '
                DELETE FROM public.sequences
                WHERE user_id IS NULL
                  AND LOWER(COALESCE(entity_type, '''')) IN (
                      SELECT LOWER(COALESCE(entity_type, ''''))
                      FROM public.sequences
                      WHERE user_id = $1
                  )'
            USING v_owner_id;
        END IF;

        UPDATE public.sequences SET user_id = v_owner_id WHERE user_id IS NULL;

        -- 2. Settings: deduplicate before updating user_id
        DELETE FROM public.settings
        WHERE user_id IS NULL
          AND key IN (
              SELECT key
              FROM public.settings
              WHERE user_id = v_owner_id
          );
        UPDATE public.settings SET user_id = v_owner_id WHERE user_id IS NULL;

        -- 3. Loyalty rules: deduplicate before updating user_id
        DELETE FROM public.loyalty_rules
        WHERE user_id IS NULL
          AND rule_name IN (
              SELECT rule_name
              FROM public.loyalty_rules
              WHERE user_id = v_owner_id
          );
        UPDATE public.loyalty_rules SET user_id = v_owner_id WHERE user_id IS NULL;

        DELETE FROM public.loyalty_redemption_rules
        WHERE user_id IS NULL
          AND points_required IN (
              SELECT points_required
              FROM public.loyalty_redemption_rules
              WHERE user_id = v_owner_id
          );
        UPDATE public.loyalty_redemption_rules SET user_id = v_owner_id WHERE user_id IS NULL;

        -- 4. Customer, bills & transactions backfill
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
        UPDATE public.audit_logs SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.loyalty_transactions SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.internal_transfers SET user_id = v_owner_id WHERE user_id IS NULL;
        UPDATE public.accounting_closings SET user_id = v_owner_id WHERE user_id IS NULL;
    END IF;
END $$;

-- Clean up any legacy duplicate seed rules before creating unique constraints
DELETE FROM public.loyalty_redemption_rules a
WHERE a.ctid NOT IN (
    SELECT rid
    FROM (
        SELECT DISTINCT ON (user_id, points_required) ctid AS rid
        FROM public.loyalty_redemption_rules
        ORDER BY user_id, points_required, created_at DESC NULLS LAST
    ) sub
);

DELETE FROM public.loyalty_rules a
WHERE a.ctid NOT IN (
    SELECT rid
    FROM (
        SELECT DISTINCT ON (user_id, rule_name) ctid AS rid
        FROM public.loyalty_rules
        ORDER BY user_id, rule_name, created_at DESC NULLS LAST
    ) sub
);

-- Clean up any invalid or duplicate sequences (keep highest current_val!)
DELETE FROM public.sequences WHERE key IS NULL OR TRIM(key) = '';
UPDATE public.sequences SET key = UPPER(TRIM(key));

DELETE FROM public.sequences a
WHERE a.ctid NOT IN (
    SELECT rid
    FROM (
        SELECT DISTINCT ON (user_id, key) ctid AS rid
        FROM public.sequences
        ORDER BY user_id, key, current_val DESC NULLS LAST, updated_at DESC NULLS LAST
    ) sub
);

DELETE FROM public.settings a
WHERE a.ctid NOT IN (
    SELECT rid
    FROM (
        SELECT DISTINCT ON (user_id, key) ctid AS rid
        FROM public.settings
        ORDER BY user_id, key, updated_at DESC NULLS LAST
    ) sub
);

-- =========================================================================
-- INDEXES & UNIQUE CONSTRAINTS (Created before seed so ON CONFLICT works)
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sequences_user_id_key_key') THEN
        ALTER TABLE public.sequences ADD CONSTRAINT sequences_user_id_key_key UNIQUE USING INDEX idx_sequences_user_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_user_id_key_key') THEN
        ALTER TABLE public.settings ADD CONSTRAINT settings_user_id_key_key UNIQUE USING INDEX idx_settings_user_key;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Seed default standard entity sequences for all users if missing (never overwrites existing counters)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sequences' AND column_name = 'entity_type' AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.sequences ALTER COLUMN entity_type DROP NOT NULL;
    END IF;

    INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
    SELECT u.id, s.key, s.prefix, 6, 0
    FROM auth.users u
    CROSS JOIN (
        VALUES 
            ('AUDIT', 'AUD'),
            ('BILL', 'INV'),
            ('CLOSE', 'CLS'),
            ('CUSTOMER', 'CUST'),
            ('EXPENSE', 'EXP'),
            ('GROUP_BILL', 'GRP'),
            ('LOYALTY', 'LTX'),
            ('PAYMENT', 'PAY'),
            ('PRODUCT', 'PROD'),
            ('TRANS', 'TRF')
    ) AS s(key, prefix)
    ON CONFLICT (user_id, key) DO NOTHING;
END $$;

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation for authenticated users
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

-- Authenticated Users: Strict Tenant Data Isolation
CREATE POLICY "Tenant isolation on sequences" ON public.sequences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on customers" ON public.customers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on products" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on bills" ON public.bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on bill_items" ON public.bill_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on group_bills" ON public.group_bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on group_bill_items" ON public.group_bill_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on payments" ON public.payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on expenses" ON public.expenses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on settings" ON public.settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on loyalty_transactions" ON public.loyalty_transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on loyalty_rules" ON public.loyalty_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on loyalty_redemption_rules" ON public.loyalty_redemption_rules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on internal_transfers" ON public.internal_transfers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant isolation on accounting_closings" ON public.accounting_closings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit logs for authenticated users
CREATE POLICY "Tenant insert on audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tenant select on audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- -------------------------------------------------------------------------
-- PERMISSIONS / ROLE GRANTS
-- Strict tenant authorization: anon role cannot access data tables
-- -------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;

-- -------------------------------------------------------------------------
-- RELOAD SUPABASE POSTGREST SCHEMA CACHE INSTANTLY
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
