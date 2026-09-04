-- Migration 003: Group Bills Table & RLS
CREATE TABLE IF NOT EXISTS group_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'shared',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT NULL,
  notes TEXT DEFAULT '',
  member_bill_ids UUID[] DEFAULT '{}',
  members JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_bills_user ON group_bills (user_id);
CREATE INDEX IF NOT EXISTS idx_group_bills_date ON group_bills (date);

ALTER TABLE group_bills ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'group_bills' AND policyname = 'Users can manage their own group bills'
  ) THEN
    CREATE POLICY "Users can manage their own group bills" ON group_bills
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
