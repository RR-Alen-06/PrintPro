-- Migration 004: Group Settlement Payments Table & RLS
CREATE TABLE IF NOT EXISTS group_settlement_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_bill_id UUID NOT NULL REFERENCES group_bills(id) ON DELETE CASCADE,
  payer_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  payer_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  cash_amount DECIMAL(10,2) DEFAULT 0.00,
  upi_amount DECIMAL(10,2) DEFAULT 0.00,
  total_paid DECIMAL(10,2) NOT NULL,
  excess_credit DECIMAL(10,2) DEFAULT 0.00,
  settlements JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_settle_user ON group_settlement_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_group_settle_group ON group_settlement_payments (group_bill_id);
CREATE INDEX IF NOT EXISTS idx_group_settle_payer ON group_settlement_payments (payer_customer_id);
CREATE INDEX IF NOT EXISTS idx_group_settle_date ON group_settlement_payments (date);

ALTER TABLE group_settlement_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_settlement_payments' AND policyname = 'Users can manage their own group settlements'
  ) THEN
    CREATE POLICY "Users can manage their own group settlements" ON group_settlement_payments
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
