import React, { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../context/AppContext'
import {
  TrendingUp, CreditCard, Clock, AlertTriangle, ChevronRight, Wallet, CheckCircle, XCircle,
  RefreshCw, FileText, UserPlus, PlusCircle, Receipt, DollarSign, Activity, X,
  Users, MessageSquare, ExternalLink, ArrowUpRight
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useBills, useBillMutations } from '../hooks/useBillsQuery'
import { useCustomers, useCustomerMutations } from '../hooks/useCustomersQuery'
import { usePayments, usePaymentMutations, useAdvancePayments } from '../hooks/useEntitiesQuery'
import { useExpenses } from '../hooks/useExpensesQuery'
import { ReconciliationService } from '../services/reconciliationService'
import EmptyState from '../components/common/EmptyState'
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton'
import { DashboardService } from '../services/dashboardService'
import { SequenceService } from '../services/sequenceService'
import { ReminderService } from '../services/reminderService'

const parseLocalDate = (dateInput) => {
  if (!dateInput) return null
  if (dateInput instanceof Date) return new Date(dateInput)
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number)
      return new Date(y, m - 1, d, 12, 0, 0, 0)
    }
  }
  const d = new Date(dateInput)
  return isNaN(d.getTime()) ? null : d
}

const formatCurrency = (val) => {
  const num = Number(val || 0)
  if (Math.abs(num) >= 100000) return `₹${(num / 100000).toFixed(1)}L`
  if (Math.abs(num) >= 1000) return `₹${(num / 1000).toFixed(1)}k`
  return `₹${Math.round(num)}`
}

