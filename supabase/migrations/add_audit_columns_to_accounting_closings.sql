-- Add audit metadata columns to accounting_closings so createAccountingClosing and updateAccountingClosing never fail on missing columns.
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS last_audited_at TIMESTAMPTZ;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS last_audited_by TEXT;
ALTER TABLE public.accounting_closings ADD COLUMN IF NOT EXISTS audit_notes TEXT;

NOTIFY pgrst, 'reload schema';
