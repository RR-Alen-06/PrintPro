-- Migration 002: Data-Preserving UUID & Human-Readable Invoice/Customer Code Migration
BEGIN;

-- ── 1. Enable UUID Extension ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. Customers Table Migration ──────────────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(30);
UPDATE customers SET customer_code = id WHERE customer_code IS NULL;

-- ── 3. Bills Table Migration ──────────────────────────────────────────────────
ALTER TABLE bills ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE bills ADD COLUMN IF NOT EXISTS new_customer_id UUID;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);
UPDATE bills SET invoice_number = id WHERE invoice_number IS NULL;

UPDATE bills b
SET new_customer_id = c.new_id
FROM customers c
WHERE b.customer_id = c.id AND b.user_id = c.user_id AND b.new_customer_id IS NULL;

-- ── 4. Bill Items Table Migration ────────────────────────────────────────────
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS new_bill_id UUID;

UPDATE bill_items bi
SET new_bill_id = b.new_id
FROM bills b
WHERE bi.bill_id = b.id AND bi.user_id = b.user_id AND bi.new_bill_id IS NULL;

-- ── 5. Payments Table Migration ─────────────────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS new_bill_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS new_customer_id UUID;

UPDATE payments p
SET new_bill_id = b.new_id
FROM bills b
WHERE p.bill_id = b.id AND p.user_id = b.user_id AND p.new_bill_id IS NULL;

UPDATE payments p
SET new_customer_id = c.new_id
FROM customers c
WHERE p.customer_id = c.id AND p.user_id = c.user_id AND p.new_customer_id IS NULL;

-- ── 5.5. Comprehensive Remap of Embedded IDs in business_profile Data ──────────
DO $$
DECLARE
  profile_rec RECORD;
  updated_advances JSONB;
BEGIN
  -- Safely check if advance_payments column exists on business_profile table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='business_profile' AND column_name='advance_payments'
  ) THEN
    FOR profile_rec IN SELECT user_id, advance_payments FROM business_profile LOOP
      IF profile_rec.advance_payments IS NOT NULL AND jsonb_array_length(profile_rec.advance_payments::jsonb) > 0 THEN
        SELECT jsonb_agg(
          jsonb_set(adv, '{customerId}', to_jsonb(COALESCE(c.new_id::text, adv->>'customerId')))
        ) INTO updated_advances
        FROM jsonb_array_elements(profile_rec.advance_payments::jsonb) adv
        LEFT JOIN customers c ON c.id = (adv->>'customerId') AND c.user_id = profile_rec.user_id;

        UPDATE business_profile SET advance_payments = updated_advances WHERE user_id = profile_rec.user_id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- ── 6. Purchases Table Migration ────────────────────────────────────────────
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();

-- ── 7. Swap Primary Keys & Foreign Key Constraints ───────────────────────────
ALTER TABLE bill_items DROP COLUMN IF EXISTS bill_id;
ALTER TABLE bill_items RENAME COLUMN new_bill_id TO bill_id;
ALTER TABLE bill_items ALTER COLUMN bill_id SET NOT NULL;

ALTER TABLE payments DROP COLUMN IF EXISTS bill_id;
ALTER TABLE payments DROP COLUMN IF EXISTS customer_id;
ALTER TABLE payments RENAME COLUMN new_bill_id TO bill_id;
ALTER TABLE payments RENAME COLUMN new_customer_id TO customer_id;

ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_pkey CASCADE;
ALTER TABLE bills DROP COLUMN IF EXISTS id;
ALTER TABLE bills DROP COLUMN IF EXISTS customer_id;
ALTER TABLE bills RENAME COLUMN new_id TO id;
ALTER TABLE bills RENAME COLUMN new_customer_id TO customer_id;
ALTER TABLE bills ADD PRIMARY KEY (id, user_id);
ALTER TABLE bills ALTER COLUMN customer_id SET NOT NULL;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_pkey CASCADE;
ALTER TABLE customers DROP COLUMN IF EXISTS id;
ALTER TABLE customers RENAME COLUMN new_id TO id;
ALTER TABLE customers ADD PRIMARY KEY (id, user_id);

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_pkey CASCADE;
ALTER TABLE purchases DROP COLUMN IF EXISTS id;
ALTER TABLE purchases RENAME COLUMN new_id TO id;
ALTER TABLE purchases ADD PRIMARY KEY (id, user_id);

-- ── 8. Re-establish Foreign Key Relationships ─────────────────────────────────
ALTER TABLE bills
  DROP CONSTRAINT IF EXISTS fk_bills_customer,
  ADD CONSTRAINT fk_bills_customer
  FOREIGN KEY (customer_id, user_id)
  REFERENCES customers(id, user_id)
  ON DELETE RESTRICT;

ALTER TABLE bill_items
  DROP CONSTRAINT IF EXISTS fk_bill_items_bill,
  ADD CONSTRAINT fk_bill_items_bill
  FOREIGN KEY (bill_id, user_id)
  REFERENCES bills(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS fk_payments_customer,
  ADD CONSTRAINT fk_payments_customer
  FOREIGN KEY (customer_id, user_id)
  REFERENCES customers(id, user_id)
  ON DELETE CASCADE;

COMMIT;
