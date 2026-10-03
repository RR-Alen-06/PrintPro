import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Unified Database Schema & Consolidation Audit', () => {
  const unifiedSchemaPath = path.resolve(__dirname, '../../../../backend/database/unified_schema.sql');

  it('unified_schema.sql exists as single canonical database schema and contains NO MySQL remnants', () => {
    expect(fs.existsSync(unifiedSchemaPath)).toBe(true);
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');
    expect(content.length).toBeGreaterThan(1000);
    
    // Must NOT contain MySQL artifacts
    expect(content).not.toContain('ENGINE=InnoDB');
    expect(content).not.toContain('AUTO_INCREMENT');
    expect(content).not.toContain('utf8mb4');

    // Must contain PostgreSQL types and extensions
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(content).toContain('gen_random_uuid()');
    expect(content).toContain('TIMESTAMPTZ');
  });

  it('contains all 12 core tables and multi-tenant security references', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');
    const requiredTables = [
      'business_profile',
      'customers',
      'inventory_items',
      'bills',
      'bill_items',
      'payments',
      'purchases',
      'group_bills',
      'group_settlement_payments',
      'promo_codes',
      'sequences',
      'audit_log'
    ];

    requiredTables.forEach((table) => {
      const regex = new RegExp(`CREATE TABLE (IF NOT EXISTS )?${table}`, 'i');
      expect(content).toMatch(regex);
    });
  });

  it('includes universal sequential columns and unique composite indexes', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');
    
    expect(content).toContain('customer_code VARCHAR(30)');
    expect(content).toContain('invoice_number VARCHAR(30)');
    expect(content).toContain('payment_code VARCHAR(30)');
    expect(content).toContain('expense_code VARCHAR(30)');

    expect(content).toContain('idx_customers_code');
    expect(content).toContain('idx_bills_invoice_num');
    expect(content).toContain('idx_payments_code');
    expect(content).toContain('idx_purchases_code');
  });

  it('provides full view compatibility between expenses and purchases with INSTEAD OF triggers', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');

    expect(content).toContain('CREATE OR REPLACE VIEW expenses AS SELECT * FROM purchases;');
    expect(content).toContain('expenses_insert_trg');
    expect(content).toContain('expenses_update_trg');
    expect(content).toContain('expenses_delete_trg');
  });

  it('implements atomic database-level sequential generation triggers', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');

    expect(content).toContain('FUNCTION get_next_sequence_code');
    expect(content).toContain('assign_customer_code_trg');
    expect(content).toContain('assign_invoice_number_trg');
    expect(content).toContain('assign_payment_code_trg');
    expect(content).toContain('assign_expense_code_trg');
  });

  it('enforces multi-tenant Row Level Security (RLS) policies on all tables', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');

    expect(content).toContain('ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE customers ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE bills ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE payments ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;');
    expect(content).toContain('tenant_isolation_');
  });

  it('includes safe chronological backfill routines for legacy unassigned codes', () => {
    const content = fs.readFileSync(unifiedSchemaPath, 'utf8');

    expect(content).toContain('-- 1. Backfill Customers');
    expect(content).toContain('UPDATE customers SET customer_code = \'CUS-\' || LPAD(idx::text, 4, \'0\')');
    expect(content).toContain('-- 2. Backfill Bills');
    expect(content).toContain('UPDATE bills SET invoice_number = \'INV-\' || LPAD(idx::text, 4, \'0\')');
    expect(content).toContain('-- 3. Backfill Payments');
    expect(content).toContain('UPDATE payments SET payment_code = \'PAY-\' || LPAD(idx::text, 4, \'0\')');
    expect(content).toContain('-- 4. Backfill Purchases / Expenses');
    expect(content).toContain('UPDATE purchases SET expense_code = \'EXP-\' || LPAD(idx::text, 4, \'0\')');
  });
});
