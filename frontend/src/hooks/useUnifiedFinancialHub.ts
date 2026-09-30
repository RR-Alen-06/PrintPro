import { useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBills, useBillMutations } from './useBillsQuery'
import {
  usePayments,
  usePaymentMutations,
  useAdvancePayments,
  useAdvancePaymentMutations,
  useDeletedPayments,
} from './useEntitiesQuery'
import { useCustomers, useCustomerMutations } from './useCustomersQuery'
import { useExpenses, useExpenseMutations } from './useExpensesQuery'
import { useGroupBills } from './useGroupBillsQuery'
import { useGroupSettlements, useGroupSettlementMutations } from './useGroupSettlementsQuery'
import {
  ReconciliationService,
  CustomerReceivableSummary,
  AccountsReceivableResult,
} from '../services/reconciliationService'
import { SequenceService } from '../services/sequenceService'
import { useAppContext } from '../context/AppContext'

export interface CustomerFinancialDetails extends CustomerReceivableSummary {
  reconciledBills: any[]
  customerObject: any
}

export function useUnifiedFinancialHub() {
  const queryClient = useQueryClient()
  const { processRefund: appProcessRefund } = useAppContext()

  // 1. Unified Queries
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { data: serverPayments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: serverAdvancePayments = [], isLoading: isLoadingAdvances } = useAdvancePayments()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverExpenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { data: serverRefunds = [], isLoading: isLoadingRefunds } = useDeletedPayments()
  const { groupBills: serverGroupBills = [] } = useGroupBills()
  const { groupSettlements: serverGroupSettlements = [] } = useGroupSettlements()

  const bills = Array.isArray(serverBills) ? serverBills : []
  const payments = Array.isArray(serverPayments) ? serverPayments : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []
  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const expenses = Array.isArray(serverExpenses) ? serverExpenses : []
  const groupBills = Array.isArray(serverGroupBills) ? serverGroupBills : []
  const groupSettlements = Array.isArray(serverGroupSettlements) ? serverGroupSettlements : []

  const isLoading =
    isLoadingBills ||
    isLoadingPayments ||
    isLoadingAdvances ||
    isLoadingCustomers ||
    isLoadingExpenses ||
    isLoadingRefunds

  // 2. Authoritative Reconciled Bills (reconciles bill payments & FIFO allocations)
  const reconciledBills = useMemo(() => {
    try {
      return ReconciliationService.reconcileBillsWithPayments(bills, payments) || []
    } catch (e) {
      console.error('Error reconciling bills in useUnifiedFinancialHub:', e)
      return []
    }
  }, [bills, payments])

  // 3. Authoritative Accounts Receivable Data
  const accountsReceivable: AccountsReceivableResult = useMemo(() => {
    try {
      return ReconciliationService.calculateAccountsReceivables({
        bills,
        payments,
        customers,
      })
    } catch (e) {
      console.error('Error calculating accounts receivables in useUnifiedFinancialHub:', e)
      return {
        totalReceivables: 0,
        totalGrossDue: 0,
        totalAdvancePool: 0,
        debtorCount: 0,
        customersWithDue: [] as CustomerReceivableSummary[],
        allCustomerSummaries: [] as CustomerReceivableSummary[],
      }
    }
  }, [bills, payments, customers])

  // 4. Quick O(1) Customer Financial Map
  const customerFinancialsMap = useMemo(() => {
    const map = new Map<string, CustomerFinancialDetails>()
    const activeReconciledBills = (reconciledBills || []).filter(
      (b: any) => b && !b.deleted && !b.deleted_at && !b.isGroupParent && !b.is_group_parent
    );
    const summaries: CustomerReceivableSummary[] = accountsReceivable?.allCustomerSummaries || [];

    customers.forEach((c: any) => {
      if (!c || c.deleted) return
      const cId = String(c.id || '')
      if (!cId) return
      const code = c.customerCode ? String(c.customerCode).toLowerCase() : ''
      const custBills = activeReconciledBills.filter(
        (b: any) => b && String(b.customerId || b.customer_id || '') === cId
      )
      const summary = summaries.find(
        (s) => s && (s.customerId === cId || (code && s.customerCode?.toLowerCase() === code))
      ) || {
        customerId: cId,
        customerName: c.name || 'Customer',
        customerCode: c.customerCode || '',
        phone: c.phone || '',
        grossDue: 0,
        advanceBalance: Number(
          c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0
        ),
        netDue: 0,
        creditSurplus: Number(
          c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0
        ),
        openBillsCount: 0,
        oldestBillDate: undefined,
        hasOverdue: false,
      }

      const fullDetails: CustomerFinancialDetails = {
        ...summary,
        reconciledBills: custBills,
        customerObject: c,
      }

      map.set(cId, fullDetails)
      if (code) {
        map.set(code, fullDetails)
      }
    })

    return map
  }, [customers, reconciledBills, accountsReceivable])

  // 5. Customer Financial Details Getter
  const getCustomerFinancials = useCallback(
    (customerIdOrCode: string | number | null | undefined): CustomerFinancialDetails | null => {
      if (customerIdOrCode === null || customerIdOrCode === undefined) return null
      const key = String(customerIdOrCode).trim()
      if (!key) return null
      return customerFinancialsMap.get(key) || customerFinancialsMap.get(key.toLowerCase()) || null
    },
    [customerFinancialsMap]
  )

  // 6. Real-Time Advance Application Validator
  const validateAdvanceApplication = useCallback(
    (
      customerIdOrCode: string | number | null | undefined,
      requestedAmount: number
    ): { valid: boolean; maxAllowed: number; error?: string } => {
      const financials = getCustomerFinancials(customerIdOrCode)
      const available = Number(financials?.advanceBalance || 0)
      const req = Number(requestedAmount || 0)
      if (req <= 0) return { valid: true, maxAllowed: available }
      if (req > available) {
        return {
          valid: false,
          maxAllowed: available,
          error: `Requested advance (₹${req.toFixed(2)}) exceeds available balance (₹${available.toFixed(2)})`,
        }
      }
      return { valid: true, maxAllowed: available }
    },
    [getCustomerFinancials]
  )

  // 7. Store-Wide Unified Financial Metrics
  const storeFinancials = useMemo(() => {
    const totalAccountsReceivable = accountsReceivable.totalReceivables
    const totalGrossDue = accountsReceivable.totalGrossDue
    const totalAdvancePool = accountsReceivable.totalAdvancePool
    const debtorCount = accountsReceivable.debtorCount
    const debtorsList = accountsReceivable.customersWithDue

    const totalCollected = Number(
      reconciledBills.reduce((sum: number, b: any) => sum + Number(b.amountPaid || 0), 0).toFixed(2)
    )

    return {
      totalAccountsReceivable,
      totalGrossDue,
      totalAdvancePool,
      debtorCount,
      debtorsList,
      totalCollected,
      totalCustomers: customers.filter((c: any) => !c.deleted).length,
      totalBills: bills.filter((b: any) => !b.deleted && !b.deleted_at && !b.isGroupParent).length,
    }
  }, [accountsReceivable, reconciledBills, customers, bills])

  // 8. Strict Cash-Flow Daybook Calculator for any Date
  const calculateDaybookForDate = useCallback(
    (targetDate: string, openingCash = 1000) => {
      let cashIn = 0
      let upiIn = 0
      let cashOut = 0
      let upiOut = 0
      const txList: any[] = []

      // 1. Payments collected on this date (excluding non-cash advance allocations)
      payments.forEach((p: any) => {
        const pDate = (p.date || p.created_at || '').slice(0, 10)
        if (pDate === targetDate && !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0) {
          const notesLower = String(p.notes || '').toLowerCase()
          const isAdvanceApplied =
            notesLower.includes('advance balance applied') ||
            notesLower.includes('from advance deposit') ||
            notesLower.includes('fifo payment from advance deposit') ||
            p.paymentType === 'advance_deduction' ||
            p.payment_type === 'advance_deduction'
          if (isAdvanceApplied) return

          let cash = Number(p.cashAmount || p.cash_amount || 0)
          let upi = Number(p.upiAmount || p.upi_amount || 0)
          const totalPaid = Number(
            p.totalPaid !== undefined ? p.totalPaid : p.amount !== undefined ? p.amount : p.total_paid || 0
          )

          if (cash === 0 && upi === 0 && totalPaid > 0) {
            const method = String(p.payment_method || p.paymentMethod || p.paymentType || '').toLowerCase()
            if (method === 'upi') upi = totalPaid
            else cash = totalPaid
          }

          cashIn += cash
          upiIn += upi

          const paymentDisplay = p.paymentCode || SequenceService.formatDisplayCode('payment', p.id || p, 'PAY')
          txList.push({
            id: p.id,
            date: pDate,
            time: p.created_at
              ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
            ref: paymentDisplay,
            type: 'in',
            description: p.notes || (p.invoiceNumber ? `Payment for ${p.invoiceNumber}` : 'Invoice Payment Receipt'),
            method: cash > 0 && upi > 0 ? 'Split' : upi > 0 ? 'UPI' : 'Cash',
            cashAmount: cash,
            upiAmount: upi,
            total: cash + upi,
          })
        }
      })

      // 2. Advance Payments deposited on this date
      advancePayments.forEach((ap: any) => {
        const apDate = (ap.date || ap.created_at || '').slice(0, 10)
        if (apDate === targetDate && !ap.isReturn && Number(ap.amount || 0) > 0) {
          let cash = Number(ap.cashAmount || ap.cash_amount || 0)
          let upi = Number(ap.upiAmount || ap.upi_amount || 0)
          const amt = Number(ap.amount || 0)
          if (cash === 0 && upi === 0 && amt > 0) {
            const method = String(ap.paymentMethod || ap.payment_method || 'cash').toLowerCase()
            if (method === 'upi') upi = amt
            else cash = amt
          }

          cashIn += cash
          upiIn += upi

          const advDisplay = SequenceService.formatDisplayCode('advance', ap.id || ap, 'ADV')
          txList.push({
            id: ap.id,
            date: apDate,
            time: ap.created_at
              ? new Date(ap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
            ref: advDisplay,
            type: 'in',
            description: `Advance Deposit (${ap.customerName || 'Customer'})`,
            partyName: ap.customerName,
            method: cash > 0 && upi > 0 ? 'Split' : upi > 0 ? 'UPI' : 'Cash',
            cashAmount: cash,
            upiAmount: upi,
            total: cash + upi,
          })
        }
      })

      // 3. Expenses on this date
      expenses.forEach((e: any) => {
        const eDate = (e.date || '').slice(0, 10)
        if (eDate === targetDate) {
          const cash = Number(e.cashAmount !== undefined ? e.cashAmount : e.upiAmount ? 0 : e.amount || e.total || 0)
          const upi = Number(e.upiAmount || 0)
          cashOut += cash
          upiOut += upi

          const expDisplay = e.expenseCode || SequenceService.formatDisplayCode('expense', e.id || e, 'EXP')
          txList.push({
            id: e.id,
            date: eDate,
            time: e.created_at
              ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
            ref: expDisplay,
            type: 'out',
            description: e.itemName || e.description || e.category || 'Business Expense',
            method: upi > 0 ? 'UPI' : 'Cash',
            cashAmount: cash,
            upiAmount: upi,
            total: Number(e.total || e.amount || 0),
          })
        }
      })

      // 4. Refunds on this date
      const refundsList = payments.filter(
        (p: any) => p && (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)
      )
      refundsList.forEach((r: any) => {
        const rDate = (r.date || r.created_at || '').slice(0, 10)
        if (rDate === targetDate) {
          const amt = Math.abs(Number(r.amount || r.totalPaid || 0))
          const cash = Number(r.cashAmount || (r.paymentMethod === 'upi' ? 0 : amt))
          const upi = Number(r.upiAmount || (r.paymentMethod === 'upi' ? amt : 0))
          cashOut += cash
          upiOut += upi
        }
      })

      const closingCash = Number((openingCash + cashIn - cashOut).toFixed(2))

      return {
        cashIn: Number(cashIn.toFixed(2)),
        upiIn: Number(upiIn.toFixed(2)),
        cashOut: Number(cashOut.toFixed(2)),
        upiOut: Number(upiOut.toFixed(2)),
        totalInflow: Number((cashIn + upiIn).toFixed(2)),
        totalOutflow: Number((cashOut + upiOut).toFixed(2)),
        closingCash,
        transactions: txList,
      }
    },
    [payments, advancePayments, expenses]
  )

  // 9. Atomic Multi-Query Cache Invalidation
  const invalidateAllFinancialQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['bills'] }),
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['advance-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['group-bills'] }),
      queryClient.invalidateQueries({ queryKey: ['group-settlement-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['deleted-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['accounting'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
    ])
  }, [queryClient])

  // 10. Direct Mutations
  const { createBill, updateBill, deleteBill } = useBillMutations()
  const { createPayment, deletePayment } = usePaymentMutations()
  const { addAdvancePayment, deleteAdvancePayment } = useAdvancePaymentMutations()
  const { createExpense, deleteExpense } = useExpenseMutations()
  const { settleGroupBill: groupSettleMutation } = useGroupSettlementMutations()
  const { updateCustomer } = useCustomerMutations()

  // Consolidated Handlers with Guaranteed Atomic Cascade
  const createBillAndSync = useCallback(
    async (payload: any) => {
      const res = await createBill(payload)
      await invalidateAllFinancialQueries()
      return res
    },
    [createBill, invalidateAllFinancialQueries]
  )

  const recordPaymentAndSync = useCallback(
    async (payload: any) => {
      const res = await createPayment(payload)
      await invalidateAllFinancialQueries()
      return res
    },
    [createPayment, invalidateAllFinancialQueries]
  )

  const recordAdvanceDepositAndSync = useCallback(
    async (payload: any) => {
      const res = await addAdvancePayment(payload)
      await invalidateAllFinancialQueries()
      return res
    },
    [addAdvancePayment, invalidateAllFinancialQueries]
  )

  const settleGroupBillAndSync = useCallback(
    async (payload: any) => {
      const res = await groupSettleMutation(payload)
      await invalidateAllFinancialQueries()
      return res
    },
    [groupSettleMutation, invalidateAllFinancialQueries]
  )

  const processRefundAndSync = useCallback(
    async (payload: any) => {
      if (appProcessRefund) {
        await appProcessRefund(payload)
      }
      await invalidateAllFinancialQueries()
    },
    [appProcessRefund, invalidateAllFinancialQueries]
  )

  const updateBillAndSync = useCallback(
    async (payload: any) => {
      const res = await updateBill(payload)
      await invalidateAllFinancialQueries()
      return res
    },
    [updateBill, invalidateAllFinancialQueries]
  )

  const deleteBillAndSync = useCallback(
    async (id: any) => {
      const res = await deleteBill(id)
      await invalidateAllFinancialQueries()
      return res
    },
    [deleteBill, invalidateAllFinancialQueries]
  )

  return {
    // Live Datasets
    bills,
    reconciledBills,
    payments,
    advancePayments,
    customers,
    expenses,
    groupBills,
    groupSettlements,
    isLoading,

    // Balances & Single Connection
    accountsReceivable,
    storeFinancials,
    customerFinancialsMap,
    getCustomerFinancials,
    validateAdvanceApplication,
    calculateDaybookForDate,

    // Invalidation & Actions
    invalidateAllFinancialQueries,
    createBillAndSync,
    updateBillAndSync,
    deleteBillAndSync,
    recordPaymentAndSync,
    recordAdvanceDepositAndSync,
    settleGroupBillAndSync,
    processRefundAndSync,

    // Direct Mutators if needed
    updateBill,
    deleteBill,
    deletePayment,
    deleteAdvancePayment,
    createExpense,
    deleteExpense,
    updateCustomer,
  }
}

