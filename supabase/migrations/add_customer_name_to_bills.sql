-- Add customer_name snapshot column to bills so walk-in / guest participant names
-- (especially in Shared Billing) are preserved and displayed instead of 'Walk-in Customer'.
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_name TEXT;

UPDATE public.bills
SET customer_name = trim(substring(notes FROM '^Shared Bill Share \([^)]+\)\s*-\s*(.+)$'))
WHERE customer_name IS NULL
  AND notes ~ '^Shared Bill Share \([^)]+\)\s*-\s*.+$';

NOTIFY pgrst, 'reload schema';
