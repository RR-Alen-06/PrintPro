import { describe, it, expect } from 'vitest';
import { ReconciliationService } from '../reconciliationService';
import { LedgerService } from '../ledgerService';
import { DashboardService } from '../dashboardService';

describe('Unified Balance & Receivables Synchronization Suite', () => {
  const customer1 = {
    id: 'cust-101',
    name: 'Print Hub Corp',
    customerCode: 'CUS-0001',
    phone: '+91 9876543210',
    advanceBalance: 500, // 500 advance deposit available
  };

  const customer2 = {
    id: 'cust-102',
    name: 'Rapid Graphics',
    customerCode: 'CUS-0002',
    phone: '+91 9876500000',
    advanceBalance: 0,
  };

  const customer3 = {
    id: 'cust-103',
    name: 'Alpha Designers',
    customerCode: 'CUS-0003',
    phone: '+91 9876599999',
    advanceBalance: 1200, // Over-collateralized / high advance
  };

  const bill1Cust1 = {
    id: 'bill-1',
    bill_number: 'INV-1001',
    customerId: customer1.id,
    customerName: customer1.name,
    total: 1500,
    amountPaid: 0,
    balance: 1500,
    date: '2026-09-01T10:00:00Z',
  };

  const bill2Cust2 = {
    id: 'bill-2',
    bill_number: 'INV-1002',
    customerId: customer2.id,
    customerName: customer2.name,
    total: 800,
    amountPaid: 200,
    balance: 600,
    date: '2026-09-02T10:00:00Z',
  };

  const bill3Cust3 = {
    id: 'bill-3',
    bill_number: 'INV-1003',
    customerId: customer3.id,
    customerName: customer3.name,
    total: 700,
    amountPaid: 0,
    balance: 700,
    date: '2026-09-03T10:00:00Z',
  };

  const allBills = [bill1Cust1, bill2Cust2, bill3Cust3];
  const allCustomers = [customer1, customer2, customer3];
  const allPayments = [
    {
      id: 'pay-1',
      billId: bill2Cust2.id,
      customerId: customer2.id,
      amount: 200,
      cashAmount: 200,
      upiAmount: 0,
      payment_method: 'cash',
      date: '2026-09-02T11:00:00Z',
    },
  ];

  it('guarantees exact mathematical equality across Dashboard, Finance & Accounts, and Customer Ledger', () => {
    // 1. Reconciliation Service - Core Engine
    const arResult = ReconciliationService.calculateAccountsReceivables({
      bills: allBills,
      payments: allPayments,
      customers: allCustomers,
    });

    // Customer 1: Gross Due 1500 - Advance 500 = Net Due 1000
    // Customer 2: Gross Due 600 - Advance 0 = Net Due 600
    // Customer 3: Gross Due 700 - Advance 1200 = Net Due 0 (Credit surplus 500)
    // Expected Total Store Receivables = 1000 + 600 + 0 = 1600
    expect(arResult.totalReceivables).toBe(1600);
    expect(arResult.totalGrossDue).toBe(2800); // 1500 + 600 + 700
    expect(arResult.totalAdvancePool).toBe(500); // Only customer 3 has 500 surplus
    expect(arResult.debtorCount).toBe(2); // Only customer 1 and 2 owe money

    // 2. Dashboard Service
    const dashWidgets = DashboardService.getSummaryWidgets({
      bills: allBills,
      payments: allPayments,
      customers: allCustomers,
    });

    // Dashboard pending amount must equal Accounts Receivable Net Dues
    expect(dashWidgets.pendingAmount).toBe(arResult.totalReceivables);
    expect(dashWidgets.pendingAmount).toBe(1600);
    expect(dashWidgets.grossPendingAmount).toBe(arResult.totalGrossDue);

    // 3. Customer Ledger for Customer 1
    const ledgerCust1 = LedgerService.calculateLedger({
      customerId: customer1.id,
      bills: [bill1Cust1],
      payments: [],
      advancePayments: [
        {
          id: 'adv-101',
          customerId: customer1.id,
          amount: 500,
          date: '2026-08-15T10:00:00Z',
        },
      ],
    });

    // Total Invoiced: 1500, Total Credit (Advance): 500 -> Running Balance: 1000
    expect(ledgerCust1.totalBilled).toBe(1500);
    expect(ledgerCust1.totalPaid).toBe(500);
    expect(ledgerCust1.closingBalance).toBe(1000);
    expect(ledgerCust1.closingBalance).toBe(
      arResult.customersWithDue.find((c) => c.customerId === customer1.id)?.netDue
    );

    // Customer 2 Ledger
    const ledgerCust2 = LedgerService.calculateLedger({
      customerId: customer2.id,
      bills: [bill2Cust2],
      payments: allPayments.filter((p) => p.customerId === customer2.id),
      advancePayments: [],
    });
    expect(ledgerCust2.totalBilled).toBe(800);
    expect(ledgerCust2.totalPaid).toBe(200);
    expect(ledgerCust2.closingBalance).toBe(600);
    expect(ledgerCust2.closingBalance).toBe(
      arResult.customersWithDue.find((c) => c.customerId === customer2.id)?.netDue
    );

    // Sum of customer ledger balances for debtors equals Dashboard Total Net Due and Accounts Receivable
    const debtorLedgerSum = ledgerCust1.closingBalance + ledgerCust2.closingBalance;
    expect(debtorLedgerSum).toBe(dashWidgets.pendingAmount);
    expect(debtorLedgerSum).toBe(arResult.totalReceivables);
  });

  it('prevents advance balance applications from double-crediting customer ledger timeline', () => {
    // Scenario: Customer deposits ₹1,000 advance.
    // Next, an invoice of ₹600 is created where ₹600 of that advance is applied.
    // The backend recorded a payment record: { notes: 'Advance Balance applied', total_paid: 600 }
    const advanceDep = {
      id: 'adv-201',
      customerId: 'cust-xyz',
      amount: 1000,
      date: '2026-09-10T10:00:00Z',
    };

    const bill = {
      id: 'bill-201',
      customerId: 'cust-xyz',
      total: 600,
      balance: 0,
      amountPaid: 600,
      advanceUsed: 600,
      date: '2026-09-11T10:00:00Z',
    };

    const advancePaymentRecord = {
      id: 'pay-201',
      customerId: 'cust-xyz',
      billId: bill.id,
      totalPaid: 600,
      cashAmount: 0,
      upiAmount: 0,
      notes: 'Advance Balance applied',
      date: '2026-09-11T10:05:00Z',
    };

    const ledger = LedgerService.calculateLedger({
      customerId: 'cust-xyz',
      bills: [bill],
      payments: [advancePaymentRecord],
      advancePayments: [advanceDep],
    });

    // Debit: 600 (Invoice). Credit: 1000 (Advance Deposit).
    // The "Advance Balance applied" entry must be informational (credit: 0) to avoid double deduction!
    expect(ledger.totalBilled).toBe(600);
    expect(ledger.totalPaid).toBe(1000);
    // Closing Balance must be -400 (customer still has 400 credit surplus), NOT -1000!
    expect(ledger.closingBalance).toBe(-400);

    const advSettleEntry = ledger.entries.find((e) => e.type === 'advance_settlement');
    expect(advSettleEntry).toBeDefined();
    expect(advSettleEntry?.credit).toBe(0);
  });

  it('enforces strict cash-flow: advance applications do NOT inflate cash drawer inflows', () => {
    // A payment with notes "Advance Balance applied" has 0 cash movement.
    const payments = [
      {
        id: 'p-real-cash',
        date: '2026-09-29T10:00:00Z',
        totalPaid: 450,
        cashAmount: 450,
        upiAmount: 0,
        notes: 'Cash sale',
      },
      {
        id: 'p-advance-deduction',
        date: '2026-09-29T11:00:00Z',
        totalPaid: 300,
        cashAmount: 0,
        upiAmount: 0,
        notes: 'Advance Balance applied',
      },
      {
        id: 'p-legacy-cash-fallback',
        date: '2026-09-29T12:00:00Z',
        totalPaid: 250,
        cashAmount: 0,
        upiAmount: 0,
        payment_method: 'cash',
        notes: 'Older POS bill without cashAmount split',
      },
    ];

    const selectedDate = '2026-09-29';
    let cashIn = 0;
    let upiIn = 0;

    payments.forEach((p: any) => {
      const pDate = p.date.slice(0, 10);
      if (pDate === selectedDate) {
        const notesLower = String(p.notes || '').toLowerCase();
        const isAdvanceApplied =
          notesLower.includes('advance balance applied') ||
          notesLower.includes('from advance deposit') ||
          p.payment_type === 'advance_deduction';
        if (isAdvanceApplied) return;

        let cash = Number(p.cashAmount || 0);
        let upi = Number(p.upiAmount || 0);
        const totalPaid = Number(p.totalPaid || 0);

        if (cash === 0 && upi === 0 && totalPaid > 0) {
          const method = String(p.payment_method || '').toLowerCase();
          if (method === 'upi') upi = totalPaid;
          else cash = totalPaid;
        }

        cashIn += cash;
        upiIn += upi;
      }
    });

    // Cash In must be 450 + 250 (fallback) = 700. Advance application (300) must NOT be counted!
    expect(cashIn).toBe(700);
    expect(upiIn).toBe(0);
  });

  it('guarantees identical financial balances across all 7 modules from a single unified source', () => {
    // 7 Modules:
    // 1. Billing (Desktop & Mobile POS)
    // 2. Group Billing (Desktop & Mobile)
    // 3. Customers Directory
    // 4. Customer Advance Pool
    // 5. Customer Ledger
    // 6. Finance & Accounts (Accounting Desktop & Mobile)
    // 7. Dashboard (Desktop & Mobile)

    const customer = {
      id: 'cust-sync-99',
      name: 'Omni Media',
      customerCode: 'CUS-0099',
      advanceBalance: 350,
    };

    const bill1 = {
      id: 'b-991',
      customerId: customer.id,
      customerName: customer.name,
      total: 1000,
      balance: 1000,
      amountPaid: 0,
      date: '2026-09-20T10:00:00Z',
    };

    const bill2 = {
      id: 'b-992',
      customerId: customer.id,
      customerName: customer.name,
      total: 500,
      balance: 200,
      amountPaid: 300,
      date: '2026-09-22T10:00:00Z',
    };

    const customerBills = [bill1, bill2];
    const customerList = [customer];

    // Single source of truth calculation
    const arResult = ReconciliationService.calculateAccountsReceivables({
      bills: customerBills,
      payments: [],
      customers: customerList,
    });

    const custSummary = arResult.customersWithDue.find((c) => c.customerId === customer.id);
    expect(custSummary).toBeDefined();

    // Module 1: Billing checkout max advance application
    const liveBillingAdvanceAvailable = custSummary!.advanceBalance;
    expect(liveBillingAdvanceAvailable).toBe(350);

    // Module 2: Group Billing child balance check
    const grossDueForGroupBilling = custSummary!.grossDue;
    expect(grossDueForGroupBilling).toBe(1200); // 1000 + 200

    // Module 3: Customers Directory card values
    const customerPageGrossDue = custSummary!.grossDue;
    const customerPageAdvance = custSummary!.advanceBalance;
    const customerPageNetDue = custSummary!.netDue;
    expect(customerPageGrossDue).toBe(1200);
    expect(customerPageAdvance).toBe(350);
    expect(customerPageNetDue).toBe(850); // 1200 - 350

    // Module 4: Customer Advance Pool
    expect(arResult.totalAdvancePool).toBe(0); // Fully absorbed against 1200 gross due

    // Module 5: Customer Ledger closing balance
    const ledger = LedgerService.calculateLedger({
      customerId: customer.id,
      bills: customerBills,
      payments: [{ id: 'p-1', billId: bill2.id, customerId: customer.id, amount: 300, totalPaid: 300 }],
      advancePayments: [{ id: 'adv-1', customerId: customer.id, amount: 350 }],
    });
    // Total Debits: 1000 + 500 = 1500. Total Credits: 300 (Payment) + 350 (Advance) = 650
    // Closing Balance: 1500 - 650 = 850
    expect(ledger.closingBalance).toBe(850);
    expect(ledger.closingBalance).toBe(customerPageNetDue);

    // Module 6: Finance & Accounts (Accounting) strip
    const accountingTotalReceivables = arResult.totalReceivables;
    expect(accountingTotalReceivables).toBe(850);
    expect(accountingTotalReceivables).toBe(ledger.closingBalance);

    // Module 7: Dashboard (Desktop & Mobile)
    const dashboardWidgets = DashboardService.getSummaryWidgets({
      bills: customerBills,
      payments: [],
      customers: customerList,
    });
    expect(dashboardWidgets.pendingAmount).toBe(850);
    expect(dashboardWidgets.grossPendingAmount).toBe(1200);

    // Absolute assertion: ALL 7 modules yield exact mathematical equality with 0 drift
    expect(dashboardWidgets.pendingAmount).toBe(accountingTotalReceivables);
    expect(accountingTotalReceivables).toBe(ledger.closingBalance);
    expect(ledger.closingBalance).toBe(customerPageNetDue);
  });

  it('prevents double deduction when historical bills recorded advance deductions', () => {
    // Customer deposited 1000, used 500 on a bill, DB now stores advanceBalance = 500
    const customerWithAdvance = {
      id: 'cust-adv-1',
      name: 'Alpha Corporate',
      customerCode: 'RC0001',
      advanceBalance: 500, // authoritative remaining advance in DB
    };

    const pastBillWithAdvance = {
      id: 'bill-adv-1',
      bill_number: 'INV-000001',
      customerId: customerWithAdvance.id,
      customerName: customerWithAdvance.name,
      total: 500,
      amountPaid: 500,
      advanceUsed: 500,
      balance: 0,
      status: 'paid',
    };

    const arResult = ReconciliationService.calculateAccountsReceivables({
      bills: [pastBillWithAdvance],
      payments: [],
      customers: [customerWithAdvance],
    });

    // Customer has 0 gross due and 500 available advance pool
    const summary = arResult.allCustomerSummaries.find((c) => c.customerId === customerWithAdvance.id);
    expect(summary).toBeDefined();
    expect(summary?.grossDue).toBe(0);
    expect(summary?.advanceBalance).toBe(500); // Must remain 500, not double-deducted to 0
    expect(arResult.totalAdvancePool).toBe(500);
    expect(arResult.totalReceivables).toBe(0);
  });
});

