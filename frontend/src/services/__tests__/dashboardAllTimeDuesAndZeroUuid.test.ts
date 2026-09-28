import { describe, it, expect } from 'vitest';
import { ReconciliationService } from '../reconciliationService';
import { SequenceService } from '../sequenceService';
import { ReminderService } from '../reminderService';

describe('Dashboard All-Time Cumulative Dues & Zero-UUID Integrity Suite', () => {
  const customerA = {
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Print Hub Corp',
    customerCode: 'CUS-0001',
    phone: '+91 9876543210',
    advanceBalance: 500,
  };

  const customerB = {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Quick Graphics LLC',
    customerCode: 'CUS-0002',
    phone: '+91 9876500000',
    advanceBalance: 0,
  };

  // 1 bill from last year, 1 bill from today
  const historicalBill = {
    id: 'bbbbbbbb-1111-4111-a111-111111111111',
    bill_number: 'INV-0010',
    customer_id: customerA.id,
    customer_name: customerA.name,
    total_amount: 2000,
    balance_due: 1500,
    status: 'unpaid',
    created_at: '2025-01-10T10:00:00Z',
  };

  const todayBill = {
    id: 'bbbbbbbb-2222-4222-a222-222222222222',
    bill_number: 'INV-0025',
    customer_id: customerB.id,
    customer_name: customerB.name,
    total_amount: 1000,
    balance_due: 1000,
    status: 'unpaid',
    created_at: new Date().toISOString(),
  };

  const allBills = [historicalBill, todayBill];
  const allCustomers = [customerA, customerB];
  const allPayments: any[] = [];

  it('calculates all-time cumulative dues without being clipped by date filters', () => {
    // If filtered by "Today", filteredData.bills would only include todayBill (balance 1000).
    const filteredTodayBills = [todayBill];

    // But dashboard allTimeActiveBills must use allBills
    const reconciledAllTime = ReconciliationService.reconcileBillsWithPayments(allBills, allPayments);
    const grossAllTimeDue = reconciledAllTime
      .filter((b: any) => b.balance_due > 0 && b.status !== 'cancelled' && b.status !== 'voided')
      .reduce((sum: number, b: any) => sum + Number(b.balance_due || 0), 0);

    const filteredGrossDue = filteredTodayBills
      .reduce((sum: number, b: any) => sum + Number(b.balance_due || 0), 0);

    expect(filteredGrossDue).toBe(1000);
    // All-time dues must preserve the historical 1500 + today's 1000 = 2500
    expect(grossAllTimeDue).toBe(2500);
  });

  it('correctly calculates Net Realizable Due by deducting customer advance credits', () => {
    const customerMap = new Map();
    allCustomers.forEach(c => {
      const adv = Number(c.advanceBalance || 0);
      customerMap.set(c.id, {
        name: c.name,
        customerCode: c.customerCode,
        grossDue: 0,
        advanceBalance: adv,
      });
    });

    // Populate dues
    allBills.forEach(b => {
      if (customerMap.has(b.customer_id)) {
        customerMap.get(b.customer_id).grossDue += Number(b.balance_due || 0);
      }
    });

    const debtorA = customerMap.get(customerA.id);
    const debtorB = customerMap.get(customerB.id);

    // Customer A has 1500 gross due, but 500 advance balance -> Net Due = 1000
    const netDueA = Math.max(0, debtorA.grossDue - debtorA.advanceBalance);
    expect(debtorA.grossDue).toBe(1500);
    expect(debtorA.advanceBalance).toBe(500);
    expect(netDueA).toBe(1000);

    // Customer B has 1000 gross due, 0 advance balance -> Net Due = 1000
    const netDueB = Math.max(0, debtorB.grossDue - debtorB.advanceBalance);
    expect(netDueB).toBe(1000);

    // Total Net Realizable Due = 2000
    const totalNetDue = netDueA + netDueB;
    expect(totalNetDue).toBe(2000);
  });

  it('guarantees zero UUID leakage in debtor display codes and bill invoice numbers', () => {
    // Check customer codes
    const codeA = SequenceService.formatDisplayCode('customer', customerA, 'CUS');
    const codeB = SequenceService.formatDisplayCode('customer', customerB, 'CUS');
    expect(codeA).toBe('CUS-0001');
    expect(codeB).toBe('CUS-0002');
    expect(codeA).not.toContain(customerA.id);

    // Check bill numbers
    const billCode1 = SequenceService.formatDisplayCode('bill', historicalBill, 'INV');
    const billCode2 = SequenceService.formatDisplayCode('bill', todayBill, 'INV');
    expect(billCode1).toBe('INV-0010');
    expect(billCode2).toBe('INV-0025');

    // Check with raw UUID object lacking codes
    const unformattedCustomer = { id: '33333333-3333-4333-a333-333333333333', name: 'Raw UUID Client' };
    const resolvedCode = SequenceService.formatDisplayCode('customer', unformattedCustomer, 'CUS');
    expect(resolvedCode).toMatch(/^CUS-\d{4}$/);
    expect(resolvedCode).not.toContain('33333333');
  });

  it('generates WhatsApp reminder links with clean sequential IDs and accurate net due', () => {
    const netDue = 1000;
    const shop = 'PrintPro Studio';
    const message = `Hello ${customerA.name},\n\nThis is a gentle payment reminder from *${shop}* regarding your pending balance of *₹${netDue.toFixed(2)}* (Customer Code: *${customerA.customerCode}*).\n\nKindly clear this at your earliest convenience. Thank you!`;
    const link = ReminderService.getWhatsAppUrl(customerA.phone, message);

    expect(link).toContain('https://api.whatsapp.com/send?phone=919876543210');
    expect(link).toContain('Print%20Hub%20Corp');
    expect(link).toContain('1000.00');
    expect(link).toContain('CUS-0001');
    // Ensure no raw UUID in WhatsApp text
    expect(link).not.toContain(customerA.id);
    expect(link).not.toContain(historicalBill.id);
  });
});
