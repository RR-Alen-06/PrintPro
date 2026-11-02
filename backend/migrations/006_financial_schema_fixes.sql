-- =============================================================================
-- Migration 006: Financial Schema Fixes & Integrity Alignment
-- =============================================================================
-- 1. Creates missing 'sequences' table for monotonic atomic ID generation.
-- 2. Creates missing 'group_settlement_payments' junction table.
-- 3. Adds 'excess_credit' column to payments table.
-- 4. Ensures 'credit_balance' exists on customers table and consolidates advance_balance.
-- 5. Ensures 'advance_used' exists on bills table.
-- 6. Enforces RLS and tenant isolation on the newly verified tables.
-- =============================================================================

-- 1. Sequences table
CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    prefix TEXT NOT NULL DEFAULT '',
    last_seq BIGINT NOT NULL DEFAULT 0,
    padding INTEGER NOT NULL DEFAULT 4,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT sequences_user_entity_unique UNIQUE (user_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_sequences_user_entity ON sequences (user_id, entity_type);

-- 2. Group settlement payments table
CREATE TABLE IF NOT EXISTS group_settlement_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    settlement_id UUID,
    group_bill_id UUID REFERENCES group_bills(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_settlement_payments_user ON group_settlement_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_group_settlement_payments_bill ON group_settlement_payments (group_bill_id);

-- 3. Payments table missing columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS excess_credit NUMERIC(10,2) DEFAULT 0.00;

-- 4. Customers table: guarantee credit_balance and advance_balance
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS advance_balance NUMERIC(10,2) DEFAULT 0.00;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customers' 
          AND column_name = 'advance_balance'
    ) THEN
        UPDATE customers 
        SET credit_balance = COALESCE(credit_balance, 0) + COALESCE(advance_balance, 0)
        WHERE advance_balance IS NOT NULL AND advance_balance != 0;
    END IF;
END $$;

-- 5. Bills table: guarantee advance_used
ALTER TABLE bills ADD COLUMN IF NOT EXISTS advance_used NUMERIC(10,2) DEFAULT 0.00;

-- 6. Apply RLS and permissions to sequences and group_settlement_payments
GRANT ALL ON TABLE sequences TO authenticated;
GRANT ALL ON TABLE sequences TO service_role;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_sequences" ON sequences;
CREATE POLICY "tenant_isolation_sequences" ON sequences
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE group_settlement_payments TO authenticated;
GRANT ALL ON TABLE group_settlement_payments TO service_role;
ALTER TABLE group_settlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_settlement_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_group_settlement_payments" ON group_settlement_payments;
CREATE POLICY "tenant_isolation_group_settlement_payments" ON group_settlement_payments
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
