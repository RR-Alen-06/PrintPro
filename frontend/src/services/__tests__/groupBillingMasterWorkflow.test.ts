import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SequenceService } from '../sequenceService'
import { GroupBillingService } from '../groupBillingService'
import { LedgerService } from '../ledgerService'

describe('Workflow 4: Group & Bulk Master Billing & Batch Ledger Reconciliation One-to-One Trace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs complete one-to-one workflow: Master Group Project -> Multi-Member Split -> Per-Member Settlement (Advance, UPI, Credit) -> Batch Ledger Reconciliation', () => {
    // =========================================================================
    // STAGE 1: GROUP PROJECT & MASTER INVOICE SEQUENCE INITIALIZATION
    // =========================================================================
    const groupSeq = SequenceService.formatSequenceCode('GRP', 105, 6)
    expect(groupSeq).toBe('GRP-000105')

    const corporateOrg = {
      id: 'org-apex-corp',
      name: 'Apex Tech Solutions Ltd',
      project: 'Annual Tech Conference 2026',
      totalEstimatedBudget: 3000.0,
      departments: [
        { id: 'm-eng', customerId: 'cust-eng-01', customerName: 'Apex Engineering', advanceBalance: 1500.0 },
        { id: 'm-mkt', customerId: 'cust-mkt-02', customerName: 'Apex Marketing', advanceBalance: 0.0 },
        { id: 'm-hr',  customerId: 'cust-hr-03',  customerName: 'Apex Human Resources', advanceBalance: 0.0 },
      ],
    }

    // =========================================================================
    // STAGE 2: DETERMINISTIC MULTI-MEMBER SPLIT & TAX ALLOCATION
    // =========================================================================
    // Total print job order: ₹3,000 subtotal across 3 departments with 18% GST
    const splitCalculation = GroupBillingService.calculateSplitPurchase({
      totalAmount: 3000.0,
      members: [
        {
          id: corporateOrg.departments[0].id,
          customerId: corporateOrg.departments[0].customerId,
          customerName: corporateOrg.departments[0].customerName,
          useAdvance: true,
          advanceBalance: 1500.0,
          cashPaid: 0,
          upiPaid: 0,
        },
        {
          id: corporateOrg.departments[1].id,
          customerId: corporateOrg.departments[1].customerId,
          customerName: corporateOrg.departments[1].customerName,
          useAdvance: false,
          advanceBalance: 0,
          cashPaid: 0,
          upiPaid: 1180.0, // Member 2 pays full via UPI
        },
        {
          id: corporateOrg.departments[2].id,
          customerId: corporateOrg.departments[2].customerId,
          customerName: corporateOrg.departments[2].customerName,
          useAdvance: false,
          advanceBalance: 0,
          cashPaid: 380.0, // Member 3 pays ₹380 cash, leaves ₹800 on credit
          upiPaid: 0,
        },
      ],
      gstPercent: 18,
    })

    // Verify aggregate totals
    expect(splitCalculation.aggregateSubtotal).toBe(3000.0)
    expect(splitCalculation.aggregateGst).toBe(540.0)
    expect(splitCalculation.aggregateTotal).toBe(3540.0)
    expect(splitCalculation.memberCalculations.length).toBe(3)

    // =========================================================================
    // STAGE 3: PER-MEMBER SETTLEMENT ACCURACY
    // =========================================================================
    const [calcEng, calcMkt, calcHr] = splitCalculation.memberCalculations

    // Member 1 (Engineering): Subtotal 1000 + GST 180 = 1180. Paid via Advance 1180. Balance: 0.
    expect(calcEng.subtotal).toBe(1000.0)
    expect(calcEng.gstAmount).toBe(180.0)
    expect(calcEng.total).toBe(1180.0)
    expect(calcEng.advanceUsed).toBe(1180.0)
    expect(calcEng.balanceDue).toBe(0.0)

    // Member 2 (Marketing): Total 1180. Paid via UPI 1180. Balance: 0.
    expect(calcMkt.total).toBe(1180.0)
    expect(calcMkt.upiPaid).toBe(1180.0)
    expect(calcMkt.balanceDue).toBe(0.0)

    // Member 3 (HR): Total 1180. Cash Paid: 380. Balance Due: 800.
    expect(calcHr.total).toBe(1180.0)
    expect(calcHr.cashPaid).toBe(380.0)
    expect(calcHr.balanceDue).toBe(800.0)

    // Verify aggregate settlement math matches total exactly
    const totalCollectedOrCredited =
      splitCalculation.aggregateAdvanceUsed +
      splitCalculation.aggregateCashPaid +
      splitCalculation.aggregateUpiPaid +
      splitCalculation.aggregateBalanceDue

    expect(totalCollectedOrCredited).toBe(splitCalculation.aggregateTotal) // 1180 + 380 + 1180 + 800 = 3540

    // =========================================================================
    // STAGE 4: BATCH LEDGER SYNCHRONIZATION FOR HR RECEIVABLES
    // =========================================================================
    // Verify Member 3's customer ledger reflects the outstanding ₹800 balance
    const hrBillInvoice = {
      id: 'bill-hr-grp-01',
      invoiceNumber: 'INV-GRP-000105-3',
      bill_number: 'INV-GRP-000105-3',
      customerId: calcHr.customerId,
      customer_id: calcHr.customerId,
      customerName: 'Apex Human Resources',
      date: '2026-09-28',
      total: calcHr.total, // 1180
      amount_paid: calcHr.cashPaid, // 380
      paidTotal: calcHr.cashPaid,
      advanceUsed: 0,
      balance: calcHr.balanceDue, // 800
      status: 'partial',
    }

    const hrLedger = LedgerService.buildCustomerLedger({
      bills: [hrBillInvoice],
      payments: [],
    })

    // Ledger must show totalBilled of 1180, totalPaid of 380, and runningBalance = 800
    expect(hrLedger.totalBilled).toBe(1180.0)
    expect(hrLedger.totalPaid).toBe(380.0)
    expect(hrLedger.runningBalance).toBe(800.0)
    expect(hrLedger.entries.length).toBeGreaterThan(0)
  })
})
