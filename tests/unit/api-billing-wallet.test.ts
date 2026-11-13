import { describe, it, expect, vi, beforeEach } from 'vitest';

type TableData = Record<string, Array<Record<string, unknown>>>;

const mockState: {
  tables: TableData;
  updates: Array<{ table: string; payload: Record<string, unknown> }>;
  deletes: Array<{ table: string }>;
} = {
  tables: {},
  updates: [],
  deletes: [],
};

function createQueryBuilder(table: string) {
  let rows = [...(mockState.tables[table] || [])];
  let action: 'select' | 'update' | 'delete' = 'select';
  let updatePayload: Record<string, unknown> = {};

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] === val);
      return builder;
    },
    neq: (col: string, val: unknown) => {
      rows = rows.filter((r) => r[col] !== val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      rows = rows.filter((r) => vals.includes(r[col]));
      return builder;
    },
    is: (col: string, val: unknown) => {
      rows = rows.filter((r) => (r[col] ?? null) === val);
      return builder;
    },
    ilike: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => ({
      select: () => ({
        maybeSingle: async () => ({ data: { id: 'new-1' }, error: null }),
      }),
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    }),
    update: (payload: Record<string, unknown>) => {
      action = 'update';
      updatePayload = payload;
      mockState.updates.push({ table, payload });
      return builder;
    },
    delete: () => {
      action = 'delete';
      mockState.deletes.push({ table });
      return builder;
    },
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => {
      if (action === 'update') {
        rows.forEach((r) => Object.assign(r, updatePayload));
      }
      return resolve({ data: rows, error: null });
    },
  };

  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1' } } }) },
    from: vi.fn((table: string) => createQueryBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: 'SEQ-000001', error: null }),
  },
}));

import { ApiService } from '@/lib/services/api';

describe('ApiService billing, wallet, and cancelled-bill invariants', () => {
  beforeEach(() => {
    mockState.updates = [];
    mockState.deletes = [];
    mockState.tables = {
      settings: [],
      customers: [],
      bills: [],
      payments: [],
      loyalty_transactions: [],
      loyalty_rules: [],
      loyalty_redemption_rules: [],
      products: [],
      audit_logs: [],
      expenses: [],
    };
  });

  it('getCustomerSummaries excludes CANCELLED/VOID bills and does not mutate DB on read', async () => {
    mockState.tables.customers = [
      {
        id: 'c1',
        name: 'Alice',
        advance_balance: 100,
        loyalty_points: 10,
        created_at: '2026-11-01T00:00:00Z',
      },
    ];
    mockState.tables.bills = [
      {
        id: 'b1',
        customer_id: 'c1',
        grand_total: 100,
        paid_total: 0,
        advance_used: 0,
        status: 'COMPLETED',
        created_at: '2026-11-02T00:00:00Z',
      },
      {
        id: 'b2',
        customer_id: 'c1',
        grand_total: 500,
        paid_total: 0,
        advance_used: 0,
        status: 'CANCELLED',
        created_at: '2026-11-03T00:00:00Z',
      },
    ];
    mockState.tables.payments = [
      {
        id: 'p1',
        customer_id: 'c1',
        bill_id: null,
        amount: 100,
        status: 'COMPLETED',
        created_at: '2026-11-01T00:00:00Z',
      },
    ];

    const summaries = await ApiService.getCustomerSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].total_billed).toBe(100);
    expect(summaries[0].balance_due).toBe(100);
    // True wallet: ₹100 unallocated advance is preserved despite ₹100 Pay Later bill
    expect(summaries[0].advance_balance).toBe(100);
    // Strictly read-only: no DB updates on customers
    expect(mockState.updates.filter((u) => u.table === 'customers')).toHaveLength(0);
  });

  it('reconcileCustomerAdvanceBalances does NOT merge customers with same name but different mobile', async () => {
    mockState.tables.customers = [
      {
        id: 'c1',
        name: 'Rahul Sharma',
        mobile: '9999999991',
        advance_balance: 100,
        loyalty_points: 0,
        created_at: '2026-11-01T00:00:00Z',
      },
      {
        id: 'c2',
        name: 'Rahul Sharma',
        mobile: '9999999992',
        advance_balance: 0,
        loyalty_points: 0,
        created_at: '2026-11-02T00:00:00Z',
      },
    ];
    mockState.tables.payments = [
      { id: 'p1', customer_id: 'c1', bill_id: null, amount: 100, status: 'COMPLETED', created_at: '2026-11-01T00:00:00Z' },
    ];

    const res = await ApiService.reconcileCustomerAdvanceBalances();
    expect(res.duplicatesMerged).toBe(0);
    expect(res.customersReconciled).toBe(2);
    expect(mockState.deletes.filter((d) => d.table === 'customers')).toHaveLength(0);
  });

  it('applyAdvanceToBill rejects CANCELLED bills', async () => {
    mockState.tables.bills = [
      { id: 'b-cancel', bill_number: 'INV-001', customer_id: 'c1', status: 'CANCELLED', grand_total: 100, paid_total: 0 },
    ];

    await expect(ApiService.applyAdvanceToBill('b-cancel')).rejects.toThrow(/cancelled/i);
  });

  it('addExpense rejects Split expenses whose cash + upi != amount', async () => {
    await expect(
      ApiService.addExpense({
        title: 'Paper',
        amount: 100,
        category: 'Paper',
        payment_mode: 'Split',
        cash_amount: 40,
        upi_amount: 40,
      })
    ).rejects.toThrow(/must equal total amount/i);
  });

  it('createSharedBilling rejects participant shares that do not sum to grand total', async () => {
    await expect(
      ApiService.createSharedBilling({
        items: [{ product_name: 'Print', quantity: 1, price: 200, total: 200 }],
        participants: [
          { customer_name: 'A', share_amount: 50 },
          { customer_name: 'B', share_amount: 50 },
        ],
      })
    ).rejects.toThrow(/must equal the group grand total/i);
  });
});

