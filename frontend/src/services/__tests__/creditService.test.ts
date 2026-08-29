import { describe, it, expect } from 'vitest'
import { CreditService } from '../creditService'

describe('CreditService', () => {
  describe('calculateAdvanceDrawdown', () => {
    it('prevents advance drawdown from exceeding the bill total when available advance is higher', () => {
      // Historical Bug: Customer has ₹500 advance, but bill is only ₹200.
      // Advance used must be ₹200, remaining advance ₹300, net bill due ₹0.
      const result = CreditService.calculateAdvanceDrawdown(500, 200)
      expect(result.advanceUsed).toBe(200)
      expect(result.remainingAdvance).toBe(300)
      expect(result.netBillAmount).toBe(0)
    })

    it('draws down full advance when bill total is higher than available advance', () => {
      // Customer has ₹150 advance, bill is ₹400.
      // Advance used must be ₹150, remaining advance ₹0, net bill due ₹250.
      const result = CreditService.calculateAdvanceDrawdown(150, 400)
      expect(result.advanceUsed).toBe(150)
      expect(result.remainingAdvance).toBe(0)
      expect(result.netBillAmount).toBe(250)
    })

    it('safely handles string-typed inputs without string-concatenation bugs', () => {
      const result = CreditService.calculateAdvanceDrawdown('100.50' as any, '250.00' as any)
      expect(result.advanceUsed).toBe(100.50)
      expect(result.remainingAdvance).toBe(0)
      expect(result.netBillAmount).toBe(149.50)
    })

    it('handles 0 or negative inputs gracefully', () => {
      const result = CreditService.calculateAdvanceDrawdown(-50, 200)
      expect(result.advanceUsed).toBe(0)
      expect(result.remainingAdvance).toBe(0)
      expect(result.netBillAmount).toBe(200)
    })
  })

  describe('calculatePaymentSplit', () => {
    it('prevents string-concatenation bugs in Cash + UPI splits (e.g. "50" + "50" = 100, not "5050")', () => {
      const result = CreditService.calculatePaymentSplit('50' as any, '50' as any, '100' as any)
      expect(result.cashPaid).toBe(50)
      expect(result.upiPaid).toBe(50)
      expect(result.totalPaid).toBe(100)
      expect(result.balanceDue).toBe(0)
      expect(result.isFullyPaid).toBe(true)
    })

    it('computes partial payment balance correctly', () => {
      const result = CreditService.calculatePaymentSplit(200, 100, 500)
      expect(result.totalPaid).toBe(300)
      expect(result.balanceDue).toBe(200)
      expect(result.isFullyPaid).toBe(false)
    })
  })

  describe('formatCustomerCode', () => {
    it('formats valid customer_code or code in uppercase', () => {
      expect(CreditService.formatCustomerCode({ customer_code: 'cus-0042' })).toBe('CUS-0042')
      expect(CreditService.formatCustomerCode({ code: 'vip-99' })).toBe('VIP-99')
    })

    it('handles NULL, undefined, or empty customer_code with fallback to clean UUID prefix', () => {
      expect(CreditService.formatCustomerCode({ id: 'a1b2c3d4-e5f6-7890', customer_code: null })).toBe('CUS-A1B2C3')
      expect(CreditService.formatCustomerCode({ id: '7002f818-b2d4-4de3', customer_code: undefined })).toBe('CUS-7002F8')
      expect(CreditService.formatCustomerCode({ customer_code: '', type: 'random' })).toBe('CUS-WALKIN')
    })
  })

  describe('checkCreditLimit', () => {
    it('allows invoice creation when total balance is within credit limit', () => {
      // Outstanding: 400, New Unpaid: 300, Limit: 1000 -> Total 700 <= 1000
      const result = CreditService.checkCreditLimit(400, 1000, 300)
      expect(result.isAllowed).toBe(true)
      expect(result.newBalance).toBe(700)
      expect(result.exceededBy).toBe(0)
    })

    it('blocks invoice creation and calculates exact excess when credit limit is breached', () => {
      // Outstanding: 800, New Unpaid: 400, Limit: 1000 -> Total 1200 > 1000 (exceeded by 200)
      const result = CreditService.checkCreditLimit(800, 1000, 400)
      expect(result.isAllowed).toBe(false)
      expect(result.newBalance).toBe(1200)
      expect(result.exceededBy).toBe(200)
    })

    it('permits any balance when credit limit is 0 or unset (unrestricted)', () => {
      const result = CreditService.checkCreditLimit(5000, 0, 2000)
      expect(result.isAllowed).toBe(true)
      expect(result.newBalance).toBe(7000)
      expect(result.exceededBy).toBe(0)
    })
  })
})
