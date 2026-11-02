-- =============================================================================
-- Migration 004: Performance Indexing & RLS Subquery Optimization
-- =============================================================================
-- Summary:
-- 1. Deduplicates redundant indexes created in earlier migrations.
-- 2. Adds targeted composite indexes for high-frequency queries:
--    - bills (user_id, deleted_at, created_at DESC)
--    - bills (user_id, customer_id, deleted_at, date DESC)
--    - bill_items (bill_id, user_id)
--    - payments (bill_id, user_id) WHERE deleted_at IS NULL
--    - payments (user_id, date DESC) WHERE deleted_at IS NULL
--    - payments (customer_id, user_id, date DESC) WHERE deleted_at IS NULL
--    - cash_sessions (user_id, status, opened_at DESC)
--    - purchases (user_id, date DESC)
--    - advance_payments (user_id, customer_id, date DESC)
--    - customers (user_id, created_at DESC)
-- 3. Optimizes all 20 RLS policies by wrapping auth.uid() in (SELECT auth.uid()),
--    preventing row-by-row function re-execution (5x - 100x query speedup).
-- =============================================================================

DO $$
BEGIN
  -- ── 1. Safely Drop Redundant Duplicate Indexes ──────────────────────────────
  -- Bills duplicate indexes
  DROP INDEX IF EXISTS public.idx_bills_date;
  DROP INDEX IF EXISTS public.idx_bills_deleted;
  DROP INDEX IF EXISTS public.idx_bills_status;
  DROP INDEX IF EXISTS public.idx_bills_user;
  DROP INDEX IF EXISTS public.idx_bills_customer;

  -- Customers duplicate indexes
  DROP INDEX IF EXISTS public.idx_customers_name;
  DROP INDEX IF EXISTS public.idx_customers_phone;
  DROP INDEX IF EXISTS public.idx_customers_user;

  -- Purchases duplicate indexes
  DROP INDEX IF EXISTS public.idx_purchases_date;
  DROP INDEX IF EXISTS public.idx_purchases_user;

  -- Bill items duplicate indexes
  DROP INDEX IF EXISTS public.idx_bill_items_user;
END $$;

-- ── 2. Add High-Performance Composite Indexes ─────────────────────────────────

-- Bills: optimized for listBills (filtering deleted and ordering by created_at DESC)
CREATE INDEX IF NOT EXISTS idx_bills_user_deleted_created 
  ON public.bills (user_id, deleted_at, created_at DESC);

-- Bills: optimized for customer-specific bill lookups and statements
CREATE INDEX IF NOT EXISTS idx_bills_user_cust_del_date 
  ON public.bills (user_id, customer_id, deleted_at, date DESC);

-- Bill items: composite multi-tenant lookup on bill_id and user_id
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_user 
  ON public.bill_items (bill_id, user_id);

-- Payments: partial index for active payments by bill
CREATE INDEX IF NOT EXISTS idx_payments_bill_user_active 
  ON public.payments (bill_id, user_id) 
  WHERE deleted_at IS NULL;

-- Payments: partial index for active payments by customer timeline
CREATE INDEX IF NOT EXISTS idx_payments_cust_user_date 
  ON public.payments (customer_id, user_id, date DESC) 
  WHERE deleted_at IS NULL;

-- Payments: date sorted queries for reports and active payment listings
CREATE INDEX IF NOT EXISTS idx_payments_user_date_active 
  ON public.payments (user_id, date DESC) 
  WHERE deleted_at IS NULL;

-- Cash Sessions: active session lookup
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_status_opened 
  ON public.cash_sessions (user_id, status, opened_at DESC);

-- Purchases / Expenses: date sorted and category lookups
CREATE INDEX IF NOT EXISTS idx_purchases_user_date 
  ON public.purchases (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_user_category 
  ON public.purchases (user_id, category);

-- Advance Payments: customer advance balance lookup
CREATE INDEX IF NOT EXISTS idx_advance_user_customer_date 
  ON public.advance_payments (user_id, customer_id, date DESC);

-- Customers: creation order listing
CREATE INDEX IF NOT EXISTS idx_customers_user_created 
  ON public.customers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customers_user_type 
  ON public.customers (user_id, type);

-- UPI Transactions: user and date ordering
CREATE INDEX IF NOT EXISTS idx_upi_tx_user_date 
  ON public.upi_transactions (user_id, date DESC);

-- ── 3. Optimize Row-Level Security (RLS) Policies ─────────────────────────────
-- Replacing row-evaluated (auth.uid() = user_id) with cached ((select auth.uid()) = user_id)
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'advance_payments',
        'audit_log',
        'bill_items',
        'bills',
        'business_profile',
        'cash_sessions',
        'customer_groups',
        'customers',
        'group_bills',
        'group_settlement_payments',
        'inventory_items',
        'loyalty_events',
        'loyalty_settings',
        'payments',
        'promo_codes',
        'promo_uses',
        'purchases',
        'sequences',
        'upi_transactions',
        'user_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- Drop previous policy
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.%I;', tbl);

        -- Create optimized cached tenant isolation policy
        EXECUTE format(
            'CREATE POLICY "tenant_isolation_%I" ON public.%I
             FOR ALL
             TO authenticated
             USING ((SELECT auth.uid()) = user_id)
             WITH CHECK ((SELECT auth.uid()) = user_id);',
            tbl, tbl
        );
    END LOOP;
END $$;

