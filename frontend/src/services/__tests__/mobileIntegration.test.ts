import { describe, it, expect } from 'vitest'
import { BillingService } from '../billingService'
import { LoyaltyService } from '../loyaltyService'
import { CreditService } from '../creditService'
import { LedgerService } from '../ledgerService'
import { GroupBillingService } from '../groupBillingService'
import { ReconciliationService } from '../reconciliationService'

describe('Mobile Suite Headless Integration (Phase 6)', () => {
  describe('MobileCreateBill Flow Integration', () => {
    it('executes unified bill calculation with multi-item rows, GST, loyalty redemption, and advance credit deduction', () => {
      const itemRows = [
        { itemName: 'Brochure Color', qty: 20, unitPrice: 15, gstRate: 18 },
        { itemName: 'B&W Flyer', qty: 50, unitPrice: 2, gstRate: 0 },
      ]

      // Subtotal = (20 * 15) + (50 * 2) = 300 + 100 = 400
      const subtotal = itemRows.reduce((s, r) => s + r.qty * r.unitPrice, 0)
      expect(subtotal).toBe(400)

      // Loyalty points redemption via Headless LoyaltyService
      const customerLoyaltyPoints = 300
      const settings = { loyaltyRedeemRatioPoints: 150, loyaltyRedeemRatioRupees: 5 }
      const redemption = LoyaltyService.calculateRedemptionDiscount(150, customerLoyaltyPoints, subtotal, settings)
      expect(redemption.discountAmount).toBe(5)
      expect(redemption.pointsRedeemed).toBe(150)

      // Bill calculation via BillingService
      const billResult = BillingService.calculateBill({
        items: itemRows,
        loyaltyDiscount: redemption.discountAmount,
        discountType: 'flat',
        discountValue: 15, // Flat discount ₹15
      })

      // Total discount = 15 (flat) + 5 (loyalty) = 20
      expect(billResult.totalDiscount).toBe(20)
      expect(billResult.taxableAmount).toBe(380)

      // Advance credit deduction via CreditService
      const availableAdvance = 200
      const drawdown = CreditService.calculateAdvanceDrawdown(availableAdvance, billResult.roundedTotal)
      expect(drawdown.advanceUsed).toBe(200)
      expect(drawdown.remainingAdvance).toBe(0)
      expect(drawdown.netBillAmount).toBeGreaterThan(0)
    })
  })

  describe('MobileCustomerLedger Integration', () => {
    it('reconstructs customer ledger accurately on mobile with bills, payments, and advance returns', () => {
      const bills = [
        { id: 'mb-1', date: '2026-08-01', total: 600, grand_total: 600, deleted: false },
        { id: 'mb-2', date: '2026-08-05', total: 400, grand_total: 400, deleted: false },
      ]

      const payments = [
        { id: 'mp-1', billId: 'mb-1', date: '2026-08-02', amount: 600 },
      ]

      const ledger = LedgerService.buildCustomerLedger({
        bills,
        payments,
        advanceReturns: [],
      })

      expect(ledger.entries.length).toBe(3)
      expect(ledger.totalBilled).toBe(1000)
      expect(ledger.totalPaid).toBe(600)
      expect(ledger.runningBalance).toBe(400)
    })
  })

  describe('MobileGroupBilling Integration', () => {
    it('calculates mobile group split shares with exact penny reconciliation', () => {
      const members = [
        { id: 'm1', customerId: 'cust-1' },
        { id: 'm2', customerId: 'cust-2' },
      ]

      const split = GroupBillingService.calculateSplitPurchase({
        totalAmount: 250,
        members,
        gstPercent: 18,
      })

      expect(split.memberCalculations.length).toBe(2)
      expect(split.aggregateSubtotal).toBe(250)
      expect(split.memberCalculations[0].subtotal).toBe(125)
      expect(split.memberCalculations[1].subtotal).toBe(125)
    })
  })

  describe('MobileDailyReconciliation Integration', () => {
    it('calculates mobile drawer status and denomination totals', () => {
      const denoms = { 500: 4, 100: 5, 50: 2 } // 2000 + 500 + 100 = 2600
      const total = ReconciliationService.calculateDenominationsTotal(denoms)
      expect(total).toBe(2600)

      const variance = ReconciliationService.calculateDrawerVariance({
        openingBalance: 500,
        cashSales: 2200,
        cashExpenses: 100,
        physicalCount: 2600,
      })

      // Expected = 500 + 2200 - 100 = 2600. Variance = 0 (balanced)
      expect(variance.expectedCash).toBe(2600)
      expect(variance.variance).toBe(0)
      expect(variance.status).toBe('balanced')
    })
  })
})
