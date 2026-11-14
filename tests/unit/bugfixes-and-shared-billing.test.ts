import { describe, it, expect, vi, beforeEach } from 'vitest';

type TableData = Record<string, Array<Record<string, unknown>>>;

const mockState: {
  tables: TableData;
  inserts: Array<{ table: string; payload: unknown }>;
  updates: Array<{ table: string; payload: Record<string, unknown>; filters: Array<[string, string, unknown]> }>;
  deletes: Array<{ table: string; filters: Array<[string, string, unknown]> }>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  billsError: boolean;
} = {
  tables: {},
  inserts: [],
  updates: [],
  deletes: [],
  rpcCalls: [],
  rpcImpl: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }),
  billsError: false,
};

function createQueryBuilder(table: string) {
  let rows = [...(mockState.tables[table] || [])];
  let action: 'select' | 'update' | 'delete' = 'select';
  let updatePayload: Record<string, unknown> = {};
  const filters: Array<[string, string, unknown]> = [];
  let hasJoinError = false;

  const builder: Record<string, unknown> = {
    select: (cols?: string) => {
      if (table === 'bills' && cols && cols.includes('bill_items') && mockState.billsError) {
        hasJoinError = true;
      }
      return builder;
    },
    eq: (col: string, val: unknown) => {
      filters.push(['eq', col, val]);
      rows = rows.filter((r) => r[col] === val);
      return builder;
    },
    neq: (col: string, val: unknown) => {
      filters.push(['neq', col, val]);
      rows = rows.filter((r) => r[col] !== val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push(['in', col, vals]);
      rows = rows.filter((r) => vals.includes(r[col]));
      return builder;
    },
    is: (col: string, val: unknown) => {
      filters.push(['is', col, val]);
      rows = rows.filter((r) => (r[col] ?? null) === val);
      return builder;
    },
    gte: () => builder,
    lte: () => builder,
    ilike: () => builder,
    or: (expr: string) => {
      const clauses = expr.split(',').map((s) => s.trim()).filter(Boolean);
      rows = rows.filter((r) =>
        clauses.some((c) => {
          const parts = c.split('.');
          if (parts.length === 3 && parts[1] === 'eq') {
            return String(r[parts[0]] ?? '') === parts[2];
          }
          return false;
        })
      );
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    insert: (payload: unknown) => {
      mockState.inserts.push({ table, payload });
      const first = Array.isArray(payload) ? payload[0] : payload;
      const inserted = { id: `${table}-new-1`, ...(first as Record<string, unknown>) };
      if (!mockState.tables[table]) mockState.tables[table] = [];
      const arr = Array.isArray(payload) ? payload : [payload];
      arr.forEach((item, idx) => {
        mockState.tables[table].push({ id: `${table}-new-${idx + 1}`, ...(item as Record<string, unknown>) });
      });
      return {
        select: () => ({
          maybeSingle: async () => ({ data: inserted, error: null }),
        }),
        then: (resolve: (v: unknown) => void) => resolve({ data: [inserted], error: null }),
      };
    },
    update: (payload: Record<string, unknown>) => {
      action = 'update';
      updatePayload = payload;
      mockState.updates.push({ table, payload, filters });
      return builder;
    },
    delete: () => {
      action = 'delete';
      mockState.deletes.push({ table, filters });
      return builder;
    },
    maybeSingle: async () => {
      if (action === 'update') {
        const updated = rows[0] ? { ...rows[0], ...updatePayload } : null;
        return { data: updated, error: null };
      }
      return { data: rows[0] ?? null, error: null };
    },
    then: (resolve: (v: unknown) => void) => {
      if (hasJoinError) {
        return resolve({ data: null, error: { message: 'Could not embed bill_items' } });
      }
      if (action === 'update') {
        rows.forEach((r) => Object.assign(r, updatePayload));
        return resolve({ data: rows, error: null });
      }
      if (action === 'delete') {
        return resolve({ data: rows, error: null });
      }
      return resolve({ data: rows, error: null });
    },
  };

  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: (table: string) => createQueryBuilder(table),
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      mockState.rpcCalls.push({ fn, args });
      return mockState.rpcImpl(fn, args);
    },
  },
}));