const Dashboard = () => {
  const queryClient = useQueryClient()
  const { business, deletedPayments, showToast, updateBill } = useAppContext()
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: payments = [], isLoading: isLoadingPayments } = usePayments()
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { data: serverAdvancePayments = [], isLoading: isLoadingAdvances } = useAdvancePayments()
  const { createPayment: createPaymentMutation } = usePaymentMutations()
  const { updateBill: updateBillMutation } = useBillMutations()
  const { updateCustomer: updateCustomerMutation } = useCustomerMutations()

  const advancePayments = serverAdvancePayments
  const isDataLoading = (isLoadingBills && bills.length === 0) || (isLoadingCustomers && customers.length === 0) || (isLoadingAdvances && !serverAdvancePayments)
  const navigate = useNavigate()
  const today = new Date()

  const [isSyncing, setIsSyncing] = useState(false)
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null)

  // Quick Record Payment Modal States
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false)
  const [paymentCustomerId, setPaymentCustomerId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash') // 'cash' | 'upi' | 'split'
  const [paymentCash, setPaymentCash] = useState('')
  const [paymentUpi, setPaymentUpi] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  // Live calculation of selected customer's total due across unpaid bills
  const selectedCustomerDue = useMemo(() => {
    if (!paymentCustomerId) return 0
    const custBills = (bills || []).filter(
      (b) => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === String(paymentCustomerId)
    )
    return custBills.reduce((sum, b) => {
      const tot = Number(b.total || 0)
      const paid = Number(b.amountPaid || b.amount_paid || 0)
      return sum + Math.max(0, tot - paid)
    }, 0)
  }, [paymentCustomerId, bills])

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault()
    if (!paymentCustomerId) {
      showToast?.('Please select a customer', 'warning')
      return
    }

    let cash = 0
    let upi = 0
    if (paymentMode === 'cash') {
      cash = Number(paymentAmount)
    } else if (paymentMode === 'upi') {
      upi = Number(paymentAmount)
    } else {
      cash = Number(paymentCash || 0)
      upi = Number(paymentUpi || 0)
    }

    const total = cash + upi
    if (isNaN(total) || total <= 0) {
      showToast?.('Please enter a valid payment amount', 'warning')
      return
    }

    setIsSubmittingPayment(true)
    try {
      // Find customer's unpaid active bills sorted chronologically (FIFO)
      const custUnpaidBills = (bills || [])
        .filter(
          (b) =>
            !b.deleted &&
            !b.deleted_at &&
            !b.isGroupParent &&
            !b.is_group_parent &&
            String(b.customerId || b.customer_id) === String(paymentCustomerId) &&
            Number(b.balance || 0) > 0
        )
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

      let remaining = total
      for (const b of custUnpaidBills) {
        if (remaining <= 0) break
        const toPay = Math.min(remaining, Number(b.balance || 0))
        const newBal = Number(Math.max(0, Number(b.balance || 0) - toPay).toFixed(2))
        const currentPaid = Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || 0))
        const newPaid = Number((currentPaid + toPay).toFixed(2))
        const newStatus = newBal <= 0.001 ? 'paid' : 'partial'

        if (updateBillMutation) {
          await updateBillMutation({
            id: b.id,
            data: {
              balance: newBal,
              status: newStatus,
              amountPaid: newPaid,
              amount_paid: newPaid,
            }
          })
        }
        remaining = Number((remaining - toPay).toFixed(2))
      }

      // If customer overpaid (excess), credit customer advance / credit balance
      if (remaining > 0) {
        const custObj = (customers || []).find((c) => String(c.id) === String(paymentCustomerId))
        if (custObj && updateCustomerMutation) {
          const currentAdv = Number(custObj.advanceBalance || custObj.advance_balance || custObj.creditBalance || custObj.credit_balance || 0)
          const newAdv = Number((currentAdv + remaining).toFixed(2))
          await updateCustomerMutation({
            id: custObj.id,
            data: {
              advanceBalance: newAdv,
              advance_balance: newAdv,
              creditBalance: newAdv,
              credit_balance: newAdv,
            }
          })
        }
      }

      // Cloud mutation (optimistic updates and backend persistence)
      try {
        if (createPaymentMutation) {
          await createPaymentMutation({
            customer_id: paymentCustomerId,
            customerId: paymentCustomerId,
            cash_amount: cash,
            cashAmount: cash,
            upi_amount: upi,
            upiAmount: upi,
            total_paid: total,
            totalPaid: total,
            payment_type: custUnpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
            paymentType: custUnpaidBills.length > 0 && remaining === 0 ? 'full' : 'partial',
            notes: paymentNotes || 'Quick Payment via Dashboard',
            date: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.warn('Cloud payment sync queued:', err)
      }

      const custObj = (customers || []).find((c) => String(c.id) === String(paymentCustomerId))
      showToast?.(`Recorded payment of ₹${total.toLocaleString('en-IN')} for ${custObj?.name || 'Customer'}`, 'success')

      // Invalidate queries so dashboard cards update instantly
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })

      setShowRecordPaymentModal(false)
      setPaymentCustomerId('')
      setPaymentAmount('')
      setPaymentCash('')
      setPaymentUpi('')
      setPaymentNotes('')
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await queryClient.invalidateQueries()
      showToast('Data refreshed successfully', 'success')
    } catch (e) {
      showToast('Failed to refresh data', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExportFinancialCSV = () => {
    if (!trendData || trendData.length === 0) {
      showToast('No financial data available to export.', 'error')
      return
    }

    const headers = ['Period/Interval', 'Realized Revenue (INR)', 'Expenses (INR)', 'Net Profit (INR)']
    const rows = trendData.map(d => [
      `"${d.label}"`,
      d.revenue.toFixed(2),
      d.expenses.toFixed(2),
      (d.revenue - d.expenses).toFixed(2),
    ])

    const totalRev = trendData.reduce((s, d) => s + d.revenue, 0)
    const totalExp = trendData.reduce((s, d) => s + d.expenses, 0)
    const totalProf = totalRev - totalExp

    rows.push([])
    rows.push(['"TOTAL"', totalRev.toFixed(2), totalExp.toFixed(2), totalProf.toFixed(2)])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `PrintPro_Financial_Report_${filterType}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Financial CSV Report downloaded successfully!', 'success')
  }

  const [filterType, setFilterType] = useState('today') // default to today's live focus
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Default to current financial year based on current date
  const [selectedFY, setSelectedFY] = useState(
    new Date().getMonth() >= 3 
      ? String(new Date().getFullYear()) 
      : String(new Date().getFullYear() - 1)
  )

  const activeDateRange = useMemo(() => {
    let start = null
    let end = null
    const today = new Date()

    if (filterType === 'today') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
    } else if (filterType === 'week') {
      const day = today.getDay()
      const diff = today.getDate() - day
      start = new Date(today.getFullYear(), today.getMonth(), diff, 0, 0, 0, 0)
      end = new Date()
      end.setHours(23, 59, 59, 999)
    } else if (filterType === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (filterType === 'fy') {
      const fyYear = parseInt(selectedFY, 10)
      start = new Date(fyYear, 3, 1, 0, 0, 0, 0) // April 1st
      end = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999) // March 31st
    } else if (filterType === 'custom') {
      start = customStartDate ? new Date(customStartDate) : null
      if (start) start.setHours(0, 0, 0, 0)
      end = customEndDate ? new Date(customEndDate) : null
      if (end) end.setHours(23, 59, 59, 999)
    }

    return { start, end }
  }, [filterType, selectedFY, customStartDate, customEndDate])

  const filteredData = useMemo(() => {
    const { start, end } = activeDateRange
    
    const checkDate = (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      if (start && d < start) return false
      if (end && d > end) return false
      return true
    }

    return {
      bills: (bills || []).filter(b => b && checkDate(b.date)),
      payments: (payments || []).filter(p => p && checkDate(p.date)),
      advancePayments: (advancePayments || []).filter(ap => ap && checkDate(ap.date)),
      expenses: (expenses || []).filter(e => e && checkDate(e.date))
    }
  }, [bills, payments, advancePayments, expenses, activeDateRange])

  const fyStats = useMemo(() => {
    const fyYear = parseInt(selectedFY, 10)
    const startDate = new Date(fyYear, 3, 1, 0, 0, 0, 0) // April 1st
    const endDate = new Date(fyYear + 1, 2, 31, 23, 59, 59, 999) // March 31st

    const isDateInFY = (dateStr) => {
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d >= startDate && d <= endDate
    }

    // 1. Total Invoiced Revenue: sum of active bills' total in this FY
    const fyBills = (bills || []).filter(b => !b.deleted && isDateInFY(b.date) && !b.isGroupParent)
    const revenue = fyBills.reduce((sum, b) => sum + Number(b.total || 0), 0)

    // 2. Refunds: sum of payments and advance returns in this FY
    const fyRefundPayments = (payments || []).filter(p => (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid) < 0) && isDateInFY(p.date))
    const pRefunds = fyRefundPayments.reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0)
    const fyAdvReturns = (advancePayments || []).filter(ap => (Number(ap.amount) < 0 || ap.isReturn) && isDateInFY(ap.date))
    const advRefunds = fyAdvReturns.reduce((sum, ap) => sum + Math.abs(Number(ap.amount || 0)), 0)
    const refunds = pRefunds + advRefunds

    // 3. Cash Inflow: positive payments + advance deposits in this FY (using capped bill payment logic)
    const fyPayments = (payments || []).filter(p => !p.isRefund && p.paymentType !== 'refund'
      && !(p.notes && p.notes.includes('from advance deposit'))
      && !(p.notes && p.notes.includes('FIFO payment from advance deposit'))
      && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0)) > 0 && isDateInFY(p.date))
    const deletedBillIds = new Set((bills || []).filter(b => b.deleted).map(b => String(b.id)))
    const billMap = new Map((bills || []).map(b => [String(b.id), Number(b.total || 0)]))
    
    const billPaymentsMap = new Map()
    let unlinkedCashTotal = 0
    let unlinkedUpiTotal = 0

    fyPayments.forEach(p => {
      const bId = String(p.billId || '')
      const cash = Number(p.cashAmount || 0)
      const upi = Number(p.upiAmount || 0)
      const total = cash + upi
      if (!deletedBillIds.has(bId) && bId && billMap.has(bId)) {
        if (!billPaymentsMap.has(bId)) {
          billPaymentsMap.set(bId, { cash: 0, upi: 0, total: 0 })
        }
        const curr = billPaymentsMap.get(bId)
        curr.cash += cash
        curr.upi += upi
        curr.total += total
      } else if (!bId || !deletedBillIds.has(bId)) {
        unlinkedCashTotal += cash
        unlinkedUpiTotal += upi
      }
    })

    let pInflowCash = unlinkedCashTotal
    let pInflowUpi = unlinkedUpiTotal

    billPaymentsMap.forEach((pData, bId) => {
      const billTotal = Number(billMap.get(bId) || 0)
      if (pData.total > billTotal && billTotal > 0) {
        const ratio = billTotal / pData.total
        pInflowCash += Number((pData.cash * ratio).toFixed(2))
        pInflowUpi += Number((pData.upi * ratio).toFixed(2))
      } else {
        pInflowCash += pData.cash
        pInflowUpi += pData.upi
      }
    })

    const pInflow = pInflowCash + pInflowUpi

    const fyAdvances = (advancePayments || []).filter(ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') && Number(ap.amount || 0) > 0 && isDateInFY(ap.date))
    const advInflow = fyAdvances.reduce((sum, ap) => {
      const cash = Number(ap.cashAmount || 0)
      const upi = Number(ap.upiAmount || 0)
      return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
    }, 0)
    const cashInflow = pInflow + advInflow

    // 4. Expenses: sum of expenses in this FY
    const fyExpenses = (expenses || []).filter(e => isDateInFY(e.date))
    const fyExpTotal = fyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

    const netCashFlow = cashInflow - fyExpTotal - refunds

    return {
      revenue,
      refunds,
      cashInflow,
      expenses: fyExpTotal,
      netCashFlow
    }
  }, [bills, payments, advancePayments, expenses, selectedFY])

  const activeBills = useMemo(() => {
    return ReconciliationService.reconcileBillsWithPayments(filteredData.bills, filteredData.payments)
  }, [filteredData.bills, filteredData.payments])

  const paidBills = useMemo(() => activeBills.filter((b) => b.status === 'paid'), [activeBills])
  const partialBills = useMemo(() => activeBills.filter((b) => b.status === 'partial'), [activeBills])
  const unpaidBills = useMemo(() => activeBills.filter((b) => b.status === 'unpaid'), [activeBills])

  // Centralized calculations using DashboardService
  const dashboardStats = useMemo(() => {
    return DashboardService.getSummaryWidgets({ 
      bills: filteredData.bills, 
      payments: filteredData.payments, 
      advancePayments: filteredData.advancePayments, 
      deletedPayments, 
      expenses: filteredData.expenses, 
      customers, 
      inventory: [] 
    })
  }, [filteredData, deletedPayments, customers])

  const netRevenue = dashboardStats.netRevenue
  const pendingAmount = dashboardStats.pendingAmount
  const totalRefunds = dashboardStats.totalRefunds
  const totalCustomerAdvance = dashboardStats.totalCustomerAdvance

  const paymentReconciliation = useMemo(() => {
    return ReconciliationService.computePaymentReconciliation({
      bills: filteredData.bills,
      payments: filteredData.payments,
      customersAdvanceBalance: totalCustomerAdvance,
    })
  }, [filteredData, totalCustomerAdvance])

  const agingReport = useMemo(() => {
    return DashboardService.calculateAgingReport(bills, payments)
  }, [bills, payments])

  const refundPayments = useMemo(() => {
    return (filteredData.payments || []).filter((p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0)
  }, [filteredData.payments])

  const totalCashInflow = useMemo(() => {
    const deletedBillIds = new Set((filteredData.bills || []).filter(b => b.deleted).map(b => String(b.id)))
    const billMap = new Map((filteredData.bills || []).map(b => [String(b.id), Number(b.total !== undefined ? b.total : (b.grand_total || 0))]))
    
    const billPaymentsMap = new Map()
    let unlinkedCashTotal = 0
    let unlinkedUpiTotal = 0

    const validPayments = (filteredData.payments || []).filter((p) => 
      !p.isRefund && p.paymentType !== 'refund' 
      && !(p.notes && p.notes.includes('from advance deposit'))
      && !(p.notes && p.notes.includes('FIFO payment from advance deposit'))
      && !deletedBillIds.has(String(p.billId))
      && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0)) > 0
    )

    validPayments.forEach(p => {
      const bId = String(p.billId || '')
      const cash = Number(p.cashAmount || 0)
      const upi = Number(p.upiAmount || 0)
      const total = cash + upi
      if (bId && billMap.has(bId)) {
        if (!billPaymentsMap.has(bId)) {
          billPaymentsMap.set(bId, { cash: 0, upi: 0, total: 0 })
        }
        const curr = billPaymentsMap.get(bId)
        curr.cash += cash
        curr.upi += upi
        curr.total += total
      } else {
        unlinkedCashTotal += cash
        unlinkedUpiTotal += upi
      }
    })

    let pInflowCash = unlinkedCashTotal
    let pInflowUpi = unlinkedUpiTotal

    billPaymentsMap.forEach((pData, bId) => {
      const billTotal = Number(billMap.get(bId) || 0)
      if (pData.total > billTotal && billTotal > 0) {
        const ratio = billTotal / pData.total
        pInflowCash += Number((pData.cash * ratio).toFixed(2))
        pInflowUpi += Number((pData.upi * ratio).toFixed(2))
      } else {
        pInflowCash += pData.cash
        pInflowUpi += pData.upi
      }
    })

    const pInflow = pInflowCash + pInflowUpi

    // Count advance deposits EXCLUDING excess credits (already handled or capped in pInflow)
    const advInflow = (filteredData.advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => {
        const cash = Number(ap.cashAmount || 0)
        const upi = Number(ap.upiAmount || 0)
        return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
      }, 0)
    return pInflow + advInflow
  }, [filteredData])

  const totalExpenses = useMemo(() => {
    return (filteredData.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0)
  }, [filteredData.expenses])

  const netCashFlow = useMemo(() => {
    // Net Cash Flow = Total Cash Inflow - Total Expenses - Total Refunds
    return totalCashInflow - totalExpenses - totalRefunds
  }, [totalCashInflow, totalExpenses, totalRefunds])

  // All-time reconciled bills (never filtered by date range - store lifetime source of truth)
  const allTimeActiveBills = useMemo(() => {
    return ReconciliationService.reconcileBillsWithPayments(bills, payments)
  }, [bills, payments])

  // All-Time Summary & Metrics (Total Customers, All-Time Due, Customer Advance Pool, Net Due)
  const allTimeStats = useMemo(() => {
    return DashboardService.getSummaryWidgets({
      bills,
      payments,
      advancePayments: serverAdvancePayments,
      customers,
    })
  }, [bills, payments, serverAdvancePayments, customers])

  const allTimeTotalCustomers = customers.filter(c => !c.deleted).length
  const allTimeTotalDue = allTimeStats.grossPendingAmount !== undefined ? allTimeStats.grossPendingAmount : allTimeStats.pendingAmount
  const allTimeAdvancePool = allTimeStats.totalCustomerAdvance
  const allTimeNetDue = allTimeStats.pendingAmount


  const allTimeOverdueBills = useMemo(
    () => allTimeActiveBills.filter((b) => !b.deleted && !b.deleted_at && !b.isGroupParent && Number(b.balance || 0) > 0 && b.dueDate && new Date(b.dueDate) < today),
    [allTimeActiveBills, today]
  )

  const overdueBills = allTimeOverdueBills

  // Pending dues per customer — ALL-TIME CUMULATIVE with Advance deductions & CUS-XXXX code
  const pendingDues = useMemo(() => {
    const map: Record<string, any> = {}
    allTimeActiveBills
      .filter((b) => !b.deleted && !b.deleted_at && !b.isGroupParent && Number(b.balance || 0) > 0)
      .forEach((b) => {
        const custId = String(b.customerId || b.customer_id)
        if (!map[custId]) {
          const custObj = customers.find(c => String(c.id) === custId)
          const advBal = Number(custObj?.advanceBalance || custObj?.advance_balance || 0)
          map[custId] = {
            customerId: custId,
            customerName: b.customerName || custObj?.name || 'Walk-in Client',
            customerCode: custObj?.customerCode || SequenceService.formatDisplayCode(custId, 'CUS'),
            phone: custObj?.phone || '',
            advanceBalance: advBal,
            grossDue: 0,
            oldestDate: b.date,
            newestDate: b.date,
            billCount: 0,
            hasOverdue: false,
          }
        }
        const entry = map[custId]
        entry.grossDue += Number(b.balance || 0)
        entry.billCount += 1
        if (b.date < entry.oldestDate) entry.oldestDate = b.date
        if (b.date > entry.newestDate) entry.newestDate = b.date
        if (b.dueDate && new Date(b.dueDate) < today) entry.hasOverdue = true
      })
    return Object.values(map)
      .map(e => ({
        ...e,
        netDue: Math.max(0, e.grossDue - e.advanceBalance)
      }))
      .filter(e => e.netDue > 0.01)
      .sort((a, b) => b.netDue - a.netDue || b.grossDue - a.grossDue)
  }, [allTimeActiveBills, customers, today])

  const handleQuickPayForCustomer = (cust) => {
    setPaymentCustomerId(cust.customerId)
    setPaymentAmount(String(cust.netDue > 0 ? cust.netDue : cust.grossDue))
    setShowRecordPaymentModal(true)
  }

  const handleWhatsAppReminder = (e, cust) => {
    e.stopPropagation()
    const shop = business?.shopName || 'PrintPro Studio'
    const dueAmount = cust.netDue > 0 ? cust.netDue : cust.grossDue
    const message = `Hello ${cust.customerName},\n\nThis is a gentle payment reminder from *${shop}* regarding your pending balance of *₹${dueAmount.toFixed(2)}* across ${cust.billCount} invoice${cust.billCount > 1 ? 's' : ''} (Customer Code: *${cust.customerCode}*).\n\nKindly clear this at your earliest convenience. Thank you!`
    const url = ReminderService.getWhatsAppUrl(cust.phone, message)
    window.open(url, '_blank')
  }

  const handleNavigateToLedger = (cust) => {
    navigate(`/customers?customerId=${cust.customerCode || cust.customerId}&tab=ledger`)
  }

  const trendData = useMemo(() => {
    const today = new Date()
    let units = []
    
    const { start, end } = activeDateRange
    
    const startLimit = start || new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const endLimit = end || today

    const diffDays = Math.max(1, Math.ceil((endLimit - startLimit) / (1000 * 60 * 60 * 24)))

    if (filterType === 'today' || diffDays <= 1) {
      for (let i = 8; i <= 20; i += 2) {
        const s = new Date(startLimit)
        s.setHours(i, 0, 0, 0)
        const e = new Date(startLimit)
        e.setHours(i + 1, 59, 59, 999)
        units.push({ label: `${i}:00`, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else if (filterType === 'week' || diffDays <= 8) {
      for (let i = 0; i < diffDays; i++) {
        const s = new Date(startLimit)
        s.setDate(s.getDate() + i)
        s.setHours(0,0,0,0)
        const e = new Date(s)
        e.setHours(23,59,59,999)
        const dayLabel = s.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
        units.push({ label: dayLabel, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else if (filterType === 'month' || diffDays <= 32) {
      for (let i = 0; i < diffDays; i += 5) {
        const s = new Date(startLimit)
        s.setDate(s.getDate() + i)
        s.setHours(0,0,0,0)
        const e = new Date(s)
        e.setDate(e.getDate() + 4)
        e.setHours(23,59,59,999)
        units.push({ label: `${s.getDate()}-${Math.min(e.getDate(), 31)} ${s.toLocaleDateString('en-US', { month: 'short' })}`, start: s, end: e, revenue: 0, expenses: 0 })
      }
    } else {
      let temp = new Date(startLimit.getFullYear(), startLimit.getMonth(), 1)
      while (temp <= endLimit) {
        const s = new Date(temp)
        const e = new Date(temp.getFullYear(), temp.getMonth() + 1, 0, 23, 59, 59, 999)
        units.push({ label: temp.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), start: s, end: e, revenue: 0, expenses: 0 })
        temp.setMonth(temp.getMonth() + 1)
      }
    }

    units.forEach(u => {
      const uBills = (bills || []).filter(b => {
        if (b.deleted || b.isGroupParent) return false
        const d = parseLocalDate(b.date || b.createdAt)
        return d && d >= u.start && d <= u.end
      })
      u.revenue = uBills.reduce((sum, b) => sum + Number(b.total || 0), 0)

      const uExpenses = (expenses || []).filter(exp => {
        const d = parseLocalDate(exp.date || exp.createdAt)
        return d && d >= u.start && d <= u.end
      })
      u.expenses = uExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
      u.profit = u.revenue - u.expenses
    })

    return units
  }, [bills, expenses, activeDateRange, filterType])

  const urgencyStyle = (entry) => {
    if (entry.hasOverdue) return { color: 'var(--error)', bg: 'var(--error-bg)', border: 'rgba(239,68,68,0.2)' }
    return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0 }}>Dashboard</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              textTransform: 'uppercase'
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981'
              }} />
              LIVE SYNC
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0' }}>Overview of billing activity, pending dues, and customer status.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--border-light)', padding: '4px 8px', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
            <select
              className="form-select"
              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '150px', background: 'transparent', border: 'none' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="fy">Financial Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {filterType === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '2px 6px', fontSize: '0.8rem', width: '120px' }}
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ padding: '2px 6px', fontSize: '0.8rem', width: '120px' }}
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
          <button className="btn btn-secondary" onClick={handleSync} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      {/* 1-Click Quick Actions Command Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <button
          className="btn"
          onClick={() => navigate('/billing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
            <PlusCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>+ New Bill (POS)</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Create sales invoice</div>
          </div>
        </button>

        <button
          className="btn"
          onClick={() => navigate('/customers')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
            <UserPlus size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>+ Add Client</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Register customer</div>
          </div>
        </button>

        <button
          className="btn"
          onClick={() => setShowRecordPaymentModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
            <Receipt size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>+ Record Payment</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Credit & cash receipt</div>
          </div>
        </button>

        <button
          className="btn"
          onClick={() => navigate('/accounting')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '12px',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>+ Record Expense</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Log store outflow</div>
          </div>
        </button>
      </div>

      {/* ── PERMANENT UNFILTERED BUSINESS DIRECTORY & OUTSTANDING LIABILITIES ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
            <span style={{ width: '4px', height: '14px', background: 'var(--accent-secondary)', borderRadius: '2px', display: 'inline-block' }} />
            Cumulative Store Ledger & Receivables (All-Time • Unfiltered)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Permanent Business Standing
          </span>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px' }}>
          {/* Card 1: Total Customers */}
          <div className="stat-card" style={{ borderColor: 'rgba(0, 240, 255, 0.25)', background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon indigo" style={{ background: 'rgba(0, 240, 255, 0.15)', color: 'var(--accent-secondary)' }}>
                <Users size={22} />
              </div>
              <div>
                <div className="stat-card-label" style={{ color: 'var(--text-muted)' }}>TOTAL CUSTOMERS</div>
                <div className="stat-card-value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{allTimeTotalCustomers}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Regular: {customers.filter(c => c.type === 'regular' && !c.deleted).length}</span>
              <span>Walk-in: {customers.filter(c => c.type === 'random' && !c.deleted).length}</span>
            </div>
          </div>

          {/* Card 2: Total Amount Due (Receivables) */}
          <div className="stat-card" style={{ borderColor: 'rgba(255, 56, 96, 0.3)', background: 'linear-gradient(135deg, rgba(255, 56, 96, 0.06) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon error" style={{ background: 'rgba(255, 56, 96, 0.15)', color: 'var(--error)' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <div className="stat-card-label" style={{ color: 'var(--text-muted)' }}>TOTAL AMOUNT DUE</div>
                <div className="stat-card-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--error)' }}>₹{(allTimeStats.grossPendingAmount !== undefined ? allTimeStats.grossPendingAmount : allTimeTotalDue).toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ color: 'var(--error)' }}>
              {pendingDues.length} debtor account{pendingDues.length === 1 ? '' : 's'} across {allTimeActiveBills.filter(b => Number(b.balance || 0) > 0).length} open invoices
            </div>
          </div>

          {/* Card 3: Customer Advance Pool */}
          <div className="stat-card" style={{ borderColor: 'rgba(16, 185, 129, 0.25)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
                <Wallet size={22} />
              </div>
              <div>
                <div className="stat-card-label" style={{ color: 'var(--text-muted)' }}>CUSTOMER ADVANCE POOL</div>
                <div className="stat-card-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>₹{allTimeAdvancePool.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ color: 'var(--success)' }}>
              Deposits held to offset future print jobs
            </div>
          </div>

          {/* Card 4: Net Realizable Due */}
          <div className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.25)', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
            <div className="stat-card-header">
              <div className="stat-card-icon warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)' }}>
                <Clock size={22} />
              </div>
              <div>
                <div className="stat-card-label" style={{ color: 'var(--text-muted)' }}>NET REALIZABLE DUE</div>
                <div className="stat-card-value" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)' }}>₹{allTimeNetDue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub" style={{ color: 'var(--text-secondary)' }}>
              Gross dues adjusted after advance offsets
            </div>
          </div>
        </div>
      </div>

      {/* Financial Health Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Financial Performance ({filterType === 'all' ? 'All Time' : filterType.toUpperCase()})
        </h3>
        {isDataLoading ? (
          <CardSkeleton count={4} />
        ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon indigo"><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Revenue</div>
                <div className="stat-card-value">₹{netRevenue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">₹{dashboardStats.totalCollected?.toFixed(2) || '0.00'} collected ({activeBills.length} invoices generated)</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
              <div>
                <div className="stat-card-label">Total Cash Inflow</div>
                <div className="stat-card-value">₹{totalCashInflow.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Net cash & UPI inflow collected in period</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}><XCircle /></div>
              <div>
                <div className="stat-card-label">Total Refunds</div>
                <div className="stat-card-value">₹{totalRefunds.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">Total refund adjustments in period</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className={`stat-card-icon ${netCashFlow >= 0 ? 'success' : 'error'}`} style={{ background: netCashFlow >= 0 ? 'var(--success-bg)' : 'var(--error-bg)', color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {netCashFlow >= 0 ? <TrendingUp /> : <XCircle />}
              </div>
              <div>
                <div className="stat-card-label">Net Cash Flow</div>
                <div className="stat-card-value" style={{ color: netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  ₹{netCashFlow.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="stat-card-sub">Period inflow minus operational expenses</div>
          </div>
        </div>
        )}
      </div>

      {/* Operations & Receivables Section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--gradient-accent)', borderRadius: '2px', display: 'inline-block' }} />
          Operations & Debtor Analytics (All-Time)
        </h3>
        {isDataLoading ? (
          <CardSkeleton count={3} />
        ) : (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon warning"><CreditCard /></div>
              <div>
                <div className="stat-card-label">Total Dues Pending</div>
                <div className="stat-card-value">₹{allTimeTotalDue.toFixed(2)}</div>
              </div>
            </div>
            <div className="stat-card-sub">{allTimeActiveBills.filter(b => Number(b.balance || 0) > 0).length} open bills pending</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon error"><Clock /></div>
              <div>
                <div className="stat-card-label">Overdue Invoices</div>
                <div className="stat-card-value" style={{ color: allTimeOverdueBills.length > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{allTimeOverdueBills.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Past due date with open balance</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon success" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><AlertTriangle /></div>
              <div>
                <div className="stat-card-label">Active Debtors</div>
                <div className="stat-card-value">{pendingDues.length}</div>
              </div>
            </div>
            <div className="stat-card-sub">Customers with unpaid balances</div>
          </div>
        </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Pending Dues Widget */}
        <div className="card" style={{ height: '100%', marginBottom: 0 }}>
        <div className="bill-view-header">
          <div>
            <h2>Pending Dues & Customer Balances</h2>
            <p className="text-muted">All-time debtor accounts — sorted by net amount owed (advance offsets applied)</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/customers')}>
            View All <ChevronRight size={14} />
          </button>
        </div>

        {isDataLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : pendingDues.length === 0 ? (
          <EmptyState
            Icon={CheckCircle}
            title="All customer accounts settled"
            description="No outstanding balances at this time. All customer accounts are fully paid."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Customer</th>
                  <th>Open Bills</th>
                  <th>Gross Due</th>
                  <th>Advance Credit</th>
                  <th>Net Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDues.map((entry, idx) => {
                  const s = urgencyStyle(entry)
                  return (
                    <tr
                      key={entry.customerId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleNavigateToLedger(entry)}
                    >
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>
                        #{idx + 1}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{entry.customerName}</div>
                        <div style={{ display: 'inline-block', fontSize: '0.72rem', color: 'var(--accent-secondary)', fontFamily: 'monospace', fontWeight: 600, background: 'rgba(0, 240, 255, 0.08)', padding: '1px 6px', borderRadius: '4px', marginTop: '2px' }}>
                          {entry.customerCode}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{entry.billCount} bill{entry.billCount > 1 ? 's' : ''}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {entry.oldestDate === entry.newestDate ? entry.oldestDate : `${entry.oldestDate} → ${entry.newestDate}`}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        ₹{entry.grossDue.toFixed(2)}
                      </td>
                      <td>
                        {entry.advanceBalance > 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                            -₹{entry.advanceBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>₹0.00</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, color: s.color, fontSize: '0.92rem' }}>
                          ₹{entry.netDue.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 10px', borderRadius: 'var(--radius-full)',
                          background: s.bg, border: `1px solid ${s.border}`,
                          color: s.color, fontSize: '0.72rem', fontWeight: 700,
                        }}>
                          {entry.hasOverdue ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} /> Overdue
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleQuickPayForCustomer(entry)}
                            title="Record Payment"
                            style={{ padding: '4px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Receipt size={13} /> Pay
                          </button>
                          {entry.phone && (
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={(e) => handleWhatsAppReminder(e, entry)}
                              title="Send WhatsApp Reminder"
                              style={{ padding: '4px 8px', fontSize: '0.74rem', color: '#25D366' }}
                            >
                              <MessageSquare size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleNavigateToLedger(entry)}
                            title="View Customer Ledger"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>

        {/* A/R Aging Summary */}
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
          <div className="bill-view-header">
            <div>
              <h2>Receivables Aging Summary</h2>
              <p className="text-muted">Outstanding invoices grouped by overdue timeframe</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', flex: 1, justifyContent: 'center' }}>
            {/* 0-30 Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Current (0-30 Days)</span>
                <span>₹{agingReport.current.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--success)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.current / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* 31-60 Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Medium (31-60 Days)</span>
                <span>₹{agingReport.medium.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--warning)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.medium / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* 61+ Days */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                <span>Aged (61+ Days)</span>
                <span style={{ color: 'var(--error)' }}>₹{agingReport.aged.toFixed(2)}</span>
              </div>
              <div style={{ background: 'var(--border-light)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  background: 'var(--error)',
                  height: '100%',
                  width: `${agingReport.total > 0 ? (agingReport.aged / agingReport.total) * 100 : 0}%`
                }} />
              </div>
            </div>

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              borderTop: '1px solid var(--border)',
              paddingTop: '12px',
              marginTop: '8px',
              fontSize: '1rem'
            }}>
              <span>Total Outstanding:</span>
              <span style={{ color: 'var(--accent)' }}>₹{agingReport.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue vs Expenses Trend Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="bill-view-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Revenue vs. Expenses Trend</h2>
            <p className="text-muted">Visual comparison of revenue (gross billing) vs. recorded expenses</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '3px' }} />
              Revenue: <strong>₹{trendData.reduce((s, d) => s + d.revenue, 0).toFixed(2)}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', background: 'var(--error)', borderRadius: '3px' }} />
              Expenses: <strong>₹{trendData.reduce((s, d) => s + d.expenses, 0).toFixed(2)}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 600 }}>
              Net Profit: ₹{(trendData.reduce((s, d) => s + d.revenue, 0) - trendData.reduce((s, d) => s + d.expenses, 0)).toFixed(2)}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem' }}
              onClick={handleExportFinancialCSV}
            >
              Export Financial CSV
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', width: '100%', minHeight: '220px', overflowX: 'auto', overflowY: 'hidden' }}>
          {(() => {
            const maxVal = Math.max(...trendData.map(t => Math.max(t.revenue, t.expenses)), 100)
            const steps = [0, 0.25, 0.5, 0.75, 1]

            return (
              <svg style={{ width: '100%', minWidth: `${Math.max(600, trendData.length * 60)}px`, height: '220px' }}>
                {/* Grid lines */}
                {steps.map((pct, idx) => {
                  const val = maxVal * pct
                  const y = 170 - pct * 140
                  return (
                    <g key={idx}>
                      <line x1="55" y1={y} x2="98%" y2={y} stroke="var(--border)" strokeDasharray="4" opacity={0.6} />
                      <text x="5" y={y + 4} fill="var(--text-muted)" fontSize="10" fontWeight="600">
                        {formatCurrency(val)}
                      </text>
                    </g>
                  )
                })}

                {/* Bars */}
                {trendData.map((d, idx) => {
                  const totalBars = trendData.length || 1
                  const chartWidth = Math.max(500, totalBars * 60)
                  const slotWidth = chartWidth / totalBars
                  const xStart = 65 + idx * slotWidth

                  const barWidth = Math.min(18, Math.max(8, slotWidth * 0.25))
                  const gap = 3

                  const revH = Math.max(0, (d.revenue / maxVal) * 140)
                  const revY = 170 - revH

                  const expH = Math.max(0, (d.expenses / maxVal) * 140)
                  const expY = 170 - expH

                  const isHovered = hoveredTrendIndex === idx

                  return (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoveredTrendIndex(idx)}
                      onMouseLeave={() => setHoveredTrendIndex(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Highlight Background on Hover */}
                      {isHovered && (
                        <rect
                          x={xStart - 4}
                          y={20}
                          width={barWidth * 2 + gap + 8}
                          height={160}
                          fill="rgba(99, 102, 241, 0.08)"
                          rx="6"
                        />
                      )}

                      {/* Revenue Bar */}
                      <rect
                        x={xStart}
                        y={revY}
                        width={barWidth}
                        height={revH}
                        fill="var(--success)"
                        rx="3"
                        style={{ transition: 'all 0.3s' }}
                      />

                      {/* Expenses Bar */}
                      <rect
                        x={xStart + barWidth + gap}
                        y={expY}
                        width={barWidth}
                        height={expH}
                        fill="var(--error)"
                        rx="3"
                        style={{ transition: 'all 0.3s' }}
                      />

                      {/* X Axis Label */}
                      <text
                        x={xStart + barWidth}
                        y="192"
                        fill={isHovered ? 'var(--accent)' : 'var(--text-secondary)'}
                        fontSize="10"
                        textAnchor="middle"
                        fontWeight={isHovered ? '700' : '600'}
                      >
                        {d.label}
                      </text>

                      {/* Hover Tooltip Box */}
                      {isHovered && (
                        <g>
                          <rect
                            x={Math.min(xStart - 20, chartWidth - 120)}
                            y={Math.max(10, Math.min(revY, expY) - 50)}
                            width="130"
                            height="42"
                            fill="var(--bg-elevated, #1e293b)"
                            stroke="var(--accent)"
                            strokeWidth="1"
                            rx="6"
                          />
                          <text
                            x={Math.min(xStart - 20, chartWidth - 120) + 10}
                            y={Math.max(10, Math.min(revY, expY) - 50) + 16}
                            fill="var(--success)"
                            fontSize="10"
                            fontWeight="700"
                          >
                            Rev: ₹{d.revenue.toFixed(2)}
                          </text>
                          <text
                            x={Math.min(xStart - 20, chartWidth - 120) + 10}
                            y={Math.max(10, Math.min(revY, expY) - 50) + 32}
                            fill="var(--error)"
                            fontSize="10"
                            fontWeight="700"
                          >
                            Exp: ₹{d.expenses.toFixed(2)}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}

                {/* Base line */}
                <line x1="55" y1="170" x2="98%" y2="170" stroke="var(--border)" strokeWidth="2" />
              </svg>
            )
          })()}
        </div>
      </div>

      {/* Financial Year Analytics Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Financial Year Analytics</h2>
            <p className="text-muted">Filter historical data by Indian Financial Year (April 1st to March 31st)</p>
          </div>
          <select
            className="form-select"
            style={{ width: '280px', padding: '8px 12px', fontSize: '0.9rem' }}
            value={selectedFY}
            onChange={(e) => setSelectedFY(e.target.value)}
          >
            <option value="2026">FY 2026-27 (Apr 2026 - Mar 2027)</option>
            <option value="2025">FY 2025-26 (Apr 2025 - Mar 2026)</option>
            <option value="2024">FY 2024-25 (Apr 2024 - Mar 2025)</option>
          </select>
        </div>

        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', border: 'none', padding: 0 }}>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Realized Revenue</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>₹{fyStats.revenue.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Refunds</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--warning)' }}>₹{fyStats.refunds.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Cash Inflow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--info)' }}>₹{fyStats.cashInflow.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Expenses</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>₹{fyStats.expenses.toFixed(2)}</div>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Net Cash Flow</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: fyStats.netCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }}>₹{fyStats.netCashFlow.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Recent Bills */}
      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Recent Bills</h2>
            <p className="text-muted">Latest transactions</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/billing')}>
            All Bills <ChevronRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBills.slice(0, 6).map((bill, index) => {
                const invCode = SequenceService.formatDisplayCode(bill.invoiceNumber || bill.id, 'INV')
                const custCode = SequenceService.formatDisplayCode(bill.customerId || bill.customer_id, 'CUS')
                return (
                  <tr key={`${bill.id}-${index}`}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>#{index + 1}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                        {invCode}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bill.customerName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{custCode}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{bill.date}</td>
                    <td style={{ fontWeight: 600 }}>₹{bill.total.toFixed(2)}</td>
                    <td style={{ color: 'var(--success)' }}>₹{bill.amountPaid.toFixed(2)}</td>
                    <td style={{ color: bill.balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                      ₹{bill.balance.toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                        {bill.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {activeBills.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '0' }}>
                    <EmptyState
                      Icon={CreditCard}
                      title="No bills generated yet"
                      description="Generate your first print bill invoice to see detailed activity here."
                      actionText="Create First Bill"
                      onAction={() => navigate('/billing')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer summary */}
      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>Customer Summary</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Customers</span>
              <strong>{customers.filter((c) => !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Regular</span>
              <strong>{customers.filter((c) => c.type === 'regular' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Walk-in</span>
              <strong>{customers.filter((c) => c.type === 'random' && !c.deleted).length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Archived</span>
              <strong>{customers.filter((c) => c.deleted).length}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Bill Status Breakdown</h3>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> Paid</span>
              <strong>{paidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Partial</span>
              <strong>{partialBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><XCircle size={14} /> Unpaid</span>
              <strong>{unpaidBills.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> Overdue</span>
              <strong>{overdueBills.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Appended Feature: Recent Activity Feed */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} /> Recent Transactions
        </h3>
        <div className="table-container">
          {isDataLoading ? (
            <TableSkeleton rows={4} columns={4} />
          ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Date</th>
                <th>Ref Code</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...bills.map(b => ({
                  ...b,
                  sortDate: parseLocalDate(b.createdAt || b.date) || new Date(0),
                  actType: 'Bill',
                  refCode: SequenceService.formatDisplayCode(b.invoiceNumber || b.id, 'INV')
                })),
                ...payments.map(p => ({
                  ...p,
                  sortDate: parseLocalDate(p.createdAt || p.date) || new Date(0),
                  actType: 'Payment',
                  refCode: SequenceService.formatDisplayCode(p.paymentCode || p.id, 'PAY')
                }))
              ]
                .sort((a, b) => b.sortDate - a.sortDate)
                .slice(0, 6)
                .map((act, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.8rem' }}>#{i + 1}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{act.date}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                        {act.refCode}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${act.actType === 'Bill' ? 'badge-primary' : 'badge-success'}`}>
                        {act.actType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{act.customerName || 'Direct Client'}</td>
                    <td style={{ fontWeight: 700, color: act.actType === 'Bill' ? 'var(--text-main)' : 'var(--success)' }}>
                      {act.actType === 'Payment' ? '+' : ''}₹{Number(act.total || act.totalPaid || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              {bills.length === 0 && payments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No recent activity.</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Sales Forecast Chart */}
      {(() => {
        // Build last 6 months revenue data
        const monthLabels = []
        const monthRevenues = []
        const now = new Date()
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0, 0)
          const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
          const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
          const revenue = (bills || [])
            .filter(b => !b.deleted && !b.isGroupParent)
            .filter(b => {
              const bd = parseLocalDate(b.date || b.createdAt)
              return bd && bd >= d && bd <= monthEnd
            })
            .reduce((s, b) => s + Number(b.total || 0), 0)
          monthLabels.push(label)
          monthRevenues.push(revenue)
        }
        
        // Hybrid Forecasting: Linear Regression + Exponential Weighted Moving Average (EWMA)
        const n = monthRevenues.length
        const xMean = (n - 1) / 2
        const yMean = monthRevenues.reduce((a, b) => a + b, 0) / n
        let num = 0, den = 0
        monthRevenues.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2 })
        const slope = den !== 0 ? num / den : 0
        const intercept = yMean - slope * xMean

        // EWMA baseline (gives more weight to recent months)
        let ewma = monthRevenues[0] || 0
        monthRevenues.forEach(rev => { ewma = 0.5 * rev + 0.5 * ewma })

        const forecastLabels = []
        const forecastRevenues = []
        for (let i = 1; i <= 3; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
          forecastLabels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }))
          
          const regVal = slope * (n - 1 + i) + intercept
          // Blend linear regression with EWMA baseline
          const predicted = Math.max(0, Math.round(0.6 * regVal + 0.4 * ewma))
          forecastRevenues.push(predicted)
        }
        
        const allValues = [...monthRevenues, ...forecastRevenues]
        const maxVal = Math.max(...allValues, 100)
        const totalHistSales = monthRevenues.reduce((a, b) => a + b, 0)

        return (
          <div className="card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={20} style={{ color: 'var(--accent)' }} /> Sales Forecast (Next 3 Months)
              </h3>
              {totalHistSales > 0 && forecastRevenues[0] > 0 && (
                <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>
                  Projected Q3 Growth: +{(((forecastRevenues.reduce((a,b)=>a+b,0)/3) / (yMean || 1) - 1) * 100).toFixed(1)}%
                </span>
              )}
            </div>

            {totalHistSales === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>No Historical Sales Recorded Yet</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Generate bills in the POS billing section to see predictive 3-month AI sales forecasts.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '180px', padding: '0 8px' }}>
                  {monthLabels.map((label, i) => (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {formatCurrency(monthRevenues[i])}
                      </span>
                      <div style={{
                        width: '100%',
                        maxWidth: '40px',
                        height: `${Math.max((monthRevenues[i] / maxVal) * 140, 4)}px`,
                        background: 'linear-gradient(180deg, var(--accent), var(--accent-light, #6366f1))',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.5s ease'
                      }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                  {/* Separator */}
                  <div style={{ width: '2px', background: 'var(--border)', height: '140px', margin: '0 4px', alignSelf: 'flex-end' }} />
                  {forecastLabels.map((label, i) => (
                    <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--success)' }}>
                        {formatCurrency(forecastRevenues[i])}
                      </span>
                      <div style={{
                        width: '100%',
                        maxWidth: '40px',
                        height: `${Math.max((forecastRevenues[i] / maxVal) * 140, 4)}px`,
                        background: 'linear-gradient(180deg, var(--success), rgba(16,185,129,0.5))',
                        borderRadius: '4px 4px 0 0',
                        border: '2px dashed var(--success)',
                        transition: 'height 0.5s ease'
                      }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '12px', height: '12px', background: 'var(--accent)', borderRadius: '2px' }} /> Historical
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '2px', border: '1px dashed var(--success)' }} /> Projected (Next 3 Months)
                  </span>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Quick Record Payment Modal */}
      {showRecordPaymentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowRecordPaymentModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              borderRadius: 'var(--radius-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Quick Record Payment
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Auto-allocated across oldest unpaid bills (FIFO)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit}>
              {/* Customer Selection */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Select Customer *</label>
                <select
                  className="form-control"
                  value={paymentCustomerId}
                  onChange={(e) => {
                    const cId = e.target.value
                    setPaymentCustomerId(cId)
                    // If customer selected, check their due
                    const custBills = (bills || []).filter(
                      (b) => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === String(cId)
                    )
                    const due = custBills.reduce((sum, b) => sum + Math.max(0, Number(b.total || 0) - Number(b.amountPaid || b.amount_paid || 0)), 0)
                    if (due > 0) {
                      setPaymentAmount(String(due))
                    }
                  }}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">-- Choose Customer --</option>
                  {(customers || [])
                    .filter((c) => !c.deleted && !c.deleted_at)
                    .map((c) => {
                      const custBills = (bills || []).filter(
                        (b) => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === String(c.id)
                      )
                      const due = custBills.reduce((sum, b) => sum + Math.max(0, Number(b.total || 0) - Number(b.amountPaid || b.amount_paid || 0)), 0)
                      const custCode = c.customerCode || SequenceService.formatDisplayCode(c.id, 'CUS')
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} ({custCode}) — Due: ₹{due.toFixed(2)}
                        </option>
                      )
                    })}
                </select>
              </div>

              {/* Outstanding Balance Banner */}
              {paymentCustomerId && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: selectedCustomerDue > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    border: `1px solid ${selectedCustomerDue > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL DUE BALANCE</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: selectedCustomerDue > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{selectedCustomerDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  {selectedCustomerDue > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setPaymentAmount(String(selectedCustomerDue))
                        if (paymentMode === 'split') {
                          setPaymentCash(String(selectedCustomerDue))
                          setPaymentUpi('0')
                        }
                      }}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      Pay Full Due
                    </button>
                  )}
                </div>
              )}

              {/* Payment Mode Selector */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Payment Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {['cash', 'upi', 'split'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      style={{
                        padding: '8px',
                        borderRadius: 'var(--radius-md)',
                        border: paymentMode === mode ? '2px solid #3b82f6' : '1px solid var(--border)',
                        background: paymentMode === mode ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                        color: paymentMode === mode ? '#3b82f6' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textTransform: 'uppercase'
                      }}
                    >
                      {mode === 'split' ? 'Cash + UPI' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Fields */}
              {paymentMode === 'split' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Cash Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control currency-num"
                      placeholder="0.00"
                      value={paymentCash}
                      onChange={(e) => setPaymentCash(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">UPI Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control currency-num"
                      placeholder="0.00"
                      value={paymentUpi}
                      onChange={(e) => setPaymentUpi(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control currency-num"
                    placeholder="Enter amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    style={{ fontSize: '1.1rem', fontWeight: 700 }}
                  />
                </div>
              )}

              {/* Reference Notes */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. GPay Ref #12345, Counter Cash..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRecordPaymentModal(false)}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingPayment}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 800 }}
                >
                  <CheckCircle size={16} />
                  {isSubmittingPayment ? 'Recording...' : 'Record Payment Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

