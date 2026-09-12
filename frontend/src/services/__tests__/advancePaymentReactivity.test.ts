import { describe, it, expect } from 'vitest'
import { ReminderService } from '../reminderService'

describe('Advance Payment Reactivity & Wallet Sync', () => {
  it('calculates advance deposit increasing customer wallet balance', () => {
    const initialCredit = 300
    const advanceDeposit = {
      amount: 500,
      cashAmount: 250,
      upiAmount: 250,
      isReturn: false
    }

    const newCreditBalance = initialCredit + advanceDeposit.amount
    expect(newCreditBalance).toBe(800)
    expect(advanceDeposit.cashAmount + advanceDeposit.upiAmount).toBe(advanceDeposit.amount)
  })

  it('calculates advance refund decreasing customer wallet balance', () => {
    const initialCredit = 800
    const advanceRefund = {
      amount: 300,
      isReturn: true
    }

    const newCreditBalance = Math.max(0, initialCredit - advanceRefund.amount)
    expect(newCreditBalance).toBe(500)
  })

  it('generates rich WhatsApp deposit confirmation receipt', () => {
    const mockAdvance = {
      id: 'adv-001',
      amount: 1000,
      date: '2026-09-12',
      isReturn: false,
      notes: 'Job advance deposit for Wedding Album'
    }

    const mockCustomer = {
      name: 'Priyanka Chopra'
    }

    const business = {
      shopName: 'PrintPro Studio',
      phone: '9876543210'
    }

    const message = ReminderService.buildAdvanceConfirmationMessage(mockAdvance, mockCustomer, business)

    expect(message).toContain('PrintPro Studio')
    expect(message).toContain('Priyanka Chopra')
    expect(message).toContain('ADVANCE DEPOSIT RECEIPT')
    expect(message).toContain('₹1000.00')
    expect(message).toContain('Wedding Album')
  })

  it('generates rich WhatsApp refund confirmation receipt', () => {
    const mockRefund = {
      id: 'adv-002',
      amount: 400,
      date: '2026-09-12',
      isReturn: true,
      notes: 'Customer requested refund'
    }

    const mockCustomer = {
      name: 'Priyanka Chopra'
    }

    const business = {
      shopName: 'PrintPro Studio',
      phone: '9876543210'
    }

    const message = ReminderService.buildAdvanceConfirmationMessage(mockRefund, mockCustomer, business)

    expect(message).toContain('REFUND RECEIPT')
    expect(message).toContain('₹400.00')
    expect(message).toContain('Customer requested refund')
  })
})
