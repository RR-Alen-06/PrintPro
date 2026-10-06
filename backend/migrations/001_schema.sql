-- PrintPro PostgreSQL Database Schema
-- All monetary values are in Indian Rupees (INR)

-- ── Custom Types/ENUMs ────────────────────────────────────────────────────────
CREATE TYPE customer_type AS ENUM ('regular', 'random');
CREATE TYPE discount_type AS ENUM ('percent', 'flat');
CREATE TYPE bill_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE print_type AS ENUM ('color', 'bw');
CREATE TYPE sides_type AS ENUM ('single', 'double');
CREATE TYPE payment_type AS ENUM ('full', 'partial');

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE business_profile (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name VARCHAR(100) DEFAULT '',
  owner_name VARCHAR(100) DEFAULT '',
  phone VARCHAR(15) DEFAULT '',
  address TEXT,
  gstin VARCHAR(20) DEFAULT '',
  logo_path VARCHAR(255) DEFAULT '',
  upi_id VARCHAR(100) DEFAULT '',
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

CREATE TABLE customers (
  id VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type customer_type NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(15) DEFAULT '',
  email VARCHAR(100) DEFAULT '',
  address TEXT,
  credit_balance DECIMAL(10,2) DEFAULT 0.00,
  credit_limit DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX idx_customer_type ON customers (type);
CREATE INDEX idx_customer_name ON customers (name);
CREATE INDEX idx_customer_phone ON customers (phone);

CREATE TABLE inventory_items (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  color_single DECIMAL(10,2) DEFAULT 0.00,
  color_double DECIMAL(10,2) DEFAULT 0.00,
  bw_single DECIMAL(10,2) DEFAULT 0.00,
  bw_double DECIMAL(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  low_stock_alert INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_item_name UNIQUE (user_id, name)
);

CREATE TABLE bills (
  id VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
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
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (customer_id, user_id) REFERENCES customers(id, user_id) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_bill_customer ON bills (customer_id);
CREATE INDEX idx_bill_status ON bills (status);
CREATE INDEX idx_bill_date ON bills (date);
CREATE INDEX idx_bill_deleted ON bills (deleted_at);

CREATE TABLE bill_items (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id VARCHAR(20) NOT NULL,
  item_name VARCHAR(50) NOT NULL,
  print_type print_type NOT NULL,
  sides sides_type NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (bill_id, user_id) REFERENCES bills(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_billitem_bill ON bill_items (bill_id);

CREATE TABLE payments (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id VARCHAR(20) NOT NULL,
  customer_id VARCHAR(20) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  cash_amount DECIMAL(10,2) DEFAULT 0.00,
  upi_amount DECIMAL(10,2) DEFAULT 0.00,
  total_paid DECIMAL(10,2) NOT NULL,
  payment_type payment_type NOT NULL,
  notes VARCHAR(255) DEFAULT '',
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (bill_id, user_id) REFERENCES bills(id, user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (customer_id, user_id) REFERENCES customers(id, user_id) ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX idx_payment_bill ON payments (bill_id);
CREATE INDEX idx_payment_customer ON payments (customer_id);
CREATE INDEX idx_payment_date ON payments (date);

CREATE TABLE purchases (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  qty INT DEFAULT 0,
  unit_cost DECIMAL(10,2) DEFAULT 0.00,
  total DECIMAL(10,2) DEFAULT 0.00,
  vendor_name VARCHAR(100) DEFAULT '',
  payment_method VARCHAR(20) DEFAULT 'cash',
  upi_ref VARCHAR(100) DEFAULT '',
  session_id INT DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX idx_purchase_date ON purchases (date);
CREATE INDEX idx_purchase_category ON purchases (category);
CREATE INDEX idx_purchase_vendor ON purchases (vendor_name);

CREATE TABLE audit_log (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id VARCHAR(30) NOT NULL,
  old_value JSONB DEFAULT NULL,
  new_value JSONB DEFAULT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_log (action);
CREATE INDEX idx_audit_timestamp ON audit_log (timestamp);

-- ── Triggers for updated_at columns ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customer_modtime BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bill_modtime BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Trigger for automatic user provisioning ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Provision default business profile for new merchant
  INSERT INTO public.business_profile (user_id, shop_name, owner_name, phone, address, gstin, logo_path, upi_id)
  VALUES (NEW.id, '', '', '', '', '', '', '');

  -- Provision default inventory items for new merchant
  INSERT INTO public.inventory_items (user_id, name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert)
  VALUES 
    (NEW.id, 'A4', 10.00, 18.00, 3.00, 5.00, 5000, 50),
    (NEW.id, 'A5', 7.00, 12.00, 2.00, 3.50, 3000, 50),
    (NEW.id, 'Letter', 12.00, 20.00, 4.00, 7.00, 2000, 50),
    (NEW.id, 'Legal', 15.00, 25.00, 5.00, 8.00, 1000, 50);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Enable Row-Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can manage their own business profile" ON business_profile
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own customers" ON customers
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own inventory items" ON inventory_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own bills" ON bills
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own bill items" ON bill_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own payments" ON payments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own purchases" ON purchases
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own audit logs" ON audit_log
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- ── Schema Additions & Enhancements (Migration 002) ──────────────────────────
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Custom Types / ENUM Alterations ────────────────────────────────────────
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'refund';

-- ── 2. Column Additions to Existing Tables ───────────────────────────────────
-- Customers: Add loyalty points tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points INT DEFAULT 0;

-- Payments: Add refund flag, soft-deletion timestamp, and cash session linkage
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS session_id INT DEFAULT NULL;

-- ── 3. New Tables ─────────────────────────────────────────────────────────────

-- 3.1 Loyalty Settings — Merchant-level tier config and redeem options
-- Note: Uses composite PK (id, user_id) for RLS/orm consistency + UNIQUE(user_id) for 1:1 merchant singleton & UPSERT target
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  points_per_rupee DECIMAL(10,4) DEFAULT 1.0,
  rupee_per_point DECIMAL(10,4) DEFAULT 0.1,
  min_points_redeem INT DEFAULT 100,
  tier_config JSONB DEFAULT '{}'::jsonb,
  redeem_options JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_loyalty_settings UNIQUE (user_id)
);

-- 3.2 Loyalty Events — Per-customer point earn/redeem/manual/expire history
CREATE TABLE IF NOT EXISTS loyalty_events (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id VARCHAR(20) NOT NULL,
  points INT NOT NULL DEFAULT 0,
  event_type VARCHAR(20) NOT NULL, -- 'earn', 'redeem', 'manual', 'expire'
  bill_id VARCHAR(20) DEFAULT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (customer_id, user_id) REFERENCES customers(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_customer ON loyalty_events (customer_id, user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_bill ON loyalty_events (bill_id, user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_type ON loyalty_events (event_type);

-- 3.3 Promo Codes — Owner-managed codes with limits and dates
CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'flat',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  min_bill_amount DECIMAL(10,2) DEFAULT 0.00,
  max_discount DECIMAL(10,2) DEFAULT NULL,
  usage_limit INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  max_uses_per_customer INT DEFAULT 1,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_promo_code UNIQUE (user_id, code)
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes (code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes (is_active);

-- 3.4 Promo Uses — Per-bill, per-customer usage tracking
CREATE TABLE IF NOT EXISTS promo_uses (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code_id INT NOT NULL,
  bill_id VARCHAR(20) DEFAULT NULL,
  customer_id VARCHAR(20) DEFAULT NULL,
  discount_applied DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (promo_code_id, user_id) REFERENCES promo_codes(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_promo_uses_code ON promo_uses (promo_code_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_bill ON promo_uses (bill_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_customer ON promo_uses (customer_id, user_id);

-- 3.5 Advance Payments — Advance deposits, returns, and applications
CREATE TABLE IF NOT EXISTS advance_payments (
  id VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id VARCHAR(20) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(20) DEFAULT 'cash',
  type VARCHAR(20) NOT NULL DEFAULT 'deposit', -- 'deposit', 'applied', 'refunded', 'return'
  bill_id VARCHAR(20) DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (customer_id, user_id) REFERENCES customers(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_advance_customer ON advance_payments (customer_id, user_id);
CREATE INDEX IF NOT EXISTS idx_advance_date ON advance_payments (date);

-- 3.6 Customer Groups — Group definitions with member IDs
CREATE TABLE IF NOT EXISTS customer_groups (
  id VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  member_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_groups_name ON customer_groups (name);

-- 3.7 Group Bills — Group bill records with per-member payment tracking
CREATE TABLE IF NOT EXISTS group_bills (
  id VARCHAR(20) NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id VARCHAR(20) NOT NULL,
  title VARCHAR(150) DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status bill_status DEFAULT 'unpaid',
  member_shares JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (group_id, user_id) REFERENCES customer_groups(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_group_bills_group ON group_bills (group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_date ON group_bills (date);

-- 3.8 Cash Sessions — Cash register open/close sessions
CREATE TABLE IF NOT EXISTS cash_sessions (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ DEFAULT NULL,
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  closing_cash DECIMAL(10,2) DEFAULT NULL,
  expected_cash DECIMAL(10,2) DEFAULT NULL,
  discrepancy DECIMAL(10,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'
  notes TEXT DEFAULT '',
  PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions (status);

-- FK constraint on payments table linking to cash_sessions
-- Note: Uses composite FK (session_id, user_id) referencing cash_sessions(id, user_id).
-- session_id is nullable (DEFAULT NULL); unassociated or pre-session payments have session_id = NULL
-- and are window-queried via `date >= opened_at` in cashSessions routes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_payment_session'
  ) THEN
    ALTER TABLE payments
    ADD CONSTRAINT fk_payment_session
    FOREIGN KEY (session_id, user_id) REFERENCES cash_sessions(id, user_id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_payment_session ON payments (session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_payment_is_refund ON payments (is_refund);
CREATE INDEX IF NOT EXISTS idx_payment_deleted ON payments (deleted_at);

-- 3.9 UPI Transactions — Per-UPI-payment reference tracking
CREATE TABLE IF NOT EXISTS upi_transactions (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id INT DEFAULT NULL,
  bill_id VARCHAR(20) DEFAULT NULL,
  customer_id VARCHAR(20) DEFAULT NULL,
  upi_id VARCHAR(100) DEFAULT '',
  upi_ref VARCHAR(100) DEFAULT '',
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'success', -- 'success', 'pending', 'failed'
  date TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_upi_tx_payment ON upi_transactions (payment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_upi_tx_bill ON upi_transactions (bill_id, user_id);
CREATE INDEX IF NOT EXISTS idx_upi_tx_ref ON upi_transactions (upi_ref);

-- 3.10 User Settings — Merchant settings persisted in cloud
-- Note: Uses composite PK (id, user_id) for RLS consistency + UNIQUE(user_id) for 1:1 merchant singleton & UPSERT target
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- ── 4. Enable Row-Level Security (RLS) on New Tables ─────────────────────────
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE upi_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies for New Tables ───────────────────────────────────────────
CREATE POLICY "Users can manage their own loyalty settings" ON loyalty_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own loyalty events" ON loyalty_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own promo codes" ON promo_codes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own promo uses" ON promo_uses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own advance payments" ON advance_payments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own customer groups" ON customer_groups
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own group bills" ON group_bills
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cash sessions" ON cash_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own upi transactions" ON upi_transactions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own user settings" ON user_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 6. Extended handle_new_user() Trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Provision default business profile for new merchant
  INSERT INTO public.business_profile (user_id, shop_name, owner_name, phone, address, gstin, logo_path, upi_id)
  VALUES (NEW.id, '', '', '', '', '', '', '')
  ON CONFLICT (user_id) DO NOTHING;

  -- Provision default inventory items for new merchant
  INSERT INTO public.inventory_items (user_id, name, color_single, color_double, bw_single, bw_double, stock, low_stock_alert)
  VALUES 
    (NEW.id, 'A4', 10.00, 18.00, 3.00, 5.00, 5000, 50),
    (NEW.id, 'A5', 7.00, 12.00, 2.00, 3.50, 3000, 50),
    (NEW.id, 'Letter', 12.00, 20.00, 4.00, 7.00, 2000, 50),
    (NEW.id, 'Legal', 15.00, 25.00, 5.00, 8.00, 1000, 50)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Provision default loyalty settings
  INSERT INTO public.loyalty_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Provision default user settings
  INSERT INTO public.user_settings (user_id, settings)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

