-- Migration 007: Sequential IDs Support and Reversal Enum
-- Adds 'reversal' to payment_type enum if not present, adds session_number to cash_sessions, and ensures indexes on sequence fields.

ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'reversal';

ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS session_number VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payments_payment_number ON payments (user_id, payment_number);
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON customers (user_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills (user_id, bill_number);
CREATE INDEX IF NOT EXISTS idx_purchases_expense_number ON purchases (user_id, expense_number);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_session_number ON cash_sessions (user_id, session_number);
CREATE INDEX IF NOT EXISTS idx_advance_payments_advance_number ON advance_payments (user_id, advance_number);
