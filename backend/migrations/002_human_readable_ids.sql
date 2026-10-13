-- Migration 002: Add human-readable sequence columns and backfill existing data
-- Format: BILL-0001, RC-0001 / WI-0001, PAY-0001, ADV-0001, EXP-0001, GRP-0001

-- 1. Bills
ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_number VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_bills_user_bill_number ON bills (user_id, bill_number);

-- 2. Customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_customers_user_customer_code ON customers (user_id, customer_code);

-- 3. Payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_payments_user_payment_number ON payments (user_id, payment_number);

-- 4. Advance Payments
ALTER TABLE advance_payments ADD COLUMN IF NOT EXISTS advance_number VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_advance_user_advance_number ON advance_payments (user_id, advance_number);

-- 5. Purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS expense_number VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_purchases_user_expense_number ON purchases (user_id, expense_number);

-- 6. Customer Groups
ALTER TABLE customer_groups ADD COLUMN IF NOT EXISTS group_code VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_groups_user_group_code ON customer_groups (user_id, group_code);

-- ── Historical Data Backfill ──────────────────────────────────────────────────

-- Backfill Bills: BILL-0001, BILL-0002... partitioned by user_id
WITH numbered_bills AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM bills
  WHERE bill_number IS NULL
)
UPDATE bills b
SET bill_number = 'BILL-' || LPAD(nb.rn::text, 4, '0')
FROM numbered_bills nb
WHERE b.id = nb.id AND b.user_id = nb.user_id;

-- Backfill Customers: RC-0001 for regular, WI-0001 for walk-in/random
WITH numbered_customers AS (
  SELECT id, user_id, type,
         ROW_NUMBER() OVER (PARTITION BY user_id, type ORDER BY created_at ASC, id ASC) AS rn
  FROM customers
  WHERE customer_code IS NULL OR (customer_code NOT LIKE 'RC-%' AND customer_code NOT LIKE 'WI-%')
)
UPDATE customers c
SET customer_code = (CASE WHEN nc.type = 'regular' THEN 'RC-' ELSE 'WI-' END) || LPAD(nc.rn::text, 4, '0')
FROM numbered_customers nc
WHERE c.id = nc.id AND c.user_id = nc.user_id;

-- Backfill Payments: PAY-0001, PAY-0002...
WITH numbered_payments AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date ASC, id ASC) AS rn
  FROM payments
  WHERE payment_number IS NULL
)
UPDATE payments p
SET payment_number = 'PAY-' || LPAD(np.rn::text, 4, '0')
FROM numbered_payments np
WHERE p.id = np.id AND p.user_id = np.user_id;

-- Backfill Advance Payments: ADV-0001, ADV-0002...
WITH numbered_advances AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM advance_payments
  WHERE advance_number IS NULL
)
UPDATE advance_payments a
SET advance_number = 'ADV-' || LPAD(na.rn::text, 4, '0')
FROM numbered_advances na
WHERE a.id = na.id AND a.user_id = na.user_id;

-- Backfill Purchases: EXP-0001, EXP-0002...
WITH numbered_purchases AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date ASC, id ASC) AS rn
  FROM purchases
  WHERE expense_number IS NULL
)
UPDATE purchases pr
SET expense_number = 'EXP-' || LPAD(np.rn::text, 4, '0')
FROM numbered_purchases np
WHERE pr.id = np.id AND pr.user_id = np.user_id;

-- Backfill Customer Groups: GRP-0001...
WITH numbered_groups AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS rn
  FROM customer_groups
  WHERE group_code IS NULL
)
UPDATE customer_groups cg
SET group_code = 'GRP-' || LPAD(ng.rn::text, 4, '0')
FROM numbered_groups ng
WHERE cg.id = ng.id AND cg.user_id = ng.user_id;

-- ── Auto-Sequencing BEFORE INSERT Triggers ─────────────────────────────────────

-- 1. Bills trigger
CREATE OR REPLACE FUNCTION set_bill_number()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  IF NEW.bill_number IS NULL OR NEW.bill_number = '' THEN
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(bill_number, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM bills
    WHERE user_id = NEW.user_id;

    NEW.bill_number := 'BILL-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_bill_number ON bills;
CREATE TRIGGER trg_set_bill_number
BEFORE INSERT ON bills
FOR EACH ROW
EXECUTE FUNCTION set_bill_number();

-- 2. Customers trigger
CREATE OR REPLACE FUNCTION set_customer_code()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
  prefix TEXT;
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    prefix := CASE WHEN NEW.type = 'regular' THEN 'RC-' ELSE 'WI-' END;
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(customer_code, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM customers
    WHERE user_id = NEW.user_id AND type = NEW.type;

    NEW.customer_code := prefix || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_customer_code ON customers;
CREATE TRIGGER trg_set_customer_code
BEFORE INSERT ON customers
FOR EACH ROW
EXECUTE FUNCTION set_customer_code();

-- 3. Payments trigger
CREATE OR REPLACE FUNCTION set_payment_number()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  IF NEW.payment_number IS NULL OR NEW.payment_number = '' THEN
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(payment_number, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM payments
    WHERE user_id = NEW.user_id;

    NEW.payment_number := 'PAY-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_payment_number ON payments;
CREATE TRIGGER trg_set_payment_number
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION set_payment_number();

-- 4. Advance Payments trigger
CREATE OR REPLACE FUNCTION set_advance_number()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  IF NEW.advance_number IS NULL OR NEW.advance_number = '' THEN
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(advance_number, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM advance_payments
    WHERE user_id = NEW.user_id;

    NEW.advance_number := 'ADV-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_advance_number ON advance_payments;
CREATE TRIGGER trg_set_advance_number
BEFORE INSERT ON advance_payments
FOR EACH ROW
EXECUTE FUNCTION set_advance_number();

-- 5. Purchases trigger
CREATE OR REPLACE FUNCTION set_expense_number()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  IF NEW.expense_number IS NULL OR NEW.expense_number = '' THEN
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(expense_number, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM purchases
    WHERE user_id = NEW.user_id;

    NEW.expense_number := 'EXP-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_expense_number ON purchases;
CREATE TRIGGER trg_set_expense_number
BEFORE INSERT ON purchases
FOR EACH ROW
EXECUTE FUNCTION set_expense_number();

-- 6. Customer Groups trigger
CREATE OR REPLACE FUNCTION set_group_code()
RETURNS TRIGGER AS $$
DECLARE
  max_num INT;
BEGIN
  IF NEW.group_code IS NULL OR NEW.group_code = '' THEN
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(group_code, '[^0-9]', '', 'g'), '') AS INT)), 0)
    INTO max_num
    FROM customer_groups
    WHERE user_id = NEW.user_id;

    NEW.group_code := 'GRP-' || LPAD((max_num + 1)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_group_code ON customer_groups;
CREATE TRIGGER trg_set_group_code
BEFORE INSERT ON customer_groups
FOR EACH ROW
EXECUTE FUNCTION set_group_code();

