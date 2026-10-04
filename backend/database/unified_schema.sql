-- ============================================================================
-- PrintPro Unified Master PostgreSQL Schema
-- All monetary values are in Indian Rupees (INR)
-- Multi-tenant Row-Level Security (RLS) enabled for all tables
-- Safe & Idempotent: Can be executed on fresh installs and existing databases
-- ============================================================================

-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 2. CUSTOM ENUMS & TYPES ───────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE customer_type AS ENUM ('regular', 'random');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE discount_type AS ENUM ('percent', 'flat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bill_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE print_type AS ENUM ('color', 'bw');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sides_type AS ENUM ('single', 'double');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('full', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. TABLES ─────────────────────────────────────────────────────────────────

-- Business Profile (Shop configuration, branding, and JSONB store)
CREATE TABLE IF NOT EXISTS business_profile (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name VARCHAR(100) DEFAULT '',
  owner_name VARCHAR(100) DEFAULT '',
  phone VARCHAR(15) DEFAULT '',
  address TEXT,
  gstin VARCHAR(20) DEFAULT '',
  logo_path VARCHAR(255) DEFAULT '',
  upi_id VARCHAR(100) DEFAULT '',
  advance_payments JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Customers Directory
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code VARCHAR(30),
  type customer_type NOT NULL DEFAULT 'regular',
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) DEFAULT '',
  email VARCHAR(100) DEFAULT '',
  address TEXT,
  credit_balance DECIMAL(10,2) DEFAULT 0.00,
  credit_limit DECIMAL(10,2) DEFAULT 0.00,
  advance_balance DECIMAL(10,2) DEFAULT 0.00,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  balance_due DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory & Stock Catalog
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  category VARCHAR(100) DEFAULT '',
  sku VARCHAR(100) DEFAULT '',
  color_single DECIMAL(10,2) DEFAULT 0.00,
  color_double DECIMAL(10,2) DEFAULT 0.00,
  bw_single DECIMAL(10,2) DEFAULT 0.00,
  bw_double DECIMAL(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  low_stock_alert INT DEFAULT 0,
  attributes JSONB DEFAULT '{}'::jsonb,
  pricing_tiers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_item_name UNIQUE (user_id, name)
);

-- Invoices & Bills
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(30),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT NULL,
  subtotal DECIMAL(10,2) DEFAULT 0.00,
  discount_type discount_type DEFAULT 'flat',
  discount_value DECIMAL(10,2) DEFAULT 0.00,
  gst_percent DECIMAL(5,2) DEFAULT 0.00,
  gst_amount DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  amount_paid DECIMAL(10,2) DEFAULT 0.00,
  balance DECIMAL(10,2) DEFAULT 0.00,
  status bill_status DEFAULT 'unpaid',
  notes TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  group_id UUID DEFAULT NULL,
  group_name VARCHAR(100) DEFAULT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill Line Items
CREATE TABLE IF NOT EXISTS bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  print_type print_type NOT NULL DEFAULT 'bw',
  sides sides_type NOT NULL DEFAULT 'single',
  qty INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments & Tender Tracking
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  payment_code VARCHAR(30),
  date TIMESTAMPTZ DEFAULT NOW(),
  cash_amount DECIMAL(10,2) DEFAULT 0.00,
  upi_amount DECIMAL(10,2) DEFAULT 0.00,
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_type payment_type NOT NULL DEFAULT 'partial',
  notes VARCHAR(255) DEFAULT '',
  unallocated_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases / Expenses Catalog
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_code VARCHAR(30),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT 'General',
  qty INT NOT NULL DEFAULT 1,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(255) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Invoices
CREATE TABLE IF NOT EXISTS group_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_name VARCHAR(100) NOT NULL,
  customer_ids JSONB DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10,2) DEFAULT 0.00,
  balance_amount DECIMAL(10,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Settlement Payments
CREATE TABLE IF NOT EXISTS group_settlement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES group_bills(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promo Codes & Discounts
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'flat',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  min_order_amount DECIMAL(10,2) DEFAULT 0.00,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  times_used INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_promo_code UNIQUE (user_id, code)
);

-- Tenant-Scoped Sequential Counters
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type VARCHAR(30) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  last_seq INT NOT NULL DEFAULT 0,
  padding INT NOT NULL DEFAULT 4,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_entity_sequence UNIQUE (user_id, entity_type)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. BACKWARD COMPATIBILITY COLUMN ENSURERS ─────────────────────────────────
-- Guarantees older databases receive missing columns without error
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS advance_payments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(30);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS advance_balance DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE bills ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_code VARCHAR(30);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS unallocated_amount DECIMAL(10,2) DEFAULT 0.00;

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS expense_code VARCHAR(30);

-- ── 4B. INVOICE DEDUPLICATION & PREFIX STANDARDIZATION ─────────────────────────
-- Soft-deletes duplicate legacy BILLxxxx records if an equivalent INV-xxxxxx exists
UPDATE bills
SET deleted_at = NOW()
WHERE id IN (
  SELECT b_legacy.id
  FROM bills b_legacy
  JOIN bills b_canonical ON b_legacy.customer_id = b_canonical.customer_id
    AND b_legacy.user_id = b_canonical.user_id
    AND b_legacy.total = b_canonical.total
    AND b_legacy.id <> b_canonical.id
  WHERE (b_legacy.invoice_number ILIKE 'BILL%' OR b_legacy.invoice_number ILIKE '#BILL%')
    AND (b_canonical.invoice_number ILIKE 'INV-%' OR b_canonical.invoice_number ILIKE '#INV-%')
    AND b_legacy.deleted_at IS NULL
    AND b_canonical.deleted_at IS NULL
    AND ABS(EXTRACT(EPOCH FROM (b_legacy.created_at - b_canonical.created_at))) < 3600
);

-- Standardize remaining BILLxxxx records to INV-00000X format
UPDATE bills
SET invoice_number = 'INV-' || LPAD(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g'), 6, '0')
WHERE (invoice_number ILIKE 'BILL%' OR invoice_number ILIKE '#BILL%')
  AND deleted_at IS NULL
  AND REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') <> '';

-- Clean leading '#' from invoice numbers
UPDATE bills
SET invoice_number = REGEXP_REPLACE(invoice_number, '^#+', '')
WHERE invoice_number LIKE '#%';

-- ── 5. INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers (user_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers (user_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

CREATE INDEX IF NOT EXISTS idx_bills_user ON bills (user_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills (customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_invoice_num ON bills (user_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills (date);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status);
CREATE INDEX IF NOT EXISTS idx_bills_deleted ON bills (deleted_at);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items (bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_user ON bill_items (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments (bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_code ON payments (user_id, payment_code);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (date);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_code ON purchases (user_id, expense_code);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases (date);

CREATE INDEX IF NOT EXISTS idx_group_bills_user ON group_bills (user_id);
CREATE INDEX IF NOT EXISTS idx_group_settlement_user ON group_settlement_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_lookup ON sequences (user_id, entity_type);

-- ── 6. COMPATIBILITY VIEW: expenses <-> purchases ─────────────────────────────
-- Enables seamless SELECT, INSERT, UPDATE, DELETE on 'expenses' for legacy code
CREATE OR REPLACE VIEW expenses AS SELECT * FROM purchases;

CREATE OR REPLACE FUNCTION trg_expenses_view_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO purchases (id, user_id, expense_code, date, item_name, category, qty, unit_cost, total, notes, created_at, updated_at)
  VALUES (
    COALESCE(NEW.id, gen_random_uuid()),
    COALESCE(NEW.user_id, auth.uid()),
    NEW.expense_code,
    COALESCE(NEW.date, CURRENT_DATE),
    NEW.item_name,
    COALESCE(NEW.category, 'General'),
    COALESCE(NEW.qty, 1),
    COALESCE(NEW.unit_cost, 0.00),
    COALESCE(NEW.total, 0.00),
    COALESCE(NEW.notes, ''),
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  ) RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_insert_trg ON expenses;
CREATE TRIGGER expenses_insert_trg
INSTEAD OF INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_expenses_view_insert();

CREATE OR REPLACE FUNCTION trg_expenses_view_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchases
  SET date = NEW.date,
      expense_code = NEW.expense_code,
      item_name = NEW.item_name,
      category = NEW.category,
      qty = NEW.qty,
      unit_cost = NEW.unit_cost,
      total = NEW.total,
      notes = NEW.notes,
      updated_at = NOW()
  WHERE id = OLD.id AND user_id = OLD.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_update_trg ON expenses;
CREATE TRIGGER expenses_update_trg
INSTEAD OF UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_expenses_view_update();

CREATE OR REPLACE FUNCTION trg_expenses_view_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM purchases WHERE id = OLD.id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expenses_delete_trg ON expenses;
CREATE TRIGGER expenses_delete_trg
INSTEAD OF DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION trg_expenses_view_delete();

-- ── 7. ATOMIC SEQUENTIAL ID ENGINE ────────────────────────────────────────────

-- Core function to fetch and increment next tenant sequence
CREATE OR REPLACE FUNCTION get_next_sequence_code(
  p_user_id UUID,
  p_entity_type TEXT,
  p_prefix TEXT,
  p_padding INT DEFAULT 4
) RETURNS TEXT AS $$
DECLARE
  v_seq INT;
BEGIN
  INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
  VALUES (p_user_id, p_entity_type, p_prefix, 1, p_padding, NOW())
  ON CONFLICT (user_id, entity_type)
  DO UPDATE SET
    last_seq = sequences.last_seq + 1,
    updated_at = NOW()
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '-' || LPAD(v_seq::text, p_padding, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger: Customer Code Auto-Assignment
CREATE OR REPLACE FUNCTION trg_assign_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL OR trim(NEW.customer_code) = '' OR NEW.customer_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' THEN
    NEW.customer_code := get_next_sequence_code(NEW.user_id, 'customer', 'CUS', 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_customer_code_trg ON customers;
CREATE TRIGGER assign_customer_code_trg
BEFORE INSERT ON customers
FOR EACH ROW EXECUTE FUNCTION trg_assign_customer_code();

-- Trigger: Bill Invoice Number Auto-Assignment
CREATE OR REPLACE FUNCTION trg_assign_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR trim(NEW.invoice_number) = '' OR NEW.invoice_number ~* '^[0-9a-f]{8}-[0-9a-f]{4}' THEN
    NEW.invoice_number := get_next_sequence_code(NEW.user_id, 'bill', 'INV', 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_invoice_number_trg ON bills;
CREATE TRIGGER assign_invoice_number_trg
BEFORE INSERT ON bills
FOR EACH ROW EXECUTE FUNCTION trg_assign_invoice_number();

-- Trigger: Payment Code Auto-Assignment
CREATE OR REPLACE FUNCTION trg_assign_payment_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_code IS NULL OR trim(NEW.payment_code) = '' OR NEW.payment_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' THEN
    NEW.payment_code := get_next_sequence_code(NEW.user_id, 'payment', 'PAY', 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_payment_code_trg ON payments;
CREATE TRIGGER assign_payment_code_trg
BEFORE INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION trg_assign_payment_code();

-- Trigger: Expense Code Auto-Assignment
CREATE OR REPLACE FUNCTION trg_assign_expense_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expense_code IS NULL OR trim(NEW.expense_code) = '' OR NEW.expense_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' THEN
    NEW.expense_code := get_next_sequence_code(NEW.user_id, 'expense', 'EXP', 4);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_expense_code_trg ON purchases;
CREATE TRIGGER assign_expense_code_trg
BEFORE INSERT ON purchases
FOR EACH ROW EXECUTE FUNCTION trg_assign_expense_code();

-- ── 8. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────────────
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_settlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'business_profile',
    'customers',
    'inventory_items',
    'bills',
    'bill_items',
    'payments',
    'purchases',
    'group_bills',
    'group_settlement_payments',
    'promo_codes',
    'sequences',
    'audit_log'
  ]) LOOP
    -- Drop existing user isolation policy if present
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_%s" ON %I', t, t);
    
    -- Create comprehensive all-operations policy
    EXECUTE format('
      CREATE POLICY "tenant_isolation_%s" ON %I
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)
    ', t, t);
  END LOOP;
END $$;

-- ── 9. CHRONOLOGICAL BACKFILL FOR EXISTING LEGACY DATA ────────────────────────
DO $$
DECLARE
  rec RECORD;
  idx INT;
  curr_user UUID;
BEGIN
  -- 1. Backfill Customers
  FOR curr_user IN SELECT DISTINCT user_id FROM customers WHERE customer_code IS NULL OR customer_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' LOOP
    idx := 1;
    FOR rec IN SELECT id FROM customers WHERE user_id = curr_user ORDER BY created_at ASC LOOP
      UPDATE customers SET customer_code = 'CUS-' || LPAD(idx::text, 4, '0') WHERE id = rec.id;
      idx := idx + 1;
    END LOOP;
    INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
    VALUES (curr_user, 'customer', 'CUS', idx - 1, 4, NOW())
    ON CONFLICT (user_id, entity_type)
    DO UPDATE SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq);
  END LOOP;

  -- 2. Backfill Bills
  FOR curr_user IN SELECT DISTINCT user_id FROM bills WHERE invoice_number IS NULL OR invoice_number ~* '^[0-9a-f]{8}-[0-9a-f]{4}' LOOP
    idx := 1;
    FOR rec IN SELECT id FROM bills WHERE user_id = curr_user ORDER BY created_at ASC LOOP
      UPDATE bills SET invoice_number = 'INV-' || LPAD(idx::text, 4, '0') WHERE id = rec.id;
      idx := idx + 1;
    END LOOP;
    INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
    VALUES (curr_user, 'bill', 'INV', idx - 1, 4, NOW())
    ON CONFLICT (user_id, entity_type)
    DO UPDATE SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq);
  END LOOP;

  -- 3. Backfill Payments
  FOR curr_user IN SELECT DISTINCT user_id FROM payments WHERE payment_code IS NULL OR payment_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' LOOP
    idx := 1;
    FOR rec IN SELECT id FROM payments WHERE user_id = curr_user ORDER BY created_at ASC LOOP
      UPDATE payments SET payment_code = 'PAY-' || LPAD(idx::text, 4, '0') WHERE id = rec.id;
      idx := idx + 1;
    END LOOP;
    INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
    VALUES (curr_user, 'payment', 'PAY', idx - 1, 4, NOW())
    ON CONFLICT (user_id, entity_type)
    DO UPDATE SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq);
  END LOOP;

  -- 4. Backfill Purchases / Expenses
  FOR curr_user IN SELECT DISTINCT user_id FROM purchases WHERE expense_code IS NULL OR expense_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}' LOOP
    idx := 1;
    FOR rec IN SELECT id FROM purchases WHERE user_id = curr_user ORDER BY created_at ASC LOOP
      UPDATE purchases SET expense_code = 'EXP-' || LPAD(idx::text, 4, '0') WHERE id = rec.id;
      idx := idx + 1;
    END LOOP;
    INSERT INTO sequences (user_id, entity_type, prefix, last_seq, padding, updated_at)
    VALUES (curr_user, 'expense', 'EXP', idx - 1, 4, NOW())
    ON CONFLICT (user_id, entity_type)
    DO UPDATE SET last_seq = GREATEST(sequences.last_seq, EXCLUDED.last_seq);
  END LOOP;
END $$;

-- ============================================================================
-- End of PrintPro Unified Schema
-- ============================================================================
