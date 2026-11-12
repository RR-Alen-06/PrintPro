-- =========================================================================
-- DEDUPLICATE FOREIGN KEY CONSTRAINTS (Resolve PostgREST Embed Ambiguity)
-- Drops redundant auto-named *_fkey constraints so each relationship is unambiguous
-- =========================================================================

-- 1. Bills: Drop auto-generated duplicate FK on customer_id
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_customer_id_fkey CASCADE;

-- 2. Bill Items: Drop auto-generated duplicate FKs
ALTER TABLE public.bill_items DROP CONSTRAINT IF EXISTS bill_items_bill_id_fkey CASCADE;
ALTER TABLE public.bill_items DROP CONSTRAINT IF EXISTS bill_items_product_id_fkey CASCADE;

-- 3. Group Bill Items: Drop auto-generated duplicate FKs
ALTER TABLE public.group_bill_items DROP CONSTRAINT IF EXISTS group_bill_items_group_bill_id_fkey CASCADE;
ALTER TABLE public.group_bill_items DROP CONSTRAINT IF EXISTS group_bill_items_product_id_fkey CASCADE;

-- 4. Group Bills: Drop auto-generated duplicate FK
ALTER TABLE public.group_bills DROP CONSTRAINT IF EXISTS group_bills_primary_payer_id_fkey CASCADE;

-- 5. Loyalty Transactions: Drop auto-generated duplicate FKs
ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_bill_id_fkey CASCADE;
ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_customer_id_fkey CASCADE;

-- 6. Payments: Drop auto-generated duplicate FKs
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_bill_id_fkey CASCADE;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey CASCADE;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

