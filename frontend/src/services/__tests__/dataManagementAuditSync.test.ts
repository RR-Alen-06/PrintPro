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
});

