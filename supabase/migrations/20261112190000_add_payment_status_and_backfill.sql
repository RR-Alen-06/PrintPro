-- =========================================================================
-- ADD PAYMENT STATUS & CANCELLATION COLUMNS + BACKFILL MISSING PAYMENTS
-- =========================================================================

-- 1. Add missing status and cancellation columns to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- 2. Backfill missing initial payment records for any existing bills that were paid
INSERT INTO public.payments (
    id,
    user_id,
    payment_number,
    customer_id,
    bill_id,
    amount,
    payment_method,
    status,
    notes,
    created_at
)
SELECT 
    gen_random_uuid(),
    b.user_id,
    'PAY-' || LPAD(ROW_NUMBER() OVER (ORDER BY b.created_at)::text, 6, '0'),
    b.customer_id,
    b.id,
    b.paid_total,
    b.payment_method,
    'COMPLETED',
    'Initial payment for Bill ' || b.bill_number,
    b.created_at
FROM public.bills b
WHERE b.customer_id IS NOT NULL 
  AND b.paid_total > 0
  AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.bill_id = b.id
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

