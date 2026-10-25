-- =============================================================================
-- Migration 003: Standardize Row-Level Security (RLS) & Tenant Isolation
-- =============================================================================
-- Plain-English Summary:
-- 1. Revokes all access on all public tables from anonymous users (default deny).
-- 2. Grants access only to authenticated users and the service role.
-- 3. Enables and forces RLS on all 20 tables holding user data.
-- 4. Deduplicates legacy duplicate policies and establishes a single unified
--    policy per table: users can read and write ONLY their own rows (auth.uid() = user_id).
-- 5. Configures the 'expenses' view with security_invoker = true.
-- =============================================================================

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
    -- 1. Revoke table-level access from anonymous public role
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

    -- 2. Grant table-level access strictly to authenticated users and service role
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

    -- 3. Loop through every table to enforce RLS and deduplicate policies
    FOREACH tbl IN ARRAY tables LOOP
        -- Ensure RLS is active and enforced even for table owners
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);

        -- Drop existing duplicate / legacy policy variants
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_%I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own %s" ON public.%I;', replace(tbl, '_', ' '), tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own %ss" ON public.%I;', replace(tbl, '_', ' '), tbl);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.%I;', tbl);

        -- Create unified, clean tenant isolation policy
        EXECUTE format(
            'CREATE POLICY "tenant_isolation_%I" ON public.%I
             FOR ALL
             TO authenticated
             USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);',
            tbl, tbl
        );
    END LOOP;

    -- 4. Ensure views respect underlying table security
    ALTER VIEW public.expenses SET (security_invoker = true);
END $$;
