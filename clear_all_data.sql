-- =========================================================================
-- PrintPro ERP / Xerox & Stationery Billing System
-- TOTAL DATABASE RESET & PURGE SCRIPT (Zero Data Left Behind)
-- =========================================================================
-- Scope:
-- 1. TRUNCATES all transactional data (bills, bill_items, group_bills, group_bill_items,
--    payments, expenses, transfers, closings, audit_logs, loyalty_transactions)
-- 2. TRUNCATES all customer and product records (0 customers, 0 products)
-- 3. TRUNCATES all loyalty program rules (0 rules)
-- 4. TRUNCATES and re-initializes clean settings for all auth.users
-- 5. TRUNCATES and re-initializes clean sequences (counter = 0, padding = 6) for all auth.users
-- 6. PRESERVES auth.users so your login account remains active without disruption
-- =========================================================================

-- 1. FAST CLEAN WIPE OF ALL APPLICATION TABLES
TRUNCATE TABLE 
    public.group_bill_items,
    public.bill_items,
    public.payments,
    public.bills,
    public.group_bills,
    public.expenses,
    public.internal_transfers,
    public.accounting_closings,
    public.audit_logs,
    public.loyalty_transactions,
    public.loyalty_redemption_rules,
    public.loyalty_rules,
    public.customers,
    public.products,
    public.settings,
    public.sequences
CASCADE;

-- Also truncate legacy junction tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_settlement_payments') THEN
        EXECUTE 'TRUNCATE TABLE public.group_settlement_payments CASCADE;';
    END IF;
END $$;

-- 2. RE-SEED CLEAN 0-COUNTER SEQUENCES FOR ALL AUTH USERS
INSERT INTO public.sequences (user_id, key, prefix, padding, current_val)
SELECT u.id, s.key, s.prefix, 6, 0
FROM auth.users u
CROSS JOIN (
    VALUES 
        ('AUDIT', 'AUD'),
        ('BILL', 'INV'),
        ('CLOSE', 'CLS'),
        ('CUSTOMER', 'CUST'),
        ('EXPENSE', 'EXP'),
        ('GROUP_BILL', 'GRP'),
        ('LOYALTY', 'LTX'),
        ('PAYMENT', 'PAY'),
        ('PRODUCT', 'PROD'),
        ('TRANS', 'TRF')
) AS s(key, prefix)
ON CONFLICT (user_id, key) 
DO UPDATE SET 
    prefix = EXCLUDED.prefix,
    padding = EXCLUDED.padding,
    current_val = 0,
    updated_at = now();

-- 3. RE-SEED DEFAULT APPLICATION SETTINGS FOR ALL AUTH USERS
INSERT INTO public.settings (user_id, key, value, updated_at)
SELECT u.id, s.key, s.value::jsonb, now()
FROM auth.users u
CROSS JOIN (
    VALUES 
        ('shop', '{
            "shop_name": "PrintPro Store",
            "address": "",
            "phone": "",
            "email": "",
            "gst_number": "",
            "logo_url": "",
            "footer_message": "Thank you for your business!"
        }'),
        ('billing', '{
            "bill_prefix": "BILL",
            "bill_format": "BILL-{SEQ}",
            "default_payment_method": "Cash",
            "currency_symbol": "₹",
            "decimal_precision": 2,
            "gst_enabled": false,
            "gst_rate": 0,
            "default_printer_size": "80mm",
            "auto_print": false,
            "rounding_method": "None"
        }'),
        ('loyalty', '{
            "enabled": true,
            "calculation_mode": "rate",
            "earn_points": 1,
            "earn_spend_unit": 10,
            "points_required": 10,
            "discount_value": 5
        }'),
        ('whatsapp', '{
            "enabled": true,
            "template_text": "",
            "enable_pdf_sharing": true,
            "enable_text_sharing": true,
            "email_service_id": "",
            "email_template_id": "",
            "email_public_key": ""
        }'),
        ('security', '{
            "super_admin_pin": "1234",
            "session_timeout_minutes": 30,
            "payment_reversal_window_hours": 72
        }'),
        ('app', '{
            "theme": "light",
            "date_format": "DD/MM/YYYY",
            "time_format": "12h"
        }'),
        ('expenses', '{
            "categories": [
                "Shop Expense",
                "Electricity",
                "Rent",
                "Paper Stock & Rolls",
                "Toner & Cartridges",
                "Machine Maintenance",
                "Staff Wages",
                "Other Expense"
            ],
            "default_payment_mode": "Cash"
        }')
) AS s(key, value)
ON CONFLICT (user_id, key)
DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();

-- 4. RELOAD POSTGREST SCHEMA CACHE INSTANTLY
NOTIFY pgrst, 'reload schema';

