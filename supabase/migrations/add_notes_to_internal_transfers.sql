-- Add notes column to internal_transfers so createInternalTransfer never fails on missing column.
ALTER TABLE public.internal_transfers ADD COLUMN IF NOT EXISTS notes TEXT;

NOTIFY pgrst, 'reload schema';
