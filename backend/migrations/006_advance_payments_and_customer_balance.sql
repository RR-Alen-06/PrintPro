-- Migration 006: Ensure business_profile advance_payments & customer advance balance
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS advance_payments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE business_profile ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS advance_balance DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0.00;

-- Backfill advance_balance from credit_balance if advance_balance is null
UPDATE customers SET advance_balance = COALESCE(advance_balance, credit_balance, 0.00) WHERE advance_balance IS NULL;