import { ApiService } from '@/lib/services/api';

describe('Bugfixes & Shared Billing', () => {
  beforeEach(() => {
    mockState.inserts = [];
    mockState.updates = [];
    mockState.deletes = [];
    mockState.rpcCalls = [];
    mockState.billsError = false;
    mockState.rpcImpl = async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    mockState.tables = {
      settings: [],
      sequences: [
        { id: 'seq-bill', key: 'BILL', prefix: 'INV', padding: 6, current_val: 5 },
        { id: 'seq-cust', key: 'CUSTOMER', prefix: 'CUST', padding: 6, current_val: 3 },
        { id: 'seq-prod', key: 'PRODUCT', prefix: 'PROD', padding: 6, current_val: 8 },
      ],
      customers: [{ id: 'cust-1', name: 'Alice', advance_balance: 0, loyalty_points: 0 }],
      products: [{ id: 'prod-1', name: 'A4 Print', price: 10, stock: 100 }],
      bills: [],
      bill_items: [],
      group_bills: [],
      group_bill_items: [],
      payments: [],
      expenses: [],
      internal_transfers: [],
      accounting_closings: [],
      loyalty_transactions: [],
      audit_logs: [],
    };
  });

  // BUG 1: Payment double count
  it('recordCustomerPayment does NOT fall back to client-side insert when record_payment_atomic returns { id }', async () => {
    mockState.tables.payments = [
      {
        id: 'pay-rpc-1',
        payment_number: 'PAY-000001',
        customer_id: 'cust-1',
        bill_id: null,
        amount: 100,
        payment_method: 'Cash',
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
        customers: { name: 'Alice', mobile: '9999999999' },
        bills: null,
      },
    ];
    mockState.rpcImpl = async (fn) => {
      if (fn === 'record_payment_atomic') {
        return {
          data: {
            id: 'pay-rpc-1',
            payment_number: 'PAY-000001',
            customer_id: 'cust-1',
            amount: 100,
            payment_method: 'Cash',
            status: 'COMPLETED',
            unallocated_advance: 100,
          },
          error: null,
        };
      }
      return { data: null, error: { code: 'PGRST202', message: 'not found' } };
    };

    const result = await ApiService.recordCustomerPayment({
      customer_id: 'cust-1',
      amount: 100,
      payment_method: 'Cash',
    });

    expect(result?.id).toBe('pay-rpc-1');
    // Must NOT insert a second payment or update customers.advance_balance from client fallback
    const paymentInserts = mockState.inserts.filter((i) => i.table === 'payments');
    const customerUpdates = mockState.updates.filter((u) => u.table === 'customers');
    expect(paymentInserts).toHaveLength(0);
    expect(customerUpdates).toHaveLength(0);
  });

  // BUG 2: Purge all data (customers, products, group_bills, sequences)
  it('purgeAllBusinessData deletes customers, products, group_bills and resets sequences to 0', async () => {
    await ApiService.purgeAllBusinessData('Super Admin');

    const deletedTables = mockState.deletes.map((d) => d.table);
    expect(deletedTables).toContain('customers');
    expect(deletedTables).toContain('products');
    expect(deletedTables).toContain('group_bills');
    expect(deletedTables).toContain('group_bill_items');
    expect(deletedTables).toContain('bills');
    expect(deletedTables).toContain('payments');
    expect(deletedTables).toContain('expenses');
    expect(deletedTables).toContain('accounting_closings');
    expect(deletedTables).toContain('internal_transfers');
    expect(deletedTables).toContain('audit_logs');

    const seqUpdates = mockState.updates.filter((u) => u.table === 'sequences');
    expect(seqUpdates.length).toBeGreaterThan(0);
    expect(seqUpdates[0].payload.current_val).toBe(0);
  });

  // BUG 3: Dashboard stats must not double-count FIFO payments and must survive bill_items join error
  it('getDashboardStats does not double-count FIFO payments (bill_id: null) and falls back if bill_items join errors', async () => {
    const now = new Date().toISOString();
    mockState.billsError = true;
    mockState.tables.bills = [
      {
        id: 'b-1',
        bill_number: 'INV-000001',
        customer_id: 'cust-1',
        grand_total: 100,
        paid_total: 100,
        cash_paid: 100,
        upi_paid: 0,
        advance_used: 0,
        status: 'COMPLETED',
        created_at: now,
      },
      {
        id: 'b-walkin',
        bill_number: 'INV-000002',
        customer_id: null,
        grand_total: 50,
        paid_total: 50,
        cash_paid: 0,
        upi_paid: 50,
        advance_used: 0,
        status: 'COMPLETED',
        created_at: now,
      },
    ];
    mockState.tables.payments = [
      {
        id: 'p-1',
        payment_number: 'PAY-000001',
        customer_id: 'cust-1',
        bill_id: null, // FIFO payment!
        amount: 100,
        payment_method: 'Cash',
        status: 'COMPLETED',
        created_at: now,
      },
    ];

    const stats = await ApiService.getDashboardStats('today');
    expect(stats.bills_generated).toBe(2);
    expect(stats.payment_summary.total_sales).toBe(150);
    // Cash must be 100 (NOT 200!), UPI must be 50 (from walk-in bill)
    expect(stats.payment_summary.cash_collected).toBe(100);
    expect(stats.payment_summary.upi_collected).toBe(50);
    expect(stats.payment_summary.total_amount_collected).toBe(150);
  });

  // SHARED BILLING: Equal split + post-billing multi-customer payment
  it('recordGroupBillPayment settles selected member shares across different payers', async () => {
    mockState.tables.customers = [
      { id: 'c1', name: 'Cust 1', advance_balance: 0, loyalty_points: 0 },
      { id: 'c2', name: 'Cust 2', advance_balance: 0, loyalty_points: 0 },
      { id: 'c3', name: 'Cust 3', advance_balance: 0, loyalty_points: 0 },
      { id: 'c4', name: 'Cust 4', advance_balance: 0, loyalty_points: 0 },
    ];
    mockState.tables.group_bills = [
      {
        id: 'gb-1',
        group_bill_number: 'GRP-000001',
        billing_type: 'SHARED',
        grand_total: 40,
        paid_amount: 0,
        balance_due: 40,
        participant_count: 4,
        status: 'COMPLETED',
      },
    ];
    mockState.tables.bills = [
      { id: 'b1', bill_number: 'INV-1', customer_id: 'c1', group_bill_id: 'gb-1', grand_total: 10, paid_total: 0, cash_paid: 0, upi_paid: 0, advance_used: 0, status: 'COMPLETED' },
      { id: 'b2', bill_number: 'INV-2', customer_id: 'c2', group_bill_id: 'gb-1', grand_total: 10, paid_total: 0, cash_paid: 0, upi_paid: 0, advance_used: 0, status: 'COMPLETED' },
      { id: 'b3', bill_number: 'INV-3', customer_id: 'c3', group_bill_id: 'gb-1', grand_total: 10, paid_total: 0, cash_paid: 0, upi_paid: 0, advance_used: 0, status: 'COMPLETED' },
      { id: 'b4', bill_number: 'INV-4', customer_id: 'c4', group_bill_id: 'gb-1', grand_total: 10, paid_total: 0, cash_paid: 0, upi_paid: 0, advance_used: 0, status: 'COMPLETED' },
    ];

    // Scenario: Cust 1 pays for Cust 1 (10) + Cust 3 (10) = 20
    const res = await ApiService.recordGroupBillPayment({
      group_bill_id: 'gb-1',
      paying_customer_id: 'c1',
      payment_method: 'Cash',
      allocations: [
        { bill_id: 'b1', amount: 10 },
        { bill_id: 'b3', amount: 10 },
      ],
    });

    expect(res.total_paid).toBe(20);
    const paymentInserts = mockState.inserts.filter((i) => i.table === 'payments');
    expect(paymentInserts).toHaveLength(1);
    expect((paymentInserts[0].payload as Array<Record<string, unknown>>)[0].amount).toBe(20);
    expect((paymentInserts[0].payload as Array<Record<string, unknown>>)[0].customer_id).toBe('c1');

    const grpUpdates = mockState.updates.filter((u) => u.table === 'group_bills');
    expect(grpUpdates.length).toBeGreaterThan(0);
    expect(grpUpdates[grpUpdates.length - 1].payload.paid_amount).toBe(20);
    expect(grpUpdates[grpUpdates.length - 1].payload.balance_due).toBe(20);
  });

  it('deletePayment reverses FIFO payment across bills and remaining advance_balance', async () => {
    vi.spyOn(ApiService, 'verifyAdminPin').mockResolvedValue(true);
    mockState.tables.customers = [{ id: 'c1', name: 'Alice', advance_balance: 40 }];
    mockState.tables.bills = [
      {
        id: 'b1',
        bill_number: 'INV-1',
        customer_id: 'c1',
        grand_total: 60,
        paid_total: 60,
        cash_paid: 0,
        upi_paid: 60,
        advance_used: 0,
        payment_method: 'UPI',
        loyalty_points_earned: 0,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      },
    ];
    mockState.tables.payments = [
      {
        id: 'p1',
        payment_number: 'PAY-1',
        customer_id: 'c1',
        bill_id: null,
        amount: 100,
        payment_method: 'UPI',
        status: 'COMPLETED',
        notes: 'Payment received via UPI',
        created_at: new Date().toISOString(),
      },
    ];

    const ok = await ApiService.deletePayment('p1', 'Wrong entry', '1234', 'Super Admin');
    expect(ok).toBe(true);

    expect(mockState.tables.bills[0].paid_total).toBe(0);
    expect(mockState.tables.bills[0].upi_paid).toBe(0);
    expect(mockState.tables.bills[0].payment_method).toBe('Pay Later');
    expect(mockState.tables.customers[0].advance_balance).toBe(0);
    expect(mockState.tables.payments[0].status).toBe('CANCELLED');
  });

  it('deletePayment reverses Group Bill payment across paid_by_customer_id shares and syncs group_bills', async () => {
    vi.spyOn(ApiService, 'verifyAdminPin').mockResolvedValue(true);
    mockState.tables.customers = [{ id: 'c1', name: 'Alice', advance_balance: 0 }];
    mockState.tables.group_bills = [
      { id: 'gb-1', group_bill_number: 'GRP-1', total_amount: 20, paid_amount: 20, balance_due: 0 },
    ];
    mockState.tables.bills = [
      {
        id: 'b1',
        bill_number: 'INV-1',
        customer_id: 'c1',
        group_bill_id: 'gb-1',
        grand_total: 10,
        paid_total: 10,
        cash_paid: 10,
        upi_paid: 0,
        advance_used: 0,
        payment_method: 'Cash',
        loyalty_points_earned: 0,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      },
      {
        id: 'b3',
        bill_number: 'INV-3',
        customer_id: 'c3',
        paid_by_customer_id: 'c1',
        group_bill_id: 'gb-1',
        grand_total: 10,
        paid_total: 10,
        cash_paid: 10,
        upi_paid: 0,
        advance_used: 0,
        payment_method: 'Cash',
        loyalty_points_earned: 0,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
      },
    ];
    mockState.tables.payments = [
      {
        id: 'p-grp',
        payment_number: 'PAY-2',
        customer_id: 'c1',
        bill_id: null,
        amount: 20,
        payment_method: 'Cash',
        status: 'COMPLETED',
        notes: 'Group Bill Payment (GRP-1)',
        created_at: new Date().toISOString(),
      },
    ];

    const ok = await ApiService.deletePayment('p-grp', 'Mistake', '1234', 'Super Admin');
    expect(ok).toBe(true);

    expect(mockState.tables.bills[0].paid_total).toBe(0);
    expect(mockState.tables.bills[0].payment_method).toBe('Pay Later');
    expect(mockState.tables.bills[1].paid_total).toBe(0);
    expect(mockState.tables.bills[1].paid_by_customer_id).toBeNull();
    expect(mockState.tables.group_bills[0].paid_amount).toBe(0);
    expect(mockState.tables.group_bills[0].balance_due).toBe(20);
    expect(mockState.tables.payments[0].status).toBe('CANCELLED');
  });
});

