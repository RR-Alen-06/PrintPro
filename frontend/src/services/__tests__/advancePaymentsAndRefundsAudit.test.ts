import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPayment, mapPaymentFromApi, getDeletedPayments } from '../../api/payments'
import { LedgerService } from '../ledgerService'
import { supabase } from '../../lib/supabase'

describe('Advance Payments & Refunds Rewire Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('Part A: Advance Payments & Excess Credit Reconciliation', () => {
    it('computes advance inflow and returns from server advance payments data structure', () => {
      const serverAdvances: any[] = [
        { id: 'ADV-1', customerId: 'c1', amount: 500, cashAmount: 500, upiAmount: 0, date: '2026-09-01', isReturn: false },
        { id: 'ADV-2', customerId: 'c2', amount: 1000, cashAmount: 0, upiAmount: 1000, date: '2026-09-02', isReturn: false },
        { id: 'ADV-3', customerId: 'c1', amount: -200, cashAmount: -200, upiAmount: 0, date: '2026-09-05', isReturn: true },
        // Excess credit from payment notes or tags should be excluded from pure advance inflow
        { id: 'ADV-4', customerId: 'c3', amount: 300, isExcessCredit: true, notes: 'excess payment credit', date: '2026-09-06' }
      ]

      // Filter logic used across Dashboard and Accounting
      const validAdvances = serverAdvances.filter(
        ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit &&
              !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') &&
              Number(ap.amount || 0) > 0
      )
      const advInflow = validAdvances.reduce((sum, ap) => sum + Number(ap.amount || 0), 0)
      expect(advInflow).toBe(1500) // 500 + 1000

      const advReturns = serverAdvances.filter(ap => Number(ap.amount) < 0 || ap.isReturn)
      const advReturnsTotal = advReturns.reduce((sum, ap) => sum + Math.abs(Number(ap.amount || 0)), 0)
      expect(advReturnsTotal).toBe(200) // 200 returned
    })

    it('reconstructs customer ledger timeline with server advance deposit and advance return', () => {
      const serverAdvances = [
        { id: 'ADV-1', customerId: 'c1', amount: 1000, date: '2026-09-01', notes: 'Initial deposit' },
        { id: 'ADV-2', customerId: 'c1', amount: -300, date: '2026-09-10', isReturn: true, notes: 'Deposit refund' }
      ]

      const bills = [
        { id: 'b1', customerId: 'c1', date: '2026-09-05', total: 600, amountPaid: 600, advanceUsed: 600, status: 'paid' }
      ]

      const payments: any[] = []

      const result = LedgerService.calculateLedger({
        customerId: 'c1',
        bills,
        payments,
        advancePayments: serverAdvances,
        period: 'all',
        settings: {}
      })

      expect(result.entries.length).toBe(3)
      const advanceEntry = result.entries.find(e => e.type === 'advance')
      const returnEntry = result.entries.find(e => e.type === 'advance_return')
      const billEntry = result.entries.find(e => e.type === 'bill')

      expect(advanceEntry).toBeDefined()
      expect(advanceEntry?.credit).toBe(1000)

      expect(billEntry).toBeDefined()
      expect(billEntry?.debit).toBe(600)

      expect(returnEntry).toBeDefined()
      expect(returnEntry?.debit).toBe(300)

      // Initial credit +1000, bill debit -600, return debit -300 => final balance: -100 (store owes customer 100)
      const finalEntry = result.entries[result.entries.length - 1]
      expect(finalEntry.balance).toBe(-100)
    })
  })

  describe('Part B: Refunds Backend Persistence & Verification', () => {
    it('creates a negative payment payload shaped as a refund and persists to payments table', async () => {
      const mockInserted = {
        id: 'pay-refund-999',
        customer_id: 'c1',
        date: '2026-09-26',
        cash_amount: -250,
        upi_amount: 0,
        total_paid: -250,
        payment_type: 'refund',
        notes: 'Refund from customer credit balance'
      }

      const singleMock = vi.fn().mockResolvedValue({ data: mockInserted, error: null })
      const selectMock = vi.fn().mockReturnValue({ single: singleMock })
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock })

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c1' }, error: null })
              })
            })
          } as any
        }
        return {
          upsert: upsertMock
        } as any
      })

      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: 'usr-123' } }
      } as any)

      const result = await createPayment({
        customer_id: 'c1',
        date: '2026-09-26',
        cash_amount: -250,
        upi_amount: 0,
        total_paid: -250,
        payment_type: 'refund',
        notes: 'Refund from customer credit balance'
      })

      expect(upsertMock).toHaveBeenCalledWith([
        expect.objectContaining({
          customer_id: 'c1',
          cash_amount: -250,
          total_paid: -250,
          payment_type: 'refund',
          notes: 'Refund from customer credit balance',
          user_id: 'usr-123'
        })
      ])

      expect(result.data.data.id).toBe('pay-refund-999')
      expect(result.data.data.totalPaid).toBe(-250)
      expect(result.data.data.isRefund).toBe(true)
    })

    it('maps refund payments from database correctly with isRefund flag', () => {
      const rawApiRecord = {
        id: 101,
        customer_id: 'cust-1',
        cash_amount: -150,
        upi_amount: 0,
        total_paid: -150,
        payment_type: 'refund',
        notes: 'Ledger refund'
      }

      const mapped = mapPaymentFromApi(rawApiRecord)
      expect(mapped.totalPaid).toBe(-150)
      expect(mapped.paymentType).toBe('refund')
      expect(mapped.isRefund).toBe(true)
      expect(mapped.cashAmount).toBe(-150)
    })

    it('integrates refund payments into LedgerService as debit entries that reduce customer credit', () => {
      const bills = [
        { id: 'b1', customerId: 'c1', date: '2026-09-01', total: 1000, amountPaid: 1000, status: 'paid' }
      ]
      const payments = [
        { id: 'p1', customerId: 'c1', date: '2026-09-01', totalPaid: 1500, cashAmount: 1500, upiAmount: 0, notes: 'Overpaid bill' },
        // Customer takes ₹300 refund from the ₹500 excess credit
        { id: 'p-ref', customerId: 'c1', date: '2026-09-02', totalPaid: -300, cashAmount: -300, upiAmount: 0, paymentType: 'refund', isRefund: true, notes: 'Refund from credit' }
      ]

      const result = LedgerService.calculateLedger({
        customerId: 'c1',
        bills,
        payments,
        advancePayments: [],
        period: 'all',
        settings: {}
      })

      const refundEntry = result.entries.find(e => e.type === 'refund')
      expect(refundEntry).toBeDefined()
      expect(refundEntry?.debit).toBe(300) // Debit of 300 reduces store liability / increases balance towards 0
      expect(refundEntry?.credit).toBe(0)

      // Total billed 1000, paid 1500 => balance -500; refund debit +300 => final balance: -200
      const finalEntry = result.entries[result.entries.length - 1]
      expect(finalEntry.balance).toBe(-200)
    })

    it('verifies Refunds audit log aggregation logic catches bill refunds and advance returns', () => {
      const payments = [
        { id: 'p1', totalPaid: 500, cashAmount: 500, upiAmount: 0, isRefund: false },
        { id: 'p2', totalPaid: -200, cashAmount: -200, upiAmount: 0, paymentType: 'refund', isRefund: true },
        { id: 'p3', totalPaid: -100, cashAmount: 0, upiAmount: -100, paymentType: 'refund', isRefund: true }
      ]

      const advancePayments = [
        { id: 'adv1', amount: 1000, isReturn: false },
        { id: 'adv2', amount: -250, cashAmount: -250, upiAmount: 0, isReturn: true }
      ]

      const deletedPayments = [
        { id: 'del1', totalPaid: 150, cashAmount: 150, upiAmount: 0 }
      ]

      // Logic identical to Refunds.jsx refundStats calculation
      const billRefundsList = payments.filter(p => p.totalPaid < 0 || p.isRefund)
      const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
      const advReturnsList = advancePayments.filter(ap => ap.amount < 0 || ap.isReturn)
      const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Number(ap.amount || 0), 0)
      const delPaymentsTotal = deletedPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0)

      const grandTotal = Math.abs(billRefundsTotal) + Math.abs(delPaymentsTotal) + Math.abs(advReturnsTotal)

      expect(billRefundsList.length).toBe(2)
      expect(Math.abs(billRefundsTotal)).toBe(300) // 200 + 100
      expect(Math.abs(advReturnsTotal)).toBe(250) // 250
      expect(grandTotal).toBe(700) // 300 + 150 + 250
    })
  })
})
