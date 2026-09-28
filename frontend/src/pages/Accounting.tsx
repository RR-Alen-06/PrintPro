import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../context/AppContext'
import { useBills } from '../hooks/useBillsQuery'
import { usePayments, useInventory, useAdvancePayments, useDeletedPayments } from '../hooks/useEntitiesQuery'
import { useExpenses, useExpenseMutations } from '../hooks/useExpensesQuery'
import { useCustomers } from '../hooks/useCustomersQuery'
import {
  DollarSign, Wallet, FileText, RotateCcw, TrendingUp, Layers, Calculator,
  Calendar, CheckCircle, AlertTriangle, Smartphone, ChevronRight, BarChart2
} from 'lucide-react'
import { SequenceService } from '../services/sequenceService'

// Sub-components
import { CashbookRegisterTab } from '../components/accounting/CashbookRegisterTab'
import { ExpensesTab } from '../components/accounting/ExpensesTab'
import { RefundsTab } from '../components/accounting/RefundsTab'
import { AnalyticsTab } from '../components/accounting/AnalyticsTab'
import { ItemSalesTab } from '../components/accounting/ItemSalesTab'
import { CashDenominationModal } from '../components/accounting/CashDenominationModal'
import { ZReportModal } from '../components/accounting/ZReportModal'

