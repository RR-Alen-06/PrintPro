import { describe, it, expect, vi, beforeEach } from 'vitest';

type TableData = Record<string, Array<Record<string, unknown>>>;

const mockState: {
  tables: TableData;
  inserts: Array<{ table: string; payload: unknown }>;
  updates: Array<{ table: string; payload: Record<string, unknown> }>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  rpcImpl: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
} = {
  tables: {},
  inserts: [],
  updates: [],
  rpcCalls: [],
  rpcImpl: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }),
};

function createQueryBuilder(table: string) {
  let rows = [...(mockState.tables[table] || [])];
  let action: 'select' | 'update' = 'select';
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
    insert: (payload: unknown) => {
      mockState.inserts.push({ table, payload });
      const first = Array.isArray(payload) ? payload[0] : payload;
      const inserted = { id: `${table}-new-1`, ...(first as Record<string, unknown>) };
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
      mockState.updates.push({ table, payload });
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
      if (action === 'update') {
        return resolve({ data: rows.map((r) => ({ ...r, ...updatePayload })), error: null });
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

describe('Shared billing, post-generation payer, discount sync, and RPCs', () => {
  beforeEach(() => {
    mockState.inserts = [];
    mockState.updates = [];
    mockState.rpcCalls = [];
    mockState.rpcImpl = async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
    mockState.tables = {
      settings: [],
      sequences: [{ id: 'seq-1', key: 'BILL', prefix: 'INV', padding: 6, current_val: 10 }],
      customers: [],
      bills: [],
      bill_items: [],
      group_bills: [],
      group_bill_items: [],
      payments: [],
      loyalty_transactions: [],
      audit_logs: [],
    };
  });

  it('editBillDiscount clamps negative discount to 0 and syncs parent group_bills', async () => {
    mockState.tables.bills = [
      {
        id: 'bill-1',
        bill_number: 'INV-000001',
        customer_id: 'cust-1',
        group_bill_id: 'grp-1',
        total: 200,
        discount: 20,
        gst_amount: 0,
        rounding_method: 'None',
        rounding_adjustment: 0,
        grand_total: 180,
        paid_total: 100,
        advance_earned: 0,
        status: 'COMPLETED',
      },
      {
        id: 'bill-2',
        bill_number: 'INV-000002',
        customer_id: 'cust-2',
        group_bill_id: 'grp-1',
        total: 100,
        discount: 0,
        gst_amount: 0,
        rounding_method: 'None',
        rounding_adjustment: 0,
        grand_total: 100,
        paid_total: 50,
        advance_earned: 0,
        status: 'COMPLETED',
      },
    ];

    const updated = await ApiService.editBillDiscount('bill-1', -50, 'Fix negative');
    expect(updated).not.toBeNull();
    expect(updated?.discount).toBe(0);
    expect(updated?.grand_total).toBe(200);

    const groupUpdates = mockState.updates.filter((u) => u.table === 'group_bills');
    expect(groupUpdates.length).toBeGreaterThan(0);
    expect(groupUpdates[0].payload).toMatchObject({
      grand_total: 280,
      paid_amount: 150,
      balance_due: 130,
    });
  });

  it('recordCustomerPayment uses record_payment_atomic RPC when deployed', async () => {
    mockState.rpcImpl = async (fn) => {
      if (fn === 'record_payment_atomic') {
        return { data: { payment_id: 'pay-rpc-1', payment_number: 'PAY-000100' }, error: null };
      }
      return { data: null, error: null };
    };
    mockState.tables.payments = [
      {
        id: 'pay-rpc-1',
        payment_number: 'PAY-000100',
        customer_id: 'cust-1',
        bill_id: 'bill-1',
        amount: 150,
        payment_method: 'UPI',
        status: 'COMPLETED',
      },
    ];

    const res = await ApiService.recordCustomerPayment({
      customer_id: 'cust-1',
      bill_id: 'bill-1',
      amount: 150,
      payment_method: 'UPI',
    });

    expect(mockState.rpcCalls.some((c) => c.fn === 'record_payment_atomic')).toBe(true);
    expect(res?.id).toBe('pay-rpc-1');
    expect(res?.amount).toBe(150);
  });

  it('settleBillDue records payment under paid_by_customer_id and updates bill paid_by_customer_id in fallback mode', async () => {
    mockState.tables.customers = [
      { id: 'cust-owner', name: 'Alice', advance_balance: 0, loyalty_points: 0 },
      { id: 'cust-payer', name: 'Bob', advance_balance: 0, loyalty_points: 0 },
    ];
    mockState.tables.bills = [
      {
        id: 'bill-1',
        bill_number: 'INV-000011',
        customer_id: 'cust-owner',
        paid_by_customer_id: null,
        grand_total: 100,
        paid_total: 0,
        cash_paid: 0,
        upi_paid: 0,
        payment_method: 'Pay Later',
        status: 'COMPLETED',
        loyalty_points_earned: 0,
      },
    ];

    await ApiService.settleBillDue({
      bill_id: 'bill-1',
      paid_by_customer_id: 'cust-payer',
      amount: 100,
      payment_method: 'Cash',
    });

    const payInsert = mockState.inserts.find((i) => i.table === 'payments');
    expect(payInsert).toBeDefined();
    expect((payInsert?.payload as Array<Record<string, unknown>>)[0].customer_id).toBe('cust-payer');

    const billUpdate = mockState.updates.find((u) => u.table === 'bills');
    expect(billUpdate?.payload).toMatchObject({
      paid_total: 100,
      cash_paid: 100,
      paid_by_customer_id: 'cust-payer',
    });
  });

  it('createSharedBilling deducts advance from paid_by_customer_id when payer covers a guest with Advance', async () => {
    mockState.tables.customers = [
      { id: 'cust-payer', name: 'Payer Bob', advance_balance: 150, loyalty_points: 0 },
    ];

    const grp = await ApiService.createSharedBilling({
      items: [{ product_id: null, product_name: 'Print Job', price: 100, quantity: 1, total: 100 }],
      discount: 0,
      rounding_method: 'None',
      participants: [
        {
          customer_id: null,
          customer_name: 'Walk-in Guest',
          share_amount: 100,
          paid_by_customer_id: 'cust-payer',
          cash_paid: 0,
          upi_paid: 0,
          use_advance: true,
          payment_method: 'Advance',
        },
      ],
    });

    expect(grp.paid_amount).toBe(100);
    expect(grp.balance_due).toBe(0);
    const custUpdate = mockState.updates.find((u) => u.table === 'customers');
    expect(custUpdate?.payload).toMatchObject({ advance_balance: 50 });
  });
});

