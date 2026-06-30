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
  settings JSONB DEFAULT '{}'::jsonb,
  id_counters JSONB DEFAULT '{}'::jsonb,
  advance_payments JSONB DEFAULT '[]'::jsonb,
  recurring_bills JSONB DEFAULT '[]'::jsonb,
  customer_groups JSONB DEFAULT '[]'::jsonb,
  group_bills JSONB DEFAULT '[]'::jsonb,
  deleted_payments JSONB DEFAULT '[]'::jsonb,
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
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);
CREATE INDEX idx_purchase_date ON purchases (date);
CREATE INDEX idx_purchase_category ON purchases (category);

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

-- ── Enable Realtime Replication ──────────────────────────────────────────────
-- Add public tables to the supabase_realtime publication to enable broadcast events
ALTER PUBLICATION supabase_realtime ADD TABLE 
  business_profile, 
  customers, 
  inventory_items, 
  bills, 
  bill_items, 
  payments, 
  purchases, 
  audit_log;

-- ── Grant Table Permissions to Supabase Roles ────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, anon, service_role;