export default function Accounting() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { business, settings, showToast, showConfirm, processRefund } = useAppContext()

  // Queries
  const { data: serverBills = [] } = useBills()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverRefunds = [] } = useDeletedPayments() // or refund payments
  const { data: serverInventory = [] } = useInventory()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverAdvancePayments = [] } = useAdvancePayments()

  const { createExpenseMutation, deleteExpenseMutation } = useExpenseMutations()

  const bills = Array.isArray(serverBills) ? serverBills : []
  const payments = Array.isArray(serverPayments) ? serverPayments : []
  const expenses = Array.isArray(serverExpenses) ? serverExpenses : []
  const inventory = Array.isArray(serverInventory) ? serverInventory : []
  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []

  // Extracted refunds from payments or deleted payments
  const refunds = useMemo(() => {
    const listFromPayments = payments.filter(
      (p: any) => p && (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)
    )
    const listFromDeleted = (Array.isArray(serverRefunds) ? serverRefunds : []).filter(
      (p: any) => p && (p.isRefund || p.paymentType === 'refund')
    )
    const combined = [...listFromPayments]
    listFromDeleted.forEach((d: any) => {
      if (!combined.some((c: any) => c.id === d.id)) combined.push(d)
    })
    return combined
  }, [payments, serverRefunds])

  // Current tab from URL search param
  const activeTab = (searchParams.get('tab') as 'register' | 'expenses' | 'refunds' | 'analytics' | 'items') || 'register'

  const handleTabChange = (tab: 'register' | 'expenses' | 'refunds' | 'analytics' | 'items') => {
    setSearchParams({ tab })
  }

  // Selected Daybook Date
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [openingCash, setOpeningCash] = useState<number>(1000)

  // Modals state
  const [isDenomModalOpen, setIsDenomModalOpen] = useState(false)
  const [isZReportModalOpen, setIsZReportModalOpen] = useState(false)

  // Daybook Inflows & Outflows for selected date
  const dayCalculations = useMemo(() => {
    let cashIn = 0
    let upiIn = 0
    let cashOut = 0
    let upiOut = 0
    const txList: any[] = []

    // 1. Payments collected on this date
    payments.forEach((p: any) => {
      const pDate = (p.date || p.created_at || '').slice(0, 10)
      if (pDate === selectedDate && !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0) {
        const cash = Number(p.cashAmount || p.cash_amount || 0)
        const upi = Number(p.upiAmount || p.upi_amount || 0)
        cashIn += cash
        upiIn += upi

        const paymentDisplay = p.paymentCode || SequenceService.formatDisplayCode('payment', p.id || p, 'PAY')
        txList.push({
          id: p.id,
          date: pDate,
          time: p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
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
      if (apDate === selectedDate && !ap.isReturn && Number(ap.amount || 0) > 0) {
        const cash = Number(ap.cashAmount || ap.cash_amount || (ap.paymentMethod === 'cash' ? ap.amount : 0))
        const upi = Number(ap.upiAmount || ap.upi_amount || (ap.paymentMethod === 'upi' ? ap.amount : 0))
        cashIn += cash
        upiIn += upi

        const advDisplay = SequenceService.formatDisplayCode('advance', ap.id || ap, 'ADV')
        txList.push({
          id: ap.id,
          date: apDate,
          time: ap.created_at ? new Date(ap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          ref: advDisplay,
          type: 'in',
          description: `Advance Deposit (${ap.customerName || 'Customer'})`,
          partyName: ap.customerName,
          method: ap.paymentMethod || 'Cash',
          cashAmount: cash,
          upiAmount: upi,
          total: Number(ap.amount || 0),
        })
      }
    })

    // 3. Expenses on this date
    expenses.forEach((e: any) => {
      const eDate = (e.date || '').slice(0, 10)
      if (eDate === selectedDate) {
        const cash = Number(e.cashAmount !== undefined ? e.cashAmount : (e.upiAmount ? 0 : e.amount || e.total || 0))
        const upi = Number(e.upiAmount || 0)
        cashOut += cash
        upiOut += upi

        const expDisplay = e.expenseCode || SequenceService.formatDisplayCode('expense', e.id || e, 'EXP')
        txList.push({
          id: e.id,
          date: eDate,
          time: e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
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
    refunds.forEach((r: any) => {
      const rDate = (r.date || r.created_at || '').slice(0, 10)
      if (rDate === selectedDate) {
        const amt = Math.abs(Number(r.amount || r.totalPaid || 0))
        const isUpi = r.paymentMethod === 'upi' || r.method === 'upi'
        if (isUpi) upiOut += amt
        else cashOut += amt

        const refDisplay = SequenceService.formatDisplayCode('creditNote', r.id || r, 'REF')
        txList.push({
          id: r.id,
          date: rDate,
          time: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          ref: refDisplay,
          type: 'out',
          description: `Refund: ${r.reason || r.notes || 'Customer Reversal'}`,
          method: isUpi ? 'UPI' : 'Cash',
          cashAmount: isUpi ? 0 : amt,
          upiAmount: isUpi ? amt : 0,
          total: amt,
        })
      }
    })

    const closingCash = Number((openingCash + cashIn - cashOut).toFixed(2))

    return {
      cashIn,
      upiIn,
      cashOut,
      upiOut,
      closingCash,
      txList: txList.sort((a, b) => (b.time || '').localeCompare(a.time || '')),
    }
  }, [payments, advancePayments, expenses, refunds, selectedDate, openingCash])

  // Z-Report Summary
  const zReportSummary = useMemo(() => {
    const dayBills = bills.filter((b) => (b.date || b.created_at || '').slice(0, 10) === selectedDate && !b.deleted && !b.deleted_at)
    const grossSales = dayBills.reduce((s, b) => s + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0)
    const discounts = dayBills.reduce((s, b) => s + Number(b.discountAmount || b.discountValue || 0), 0)
    const netSales = Math.max(0, grossSales - discounts)

    return {
      billsCount: dayBills.length,
      grossSales,
      discounts,
      netSales,
      cashCollected: dayCalculations.cashIn,
      upiCollected: dayCalculations.upiIn,
      advanceCollected: 0,
      totalExpenses: dayCalculations.cashOut + dayCalculations.upiOut,
      cashExpenses: dayCalculations.cashOut,
      upiExpenses: dayCalculations.upiOut,
      totalRefunds: 0,
      openingCash,
      closingCash: dayCalculations.closingCash,
    }
  }, [bills, selectedDate, dayCalculations, openingCash])

  // Handler for creating expense
  const handleCreateExpense = async (data: any) => {
    await createExpenseMutation.mutateAsync(data)
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
  }

  // Handler for deleting expense
  const handleDeleteExpense = async (id: string) => {
    await deleteExpenseMutation.mutateAsync(id)
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
  }

  // Handler for processing refund
  const handleProcessRefund = async (refundData: any) => {
    if (processRefund) {
      processRefund(refundData)
    }
    queryClient.invalidateQueries({ queryKey: ['payments'] })
    queryClient.invalidateQueries({ queryKey: ['bills'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* 1. Header with Title & Quick Tabs Bar */}
      <div className="page-header" style={{ marginBottom: '18px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <DollarSign size={26} color="var(--aurora-cyan, #00f0ff)" />
            Finance & Accounts
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Unified command center for cashbook flows, business expenses, customer refunds, and real-time P&L analytics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsDenomModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calculator size={14} color="var(--aurora-cyan, #00f0ff)" />
            Count Cash Drawer
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsZReportModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} />
            Daily Z-Report
          </button>
        </div>
      </div>

      {/* 2. 5 Glowing Sub-Tabs Navigation Bar */}
      <div
        className="card"
        style={{
          padding: '8px',
          marginBottom: '20px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'register', label: 'Cashbook & Register', icon: DollarSign },
          { key: 'expenses', label: `Expenses (${expenses.length})`, icon: Layers },
          { key: 'refunds', label: `Refunds (${refunds.length})`, icon: RotateCcw },
          { key: 'analytics', label: 'P&L & Analytics', icon: TrendingUp },
          { key: 'items', label: 'Item Sales Velocity', icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key as any)}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                backgroundColor: isActive ? 'rgba(0, 240, 255, 0.16)' : 'transparent',
                color: isActive ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
                border: isActive ? '1px solid rgba(0, 240, 255, 0.38)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 16px rgba(0, 240, 255, 0.22)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* 3. Sub-Tab Content Rendering */}
      {activeTab === 'register' && (
        <CashbookRegisterTab
          date={selectedDate}
          onDateChange={setSelectedDate}
          openingCash={openingCash}
          onUpdateOpeningCash={setOpeningCash}
          cashIn={dayCalculations.cashIn}
          upiIn={dayCalculations.upiIn}
          cashOut={dayCalculations.cashOut}
          upiOut={dayCalculations.upiOut}
          closingCash={dayCalculations.closingCash}
          transactions={dayCalculations.txList}
          onOpenDenominationModal={() => setIsDenomModalOpen(true)}
          onOpenZReportModal={() => setIsZReportModalOpen(true)}
          showToast={showToast}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesTab
          expenses={expenses}
          onCreateExpense={handleCreateExpense}
          onDeleteExpense={handleDeleteExpense}
          showToast={showToast}
          showConfirm={showConfirm}
        />
      )}

      {activeTab === 'refunds' && (
        <RefundsTab
          refunds={refunds}
          customers={customers}
          bills={bills}
          onProcessRefund={handleProcessRefund}
          showToast={showToast}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          bills={bills}
          expenses={expenses}
          refunds={refunds}
          inventory={inventory}
        />
      )}

      {activeTab === 'items' && (
        <ItemSalesTab
          bills={bills}
          inventory={inventory}
          customers={customers}
          business={business}
          settings={settings}
        />
      )}

      {/* 4. Modals */}
      <CashDenominationModal
        isOpen={isDenomModalOpen}
        onClose={() => setIsDenomModalOpen(false)}
        expectedCash={dayCalculations.closingCash}
        showToast={showToast}
      />

      <ZReportModal
        isOpen={isZReportModalOpen}
        onClose={() => setIsZReportModalOpen(false)}
        date={selectedDate}
        business={business}
        summary={zReportSummary}
        showToast={showToast}
      />
    </div>
  )
}
