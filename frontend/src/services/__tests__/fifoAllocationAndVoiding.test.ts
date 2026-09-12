import { describe, it, expect } from 'vitest';
import { CreditService } from '../creditService';
import { BillingService } from '../billingService';

describe('Smart Hybrid FIFO Allocation & Bill Voiding', () => {
  const unpaidBills = [
    { id: 'b1', invoiceNumber: 'INV-000001', date: '2026-09-01T10:00:00Z', total: 200, balance: 200, status: 'unpaid' },
    { id: 'b2', invoiceNumber: 'INV-000002', date: '2026-09-05T10:00:00Z', total: 300, balance: 300, status: 'unpaid' },
    { id: 'b3', invoiceNumber: 'INV-000003', date: '2026-09-10T10:00:00Z', total: 150, balance: 150, status: 'unpaid' },
  ];

  it('allocates payment across oldest bills first (FIFO)', () => {
    // Pay ₹350 total: ₹200 to b1, ₹150 to b2, ₹0 to b3
    const result = CreditService.allocatePaymentFIFO(350, unpaidBills);

    expect(result.totalPayment).toBe(350);
    expect(result.totalAllocated).toBe(350);
    expect(result.excessToAdvance).toBe(0);

    expect(result.allocations).toHaveLength(3);
    expect(result.allocations[0].billId).toBe('b1');
    expect(result.allocations[0].allocatedAmount).toBe(200);
    expect(result.allocations[0].newStatus).toBe('paid');

    expect(result.allocations[1].billId).toBe('b2');
    expect(result.allocations[1].allocatedAmount).toBe(150);
    expect(result.allocations[1].remainingBalance).toBe(150);
    expect(result.allocations[1].newStatus).toBe('partial');

    expect(result.allocations[2].billId).toBe('b3');
    expect(result.allocations[2].allocatedAmount).toBe(0);
    expect(result.allocations[2].newStatus).toBe('unpaid');
  });

  it('routes any excess payment over total unpaid balances to advance credit', () => {
    // Total unpaid is ₹650. Customer pays ₹800.
    const result = CreditService.allocatePaymentFIFO(800, unpaidBills);

    expect(result.totalPayment).toBe(800);
    expect(result.totalAllocated).toBe(650);
    expect(result.excessToAdvance).toBe(150);

    expect(result.allocations[0].newStatus).toBe('paid');
    expect(result.allocations[1].newStatus).toBe('paid');
    expect(result.allocations[2].newStatus).toBe('paid');
  });

  it('respects selective bill IDs when provided', () => {
    // User only wants to pay b2 and b3 (total 450). Pays 400.
    const result = CreditService.allocatePaymentFIFO(400, unpaidBills, ['b2', 'b3']);

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0].billId).toBe('b2');
    expect(result.allocations[0].allocatedAmount).toBe(300);
    expect(result.allocations[0].newStatus).toBe('paid');

    expect(result.allocations[1].billId).toBe('b3');
    expect(result.allocations[1].allocatedAmount).toBe(100);
    expect(result.allocations[1].remainingBalance).toBe(50);
    expect(result.allocations[1].newStatus).toBe('partial');
  });

  it('creates void / cancel payload with audit notes and zero balance', () => {
    const bill = { id: 'b1', invoiceNumber: 'INV-000001', balance: 200, notes: 'Original bill note' };
    const voidPayload = BillingService.createVoidBillPayload(bill, 'Customer returned damaged prints');

    expect(voidPayload.status).toBe('cancelled');
    expect(voidPayload.balance).toBe(0);
    expect(voidPayload.is_cancelled).toBe(true);
    expect(voidPayload.cancellation_reason).toBe('Customer returned damaged prints');
    expect(voidPayload.notes).toContain('[VOIDED: Customer returned damaged prints]');
  });
});
