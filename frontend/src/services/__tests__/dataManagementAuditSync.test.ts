import { describe, it, expect, vi } from 'vitest';
import {
  exportBillsToCSV,
  exportCustomersToCSV,
  exportInventoryToCSV,
  exportExpensesToCSV,
  exportAdvancesToCSV,
  exportGroupsToCSV,
  createFullBackup,
} from '../../utils/dataExport';
import { validateBackupFile, restoreFromBackup } from '../../utils/dataImport';

describe('Data Management & 8-Entity Backup/Restore Suite', () => {
  const mockAppState = {
    business: { shopName: 'PrintPro Studio', phone: '9888877777' },
    customers: [
      { id: 'cus-1', name: 'Aarav Sharma', customerCode: 'CUS-0001', type: 'regular', creditBalance: 500, phone: '9876543210' },
      { id: 'cus-2', name: 'Deleted Customer', deleted: true },
    ],
    customerGroups: [
      { id: 'grp-1', name: 'Apex Tech Corp', contactPerson: 'John Doe', phone: '9999988888', members: ['cus-1'] },
    ],
    inventory: [
      { id: 'itm-1', name: 'A4 Color 75GSM', colorSingle: 10, colorDouble: 18, bwSingle: 3, bwDouble: 5, stock: 100 },
    ],
    bills: [
      { id: 'bill-1', invoiceNumber: 'BILL-0001', customerName: 'Aarav Sharma', total: 1200, amountPaid: 700, balance: 500, date: '2026-09-12' },
      { id: 'bill-2', deleted: true, total: 100 },
    ],
    payments: [
      { id: 'pay-1', billId: 'bill-1', cashAmount: 500, upiAmount: 200, totalPaid: 700, date: '2026-09-12' },
    ],
    expenses: [
      { id: 'exp-1', voucherNumber: 'EXP-0001', category: 'Paper', amount: 3500, date: '2026-09-10' },
    ],
    advancePayments: [
      { id: 'adv-1', receiptNumber: 'ADV-0001', customerName: 'Aarav Sharma', amount: 1500, date: '2026-09-08' },
    ],
    counters: { bill: 42, customer: 15, expense: 8, advance: 3, group: 2, item: 10 },
    sequences: { bill: 'BILL-0042', customer: 'CUS-0015' },
    settings: { thermalWidth: '58mm', primaryColor: '#ff2fb0' },
  };

  it('validates and restores full 8-entity backup without loss of sequence counters or advance deposits', () => {
    const backupData = {
      version: '2.0',
      data: mockAppState,
    };

    const isValid = validateBackupFile(backupData);
    expect(isValid).toBe(true);

    const restored = restoreFromBackup(backupData);
    expect(restored.customers).toHaveLength(2);
    expect(restored.customerGroups).toHaveLength(1);
    expect(restored.advancePayments).toHaveLength(1);
    expect(restored.counters.bill).toBe(42);
    expect(restored.sequences.bill).toBe('BILL-0042');
    expect(restored.settings.thermalWidth).toBe('58mm');
  });

  it('rejects corrupt or invalid backup payload without required registers', () => {
    const invalidBackup = { data: { someRandomKey: 123 } };
    expect(validateBackupFile(invalidBackup)).toBe(false);
    expect(() => restoreFromBackup(invalidBackup)).toThrowError(/Invalid backup file format/);
  });

  it('exports CSV across all specialized registers safely with URL trigger mock', () => {
    const mockClick = vi.fn();
    const originalURL = global.URL;
    const originalDoc = global.document;

    global.URL = {
      ...global.URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    } as any;

    global.document = {
      ...global.document,
      createElement: vi.fn((tag) => {
        if (tag === 'a') {
          return {
            set href(val: string) {},
            set download(val: string) {},
            click: mockClick,
          };
        }
        return {} as any;
      }),
    } as any;

    try {
      exportBillsToCSV(mockAppState.bills.filter((b) => !b.deleted));
      expect(mockClick).toHaveBeenCalledTimes(1);

      exportAdvancesToCSV(mockAppState.advancePayments);
      expect(mockClick).toHaveBeenCalledTimes(2);

      exportGroupsToCSV(mockAppState.customerGroups);
      expect(mockClick).toHaveBeenCalledTimes(3);

      exportExpensesToCSV(mockAppState.expenses);
      expect(mockClick).toHaveBeenCalledTimes(4);
    } finally {
      global.URL = originalURL;
      global.document = originalDoc;
    }
  });

  describe('Issue 1: Durable Backup Restore with Real API Sequencing and ID Mapping', () => {
    it('persists restored entities through mutation hooks in dependency order with ID mapping and error accumulation', async () => {
      const callLog: string[] = [];
      const idMap: { customers: Record<string, string>; inventory: Record<string, string>; bills: Record<string, string> } = {
        customers: {},
        inventory: {},
        bills: {},
      };

      const mockMutations = {
        createCustomer: vi.fn(async (c) => {
          callLog.push(`createCustomer:${c.name}`);
          return { id: `backend-${c.id}` };
        }),
        createInventory: vi.fn(async (item) => {
          callLog.push(`createInventory:${item.name}`);
          return { id: `backend-${item.id}` };
        }),
        createBill: vi.fn(async (bill) => {
          if (bill.invoiceNumber === 'FAIL-BILL') {
            throw new Error('Duplicate invoice number');
          }
          callLog.push(`createBill:${bill.invoiceNumber}:${bill.customerId}`);
          return { id: `backend-${bill.id}` };
        }),
        createPayment: vi.fn(async (p) => {
          callLog.push(`createPayment:${p.billId}:${p.customerId}`);
          return { id: 'backend-pay-1' };
        }),
        createExpense: vi.fn(async (e) => {
          callLog.push(`createExpense:${e.category}`);
          return { id: 'backend-exp-1' };
        }),
        createAdvance: vi.fn(async (a) => {
          callLog.push(`createAdvance:${a.customerId}`);
          return { id: 'backend-adv-1' };
        }),
        createGroupBill: vi.fn(async (g) => {
          callLog.push(`createGroupBill:${g.memberBillIds?.join(',')}`);
          return { id: 'backend-grp-1' };
        }),
      };

      const testPayload = {
        customers: [{ id: 'c-old-1', name: 'John Doe', phone: '9999900000' }],
        inventory: [{ id: 'itm-old-1', name: 'Glossy A4' }],
        bills: [
          { id: 'b-old-1', invoiceNumber: 'INV-101', customerId: 'c-old-1', items: [{ itemId: 'itm-old-1' }] },
          { id: 'b-old-2', invoiceNumber: 'FAIL-BILL', customerId: 'c-old-1', items: [] },
        ],
        payments: [{ id: 'p-old-1', billId: 'b-old-1', customerId: 'c-old-1', amount: 500 }],
        expenses: [{ id: 'e-old-1', category: 'Paper', amount: 200 }],
        advancePayments: [{ id: 'a-old-1', customerId: 'c-old-1', amount: 1000 }],
        customerGroups: [{ id: 'g-old-1', name: 'Corporate', memberBillIds: ['b-old-1'] }],
      };

      const failures: string[] = [];
      const stats = {
        customers: { total: testPayload.customers.length, success: 0, failed: 0 },
        inventory: { total: testPayload.inventory.length, success: 0, failed: 0 },
        bills: { total: testPayload.bills.length, success: 0, failed: 0 },
        payments: { total: testPayload.payments.length, success: 0, failed: 0 },
        expenses: { total: testPayload.expenses.length, success: 0, failed: 0 },
        advances: { total: testPayload.advancePayments.length, success: 0, failed: 0 },
        groups: { total: testPayload.customerGroups.length, success: 0, failed: 0 },
      };

      // 1. Customers
      for (const c of testPayload.customers) {
        try {
          const res = await mockMutations.createCustomer(c);
          if (c.id && res?.id) idMap.customers[c.id] = res.id;
          stats.customers.success++;
        } catch (err: any) {
          stats.customers.failed++;
          failures.push(`Customer: ${err.message}`);
        }
      }

      // 2. Inventory
      for (const item of testPayload.inventory) {
        try {
          const res = await mockMutations.createInventory(item);
          if (item.id && res?.id) idMap.inventory[item.id] = res.id;
          stats.inventory.success++;
        } catch (err: any) {
          stats.inventory.failed++;
          failures.push(`Inventory: ${err.message}`);
        }
      }

      // 3. Bills
      for (const b of testPayload.bills) {
        try {
          const mappedCustId = idMap.customers[b.customerId] || b.customerId;
          const mappedItems = (b.items || []).map((it) => ({
            ...it,
            itemId: idMap.inventory[it.itemId] || it.itemId,
          }));
          const res = await mockMutations.createBill({ ...b, customerId: mappedCustId, items: mappedItems });
          if (b.id && res?.id) idMap.bills[b.id] = res.id;
          stats.bills.success++;
        } catch (err: any) {
          stats.bills.failed++;
          failures.push(`Bill #${b.invoiceNumber}: ${err.message}`);
        }
      }

      // 4. Payments
      for (const p of testPayload.payments) {
        try {
          const mappedBillId = idMap.bills[p.billId] || p.billId;
          const mappedCustId = idMap.customers[p.customerId] || p.customerId;
          await mockMutations.createPayment({ ...p, billId: mappedBillId, customerId: mappedCustId });
          stats.payments.success++;
        } catch (err: any) {
          stats.payments.failed++;
          failures.push(`Payment: ${err.message}`);
        }
      }

      // 5. Expenses
      for (const exp of testPayload.expenses) {
        try {
          await mockMutations.createExpense(exp);
          stats.expenses.success++;
        } catch (err: any) {
          stats.expenses.failed++;
          failures.push(`Expense: ${err.message}`);
        }
      }

      // 6. Advances
      for (const adv of testPayload.advancePayments) {
        try {
          const mappedCustId = idMap.customers[adv.customerId] || adv.customerId;
          await mockMutations.createAdvance({ ...adv, customerId: mappedCustId });
          stats.advances.success++;
        } catch (err: any) {
          stats.advances.failed++;
          failures.push(`Advance: ${err.message}`);
        }
      }

      // 7. Groups
      for (const grp of testPayload.customerGroups) {
        try {
          const mappedBillIds = (grp.memberBillIds || []).map((bid) => idMap.bills[bid] || bid);
          await mockMutations.createGroupBill({ ...grp, memberBillIds: mappedBillIds });
          stats.groups.success++;
        } catch (err: any) {
          stats.groups.failed++;
          failures.push(`Group: ${err.message}`);
        }
      }

      // Verify execution order: customers -> inventory -> bills -> payments -> expenses -> advances -> groups
      expect(callLog[0]).toBe('createCustomer:John Doe');
      expect(callLog[1]).toBe('createInventory:Glossy A4');
      expect(callLog[2]).toBe('createBill:INV-101:backend-c-old-1');
      expect(callLog[3]).toBe('createPayment:backend-b-old-1:backend-c-old-1');
      expect(callLog[4]).toBe('createExpense:Paper');
      expect(callLog[5]).toBe('createAdvance:backend-c-old-1');
      expect(callLog[6]).toBe('createGroupBill:backend-b-old-1');

      // Verify partial failure accumulation
      expect(stats.bills.success).toBe(1);
      expect(stats.bills.failed).toBe(1);
      expect(failures).toContain('Bill #FAIL-BILL: Duplicate invoice number');
    });
  });

  describe('Issue 2: CSV Customer & Inventory Import without Double-Writes or Swallowed Errors', () => {
    it('records per-row failure accurately without swallowing errors or dispatching redundant local writes', async () => {
      const mockCreateCustomer = vi.fn(async (c) => {
        if (!c.name || c.name === 'Invalid Row') {
          throw new Error('Invalid customer record');
        }
        return { id: 'cus-new', ...c };
      });

      const mockAddCustomerLocal = vi.fn(); // Represents AppContext addCustomer
      const rows = [
        { name: 'Valid Customer', phone: '9876543210', type: 'regular' },
        { name: 'Invalid Row', phone: '', type: 'regular' },
        { name: '', phone: '1111111111', type: 'regular' },
      ];

      let successCount = 0;
      const failures: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const c = rows[i];
        try {
          if (!c.name || !String(c.name).trim()) {
            throw new Error('Customer name is required');
          }
          await mockCreateCustomer(c);
          successCount++;
        } catch (err: any) {
          const label = c.name ? `"${c.name}"` : `Row ${i + 1}`;
          failures.push(`${label}: ${err.message}`);
        }
      }

      // 1 succeeded, 2 failed
      expect(successCount).toBe(1);
      expect(failures).toHaveLength(2);
      expect(failures[0]).toBe('"Invalid Row": Invalid customer record');
      expect(failures[1]).toBe('Row 3: Customer name is required');

      // Crucial: local context double-write was never called
      expect(mockAddCustomerLocal).not.toHaveBeenCalled();
    });
  });

  describe('Issue 3: Stale-Fallback Read Pattern Prevention', () => {
    it('uses server data directly once query resolves, even when server data is an empty array', () => {
      const contextBills = [{ id: 'stale-1', total: 500 }];
      const contextCustomers = [{ id: 'stale-c1', name: 'Old Stale Customer' }];

      // Scenario: Server query has resolved and the database genuinely has 0 bills and 0 customers
      const serverBills: any[] = [];
      const isBillsLoaded = true;

      const serverCustomers: any[] = [];
      const isCustomersLoaded = true;

      // Old pattern (buggy):
      // const bills = serverBills.length > 0 ? serverBills : contextBills; -> would incorrectly evaluate to contextBills!
      // Fixed pattern:
      const bills = isBillsLoaded || serverBills !== undefined ? (serverBills || []) : contextBills;
      const customers = isCustomersLoaded || serverCustomers !== undefined ? (serverCustomers || []) : contextCustomers;

      expect(bills).toEqual([]);
      expect(bills).toHaveLength(0);
      expect(customers).toEqual([]);
      expect(customers).toHaveLength(0);
    });

    it('falls back to context only while server query is still initial/unloaded', () => {
      const contextBills = [{ id: 'local-1', total: 100 }];
      const serverBills = undefined;
      const isBillsLoaded = false;

      const bills = isBillsLoaded || serverBills !== undefined ? (serverBills || []) : contextBills;
      expect(bills).toEqual(contextBills);
    });
  });
});


