import { describe, it, expect } from 'vitest';
import {
  searchBills,
  searchCustomers,
  searchInventory,
  searchExpenses,
  searchAdvances,
  globalOmniSearch,
  sortResults,
} from '../../utils/search';

describe('Global Omni-Search Audit & 5-Entity Registry Lookup Suite', () => {
  const mockBills = [
    {
      id: 'bill-1',
      billSequence: 'BILL-0001',
      invoiceNumber: 'INV-2026-0001',
      customerName: 'Aarav Sharma',
      customerPhone: '9876543210',
      total: 1250,
      status: 'unpaid',
      date: '2026-09-12',
      items: [
        { name: 'Flex Banner 8x4', quantity: 1, rate: 800, amount: 800 },
        { name: 'Visiting Cards 1000pcs', quantity: 1, rate: 450, amount: 450 },
      ],
    },
    {
      id: 'bill-2',
      bill_sequence: 'BILL-0002',
      customer_name: 'Priya Patel',
      customer_phone: '9123456780',
      total_amount: 500,
      status: 'paid',
      date: '2026-09-10',
      items: [
        { itemName: 'A4 Color Document Print', qty: 50, unitPrice: 10, total: 500 },
      ],
    },
    {
      id: 'bill-3',
      deleted: true,
      billSequence: 'BILL-0003',
      customerName: 'Deleted Customer Record',
      total: 100,
      items: [{ name: 'A4 B/W Copy' }],
    },
  ];

  const mockCustomers = [
    {
      id: 'cus-1',
      code: 'CUS-0001',
      name: 'Aarav Sharma',
      phone: '9876543210',
      email: 'aarav@example.com',
      gstNumber: '27AAAAA0000A1Z5',
      creditBalance: 1250,
      type: 'regular',
    },
    {
      id: 'cus-2',
      customer_code: 'CUS-0002',
      name: 'Priya Patel',
      phone: '9123456780',
      email: 'priya@example.com',
      credit_balance: 0,
      type: 'random',
    },
    {
      id: 'cus-3',
      deleted: true,
      name: 'Deleted User',
    },
  ];

  const mockInventory = [
    {
      id: 'itm-1',
      name: 'A4 75 GSM Glossy Paper',
      itemCode: 'ITM-000001',
      hsnCode: '4911',
      colorSingle: 10,
      bwSingle: 3,
    },
    {
      id: 'itm-2',
      name: 'A3 100 GSM Bond Paper',
      item_code: 'ITM-000002',
      hsn_code: '4911',
      color_single: 20,
      bw_single: 6,
    },
  ];

  const mockExpenses = [
    {
      id: 'exp-1',
      voucherNumber: 'EXP-0001',
      category: 'Paper & Ink',
      description: 'Bought 50 reams JK Copier',
      amount: 4500,
      vendor: 'JK Paper Mart',
      paymentMethod: 'UPI',
      date: '2026-09-11',
    },
    {
      id: 'exp-2',
      voucher_number: 'EXP-0002',
      category: 'Electricity',
      description: 'EB Commercial Power Bill',
      amount: 1800,
      vendor: 'State Electricity Board',
      payment_method: 'Cash',
      date: '2026-09-08',
    },
  ];

  const mockAdvances = [
    {
      id: 'adv-1',
      receiptNumber: 'ADV-0001',
      customerName: 'Aarav Sharma',
      customerId: 'cus-1',
      amount: 2000,
      paymentMethod: 'Cash',
      date: '2026-09-05',
    },
  ];

  it('searches bills by line-item content (e.g. searching "Flex Banner" finds the bill)', () => {
    const results = searchBills(mockBills, 'Flex Banner');
    expect(results).toHaveLength(1);
    expect(results[0].billSequence).toBe('BILL-0001');
  });

  it('searches bills by phone number and sequence code with polymorphic safety', () => {
    const phoneResults = searchBills(mockBills, '9123456780');
    expect(phoneResults).toHaveLength(1);
    expect(phoneResults[0].customer_name).toBe('Priya Patel');

    const seqResults = searchBills(mockBills, 'BILL-0002');
    expect(seqResults).toHaveLength(1);
    expect(seqResults[0].id).toBe('bill-2');
  });

  it('filters deleted bills and customers automatically', () => {
    const billResults = searchBills(mockBills, 'Deleted');
    expect(billResults).toHaveLength(0);

    const cusResults = searchCustomers(mockCustomers, 'Deleted');
    expect(cusResults).toHaveLength(0);
  });

  it('searches customers by GST number, code, and credit balance status', () => {
    const gstResults = searchCustomers(mockCustomers, '27AAAAA0000A1Z5');
    expect(gstResults).toHaveLength(1);
    expect(gstResults[0].name).toBe('Aarav Sharma');

    const withCredit = searchCustomers(mockCustomers, '', { hasCredit: 'true' });
    expect(withCredit).toHaveLength(1);
    expect(withCredit[0].id).toBe('cus-1');
  });

  it('searches inventory and expenses seamlessly', () => {
    const invResults = searchInventory(mockInventory, 'Glossy');
    expect(invResults).toHaveLength(1);
    expect(invResults[0].name).toBe('A4 75 GSM Glossy Paper');

    const expResults = searchExpenses(mockExpenses, 'JK Copier');
    expect(expResults).toHaveLength(1);
    expect(expResults[0].voucherNumber).toBe('EXP-0001');
  });

  it('executes globalOmniSearch aggregating top matches across all 5 registers', () => {
    const omni = globalOmniSearch({
      bills: mockBills,
      customers: mockCustomers,
      inventory: mockInventory,
      expenses: mockExpenses,
      advances: mockAdvances,
      query: 'Aarav',
      limitPerCategory: 3,
    });

    expect(omni.bills).toHaveLength(1);
    expect(omni.customers).toHaveLength(1);
    expect(omni.advances).toHaveLength(1);
    expect(omni.totalMatches).toBe(3);
  });

  it('sorts polymorphic search results cleanly without NaN errors', () => {
    const sorted = sortResults(mockBills, 'total', 'desc');
    expect(sorted[0].id).toBe('bill-1'); // 1250 > 500
    expect(sorted[1].id).toBe('bill-2');
  });
});
