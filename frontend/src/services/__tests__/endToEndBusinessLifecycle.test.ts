import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SequenceService } from '../sequenceService'
import { BillingService } from '../billingService'
import { CreditService } from '../creditService'
import { LedgerService } from '../ledgerService'
import { ReconciliationService } from '../reconciliationService'
import { GstService } from '../gstService'

describe('End-to-End Business Lifecycle Workflow Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs complete one-to-one workflow: Customer -> Advance -> Mixed POS Bill -> Ledger -> Settlement -> Expense -> Cash Drawer', () => {
    // =========================================================================
    // STEP 1: CUSTOMER ONBOARDING
    // =========================================================================
    const customerCode = SequenceService.formatSequenceCode('CUS', 1, 6)
    expect(customerCode).toBe('CUS-000001')

    const customer = {
      id: 'cust-101',
      customerCode,
      name: 'Alen Enterprises',
      phone: '9876543210',
      type: 'regular',
      advanceBalance: 0,
      creditBalance: 0,
      creditLimit: 10000,
      deleted: false,
    }
    expect(customer.advanceBalance).toBe(0)
    expect(customer.creditLimit).toBe(10000)

    // =========================================================================
    // STEP 2: ADVANCE DEPOSIT RECORDING (Cash + UPI Split)
    // =========================================================================
    const advanceRef = SequenceService.formatSequenceCode('ADV', 501, 6)
    expect(advanceRef).toBe('ADV-000501')

    const advanceDeposit = {
      id: advanceRef,
      customerId: customer.id,
      customerName: customer.name,
      amount: 500,
      cashAmount: 300,
      upiAmount: 200,
      date: '2026-09-28',
      notes: 'Initial advance deposit for upcoming print jobs',
      isReturn: false,
      isRefundCredit: false,
    }

    // Assert advance deposit math
    expect(advanceDeposit.cashAmount + advanceDeposit.upiAmount).toBe(advanceDeposit.amount)

    // Update customer wallet balance
    customer.advanceBalance += advanceDeposit.amount
    expect(customer.advanceBalance).toBe(500)

    // =========================================================================
    // STEP 3: POS BILLING & INVOICING (Mixed-Mode: Advance + Cash + Credit Due)
    // =========================================================================
    const invoiceNumber = SequenceService.formatSequenceCode('INV', 1001, 6)
    expect(invoiceNumber).toBe('INV-001001')

    const lineItems = [
      { itemId: 'itm-1', itemName: 'A4 Color Posters', printType: 'color', sides: 'single', qty: 20, unitPrice: 20, gstRate: 18 }, // 400
      { itemId: 'itm-2', itemName: 'A4 B/W Manuals', printType: 'bw', sides: 'double', qty: 40, unitPrice: 10, gstRate: 18 },       // 400
    ]

    // Bill calculations
    const billMath = BillingService.calculateBill({
      items: lineItems,
      discountType: 'flat',
      discountValue: 0,
      roundingMethod: 'Standard',
    })

    expect(billMath.subtotal).toBe(800)
    expect(billMath.taxableAmount).toBe(800)
    expect(billMath.gstAmount).toBe(144) // 18% of 800

    const gstBreakdown = GstService.calculateTax(billMath.taxableAmount, 18)
    expect(gstBreakdown.cgstAmount).toBe(72)
    expect(gstBreakdown.sgstAmount).toBe(72)
    expect(gstBreakdown.totalGstAmount).toBe(144)
    expect(billMath.roundedTotal).toBe(944) // 800 + 144 GST

    // Drawdown available customer advance
    const drawdown = CreditService.calculateAdvanceDrawdown(customer.advanceBalance, billMath.roundedTotal)
    expect(drawdown.advanceUsed).toBe(500) // All 500 advance utilized
    expect(drawdown.remainingAdvance).toBe(0) // Wallet depleted
    expect(drawdown.netBillAmount).toBe(444) // 944 - 500 = 444 remaining to be paid

    customer.advanceBalance = drawdown.remainingAdvance
    expect(customer.advanceBalance).toBe(0)

    // At POS counter, customer pays ₹344 in Cash, leaving ₹100 unpaid on Credit
    const cashPaidAtCounter = 344
    const upiPaidAtCounter = 0
    const totalDirectPaid = cashPaidAtCounter + upiPaidAtCounter
    const balanceDue = drawdown.netBillAmount - totalDirectPaid
    expect(balanceDue).toBe(100)

    const billRecord = {
      id: 'bill-1001',
      invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      date: '2026-09-28',
      items: lineItems,
      subtotal: billMath.subtotal,
      gstAmount: billMath.gstAmount,
      total: billMath.roundedTotal,
      advanceUsed: drawdown.advanceUsed,
      cashAmount: cashPaidAtCounter,
      upiAmount: upiPaidAtCounter,
      amountPaid: totalDirectPaid,
      balance: balanceDue,
      status: balanceDue === 0 ? 'paid' : (totalDirectPaid + drawdown.advanceUsed > 0 ? 'partial' : 'unpaid'),
      deleted: false,
    }

    expect(billRecord.status).toBe('partial')
    expect(billRecord.balance).toBe(100)

    // Initial payment record created for counter payment
    const paymentRecord1 = {
      id: 'pay-2001',
      billId: billRecord.id,
      customerId: customer.id,
      customerName: customer.name,
      date: '2026-09-28',
      cashAmount: cashPaidAtCounter,
      upiAmount: upiPaidAtCounter,
      totalPaid: totalDirectPaid,
      paymentType: 'counter',
      isRefund: false,
    }

    // =========================================================================
    // STEP 4: CUSTOMER LEDGER STATEMENT AUDIT
    // =========================================================================
    const ledgerBeforeSettlement = LedgerService.buildCustomerLedger({
      bills: [billRecord],
      payments: [paymentRecord1],
      openingBalance: 0,
    })

    expect(ledgerBeforeSettlement.totalBilled).toBe(944)
    expect(ledgerBeforeSettlement.runningBalance).toBe(100)

    // =========================================================================
    // STEP 5: SUBSEQUENT DEBT SETTLEMENT
    // =========================================================================
    // Customer pays the remaining ₹100 via UPI on the next day
    const paymentRecord2 = {
      id: 'pay-2002',
      billId: billRecord.id,
      customerId: customer.id,
      customerName: customer.name,
      date: '2026-09-29',
      cashAmount: 0,
      upiAmount: 100,
      totalPaid: 100,
      paymentType: 'settlement',
      isRefund: false,
    }

    // Update bill record
    billRecord.amountPaid += paymentRecord2.totalPaid
    billRecord.balance -= paymentRecord2.totalPaid
    billRecord.status = billRecord.balance <= 0 ? 'paid' : 'partial'

    expect(billRecord.balance).toBe(0)
    expect(billRecord.status).toBe('paid')
    expect(billRecord.amountPaid + billRecord.advanceUsed).toBe(billRecord.total)

    // Rebuild Ledger after debt clearance
    const ledgerAfterSettlement = LedgerService.buildCustomerLedger({
      bills: [billRecord],
      payments: [paymentRecord1, paymentRecord2],
      openingBalance: 0,
    })

    expect(ledgerAfterSettlement.runningBalance).toBe(0)
    expect(ledgerAfterSettlement.entries.length).toBeGreaterThanOrEqual(2)

    // =========================================================================
    // STEP 6: OPERATIONAL EXPENSE LOGGING
    // =========================================================================
    const expenseRecord = {
      id: 'exp-301',
      description: 'Thermal Paper Rolls & Ink Refill',
      category: 'Supplies',
      amount: 150,
      cashAmount: 150,
      upiAmount: 0,
      date: '2026-09-28',
    }

    // =========================================================================
    // STEP 7: ACCOUNTING, CASHBOOK & CASH DRAWER RECONCILIATION
    // =========================================================================
    // Cash Inflow: Advance (₹300) + Bill Cash (₹344) = ₹644
    const totalCashInflow = advanceDeposit.cashAmount + paymentRecord1.cashAmount + paymentRecord2.cashAmount
    expect(totalCashInflow).toBe(644)

    // UPI Inflow: Advance (₹200) + Settlement UPI (₹100) = ₹300
    const totalUpiInflow = advanceDeposit.upiAmount + paymentRecord1.upiAmount + paymentRecord2.upiAmount
    expect(totalUpiInflow).toBe(300)

    // Gross Inflow = 644 + 300 = 944
    expect(totalCashInflow + totalUpiInflow).toBe(944)

    // Cash Spent on Expenses: ₹150
    const totalCashSpent = expenseRecord.cashAmount
    expect(totalCashSpent).toBe(150)

    // Net Cash Flow = Total Inflow - Expenses = 944 - 150 = 794
    const netCashFlow = (totalCashInflow + totalUpiInflow) - expenseRecord.amount
    expect(netCashFlow).toBe(794)

    // Cash Drawer Reconciliation:
    // Opening balance in drawer: ₹1000
    // Cash added from sales/advances: +₹644
    // Cash withdrawn for expenses: -₹150
    // Expected drawer cash: 1000 + 644 - 150 = ₹1494
    const openingDrawerBalance = 1000
    const expectedDrawerCash = openingDrawerBalance + totalCashInflow - totalCashSpent
    expect(expectedDrawerCash).toBe(1494)

    const drawerReconciliation = ReconciliationService.calculateDrawerVariance({
      openingBalance: openingDrawerBalance,
      cashSales: totalCashInflow,
      cashExpenses: totalCashSpent,
      physicalCount: 1494,
    })

    expect(drawerReconciliation.status).toBe('balanced')
    expect(drawerReconciliation.variance).toBe(0)
    expect(drawerReconciliation.expectedCash).toBe(1494)

    // Tax Report (GSTR-1) check
    expect(gstBreakdown.cgstAmount).toBe(72)
    expect(gstBreakdown.sgstAmount).toBe(72)
    expect(gstBreakdown.totalGstAmount).toBe(144)
    expect(billMath.gstAmount).toBe(144)
  })
})
