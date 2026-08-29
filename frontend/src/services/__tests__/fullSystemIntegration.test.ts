import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GstService } from '../gstService'
import { LoyaltyService } from '../loyaltyService'
import { PromoService } from '../promoService'
import { CreditService } from '../creditService'
import { BillingService } from '../billingService'
import { GroupBillingService } from '../groupBillingService'
import { LedgerService } from '../ledgerService'
import { ReconciliationService } from '../reconciliationService'
import { SequenceService } from '../sequenceService'
import { SyncStateMachine } from '../../lib/syncStateMachine'
import { loadState, saveState, initialState } from '../../context/AppContext'

// Mock global localStorage for Node environment
const storageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
})

describe('Full System End-to-End Reliability Verification (Phase 7)', () => {
  const testTenant = '00000000-0000-4000-a000-000000000001'

  beforeEach(() => {
    localStorage.clear()
    SyncStateMachine.clear()
    vi.clearAllMocks()
  })

  it('executes a complete lifecycle: Sequence -> Tax -> Promo -> Loyalty -> POS Bill -> Advance Drawdown -> Ledger -> Reconciliation', () => {
    // 1. Generate formatted sequence numbers for entities
    const billCode = SequenceService.formatSequenceCode('BILL', 101, 6)
    const payCode = SequenceService.formatSequenceCode('PAY', 201, 6)
    const cusCode = SequenceService.formatSequenceCode('CUS', 1, 6)

    expect(billCode).toBe('BILL-000101')
    expect(payCode).toBe('PAY-000201')
    expect(cusCode).toBe('CUS-000001')

    // 2. Validate Promo Code
    const activePromos = [
      { code: 'PRINT10', type: 'percent' as const, value: 10, minAmount: 100, enabled: true },
    ]
    const promoValidation = PromoService.validateAndApplyPromo('PRINT10', 500, activePromos)
    expect(promoValidation.isValid).toBe(true)
    expect(promoValidation.discountAmount).toBe(50) // 10% of 500

    // 3. Calculate Loyalty points redemption
    const loyaltySettings = { loyaltyRedeemRatioPoints: 150, loyaltyRedeemRatioRupees: 5 }
    const customerPoints = 300
    const redemption = LoyaltyService.calculateRedemptionDiscount(150, customerPoints, 500, loyaltySettings)
    expect(redemption.discountAmount).toBe(5)

    // 4. Execute Full Single-Pass Bill Calculation via BillingService
    const items = [
      { itemName: 'Color Poster A3', qty: 10, unitPrice: 40, gstRate: 18 }, // 400
      { itemName: 'Lamination', qty: 10, unitPrice: 10, gstRate: 18 },      // 100
    ]
    const bill = BillingService.calculateBill({
      items,
      discountType: 'percent',
      discountValue: 10, // ₹50 promo
      loyaltyDiscount: redemption.discountAmount, // ₹5 loyalty
      roundingMethod: 'Standard',
    })

    // Subtotal: 500. Total Discount: 55 (50 promo + 5 loyalty). Taxable: 445.
    expect(bill.subtotal).toBe(500)
    expect(bill.totalDiscount).toBe(55)
    expect(bill.taxableAmount).toBe(445)
    expect(bill.gstAmount).toBeGreaterThan(0)
    expect(bill.roundedTotal).toBeGreaterThan(500)

    // 5. Calculate Deterministic Advance Drawdown & Cash/UPI Split via CreditService
    const availableAdvance = 200
    const drawdown = CreditService.calculateAdvanceDrawdown(availableAdvance, bill.roundedTotal)
    expect(drawdown.advanceUsed).toBe(200)
    expect(drawdown.remainingAdvance).toBe(0)

    const remainingDue = drawdown.netBillAmount
    const split = CreditService.calculatePaymentSplit(remainingDue / 2, remainingDue / 2, remainingDue)
    expect(split.isFullyPaid).toBe(true)
    expect(split.balanceDue).toBe(0)

    // 6. Chronological Ledger Reconstruction via LedgerService
    const billsList = [
      {
        id: 'b-101',
        bill_number: billCode,
        grand_total: bill.roundedTotal,
        paid_total: bill.roundedTotal,
        advance_used: 200,
        deleted: false,
      },
    ]
    const paymentsList = [
      { id: 'p-201', billId: 'b-101', payment_number: payCode, amount: remainingDue },
    ]
    const ledger = LedgerService.buildCustomerLedger({
      bills: billsList,
      payments: paymentsList,
    })

    expect(ledger.entries.length).toBe(2)
    expect(ledger.totalBilled).toBe(bill.roundedTotal)
    expect(ledger.totalPaid).toBe(bill.roundedTotal)
    expect(ledger.runningBalance).toBe(0)

    // 7. Cash Drawer Reconciliation via ReconciliationService
    const drawer = ReconciliationService.calculateDrawerVariance({
      openingBalance: 1000,
      cashSales: split.cashPaid,
      cashExpenses: 50,
      physicalCount: 1000 + split.cashPaid - 50,
    })
    expect(drawer.status).toBe('balanced')
    expect(drawer.variance).toBe(0)

    // 8. User-Scoped LocalStorage Isolation
    const userState = {
      ...initialState,
      business: {
        ...initialState.business,
        shopName: 'Apex Printing Studio',
      },
      expenses: [
        { id: 'exp-1', description: 'Thermal Paper Rolls', amount: 800 },
      ],
      settings: {
        ...initialState.settings,
        invoicePrefix: 'APEX-INV',
      },
    }
    saveState(userState, testTenant)
    const hydrated = loadState(testTenant)
    expect(hydrated.business.shopName).toBe('Apex Printing Studio')
    expect(hydrated.expenses.length).toBe(1)
    expect(hydrated.expenses[0].id).toBe('exp-1')
    expect(hydrated.settings.invoicePrefix).toBe('APEX-INV')

    // 9. Sync State Machine Transition
    const syncState = SyncStateMachine.markPending('BILL', 'b-101', { total: bill.roundedTotal })
    expect(syncState.status).toBe('pending')
    SyncStateMachine.markSyncing('BILL', 'b-101')
    SyncStateMachine.markSynced('BILL', 'b-101')
    expect(SyncStateMachine.getStatus('BILL', 'b-101')).toBe('synced')
  })
})
