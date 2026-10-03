import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { usePayments, useInventory, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses, useExpenseMutations } from '../../hooks/useExpensesQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { useSettings, useSettingsMutations } from '../../hooks/useSettingsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { ProductAnalyticsService } from '../../services/productAnalyticsService'
import { STATEMENT_PERIOD_OPTIONS } from '../../services/statementService'
import { ReconciliationService } from '../../services/reconciliationService'
import ProductDrilldownModal from '../../components/accounting/ProductDrilldownModal'
import CustomServiceDrilldownModal from '../../components/accounting/CustomServiceDrilldownModal'
import VariantDrilldownModal from '../../components/accounting/VariantDrilldownModal'
import {
  ProductSalesAnalyticsData,
  CustomItemAnalyticsData,
  PrintVariantAnalyticsData,
} from '../../types/billing'
import {
  Wallet, Calculator, Calendar, ChevronRight, Plus, MessageSquare,
  CreditCard, ArrowRight, ArrowDownLeft, ArrowUpRight, Trash2, Edit2, Save,
  Download, Printer, FileText, Layers, Sparkles, Search
} from 'lucide-react'
import '../../styles/mobile.css'

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1]
const EXPENSE_CATEGORIES = [
  'Paper & Media',
  'Ink & Toners',
  'Equipment & Repairs',
  'Electricity & Utilities',
  'Staff Wages & Advance',
  'Shop Rent',
  'Hand Loan / Personal Transfer',
  'Owner Drawings / Cash Withdrawal',
  'General Supplies',
  'Miscellaneous',
]

export default function MobileAccounting() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { business, showToast, processRefund } = useAppContext()

  // Queries
  const { data: serverBills = [] } = useBills()
  const { data: serverPayments = [] } = usePayments()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverAdvancePayments = [] } = useAdvancePayments()
  const { data: serverSettings = {} } = useSettings()

  const { createExpense, deleteExpense } = useExpenseMutations()
  const { updateSettings } = useSettingsMutations()

  const bills = Array.isArray(serverBills) ? serverBills : []
  const payments = Array.isArray(serverPayments) ? serverPayments : []
  const expenses = Array.isArray(serverExpenses) ? serverExpenses : []
  const inventory = Array.isArray(serverInventory) ? serverInventory : []
  const customers = Array.isArray(serverCustomers) ? serverCustomers : []
  const advancePayments = Array.isArray(serverAdvancePayments) ? serverAdvancePayments : []

  // Active Tab
  const paramTab = searchParams.get('tab') || 'register'
  const [activeTab, setActiveTab] = useState(paramTab)

  // Daybook state & Dynamic Opening Cash
  const todayStr = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  
  const [openingCash, setOpeningCash] = useState<number>(() => {
    const cloudVal = (serverSettings as Record<string, unknown>)?.[`opening_cash_${todayStr}`]
    if (cloudVal !== undefined && !isNaN(Number(cloudVal))) return Number(cloudVal)
    const saved = localStorage.getItem(`printpro_opening_cash_${todayStr}`)
    if (saved !== null && !isNaN(Number(saved))) return Number(saved)
    return 0
  })
  const [isEditingOpeningCash, setIsEditingOpeningCash] = useState(false)
  const [tempOpeningCashInput, setTempOpeningCashInput] = useState('')

  useEffect(() => {
    const cloudVal = (serverSettings as Record<string, unknown>)?.[`opening_cash_${selectedDate}`]
    if (cloudVal !== undefined && !isNaN(Number(cloudVal))) {
      setOpeningCash(Number(cloudVal))
      localStorage.setItem(`printpro_opening_cash_${selectedDate}`, String(cloudVal))
      return
    }
    const saved = localStorage.getItem(`printpro_opening_cash_${selectedDate}`)
    if (saved !== null && !isNaN(Number(saved))) {
      setOpeningCash(Number(saved))
    } else {
      setOpeningCash(0)
    }
  }, [selectedDate, serverSettings])

  const handleSaveOpeningCash = async (val: number) => {
    if (isNaN(val) || val < 0) {
      showToast('Opening cash cannot be negative', 'error')
      return
    }
    const clean = Number(val.toFixed(2))
    setOpeningCash(clean)
    localStorage.setItem(`printpro_opening_cash_${selectedDate}`, String(clean))
    try {
      await updateSettings({
        [`opening_cash_${selectedDate}`]: clean,
      })
    } catch (_) {
      // Offline fallback preserved in localStorage
    }
    setIsEditingOpeningCash(false)
    showToast(`Opening cash set to ₹${clean.toFixed(2)}`, 'success')
  }

  // Item Sales Analytics state
  const [itemPeriod, setItemPeriod] = useState('this_month')
  const [itemSubTab, setItemSubTab] = useState<'variants' | 'all' | 'catalog' | 'custom'>('variants')
  const [itemSearchQuery, setItemSearchQuery] = useState('')
  const [selectedItemProduct, setSelectedItemProduct] = useState<ProductSalesAnalyticsData | null>(null)
  const [selectedItemCustom, setSelectedItemCustom] = useState<CustomItemAnalyticsData | null>(null)
  const [selectedItemVariant, setSelectedItemVariant] = useState<PrintVariantAnalyticsData | null>(null)
  const [isExportingItemReport, setIsExportingItemReport] = useState(false)

  const variantAnalytics = useMemo(() => {
    try {
      return ProductAnalyticsService.getPrintVariantsAnalytics({
        filter: itemPeriod,
        bills,
        products: inventory,
      }) || []
    } catch (err) {
      console.error('Error computing variantAnalytics:', err)
      return []
    }
  }, [itemPeriod, bills, inventory])

  const catalogAnalytics = useMemo(() => {
    try {
      return ProductAnalyticsService.getAllCatalogProductsAnalytics({
        filter: itemPeriod,
        bills,
        products: inventory,
      }) || []
    } catch (err) {
      console.error('Error computing catalogAnalytics:', err)
      return []
    }
  }, [itemPeriod, bills, inventory])

  const customAnalytics = useMemo(() => {
    try {
      return ProductAnalyticsService.getCustomItemsAnalytics({
        filter: itemPeriod,
        bills,
        products: inventory,
      }) || []
    } catch (err) {
      console.error('Error computing customAnalytics:', err)
      return []
    }
  }, [itemPeriod, bills, inventory])

  const allItemsAnalytics = useMemo(() => {
    try {
      const list = [
        ...(catalogAnalytics || []).map((c) => ({
          type: 'catalog' as const,
          id: c.product_id,
          name: c.product_name,
          code: c.product_code,
          category: c.category || 'General',
          qty: Number(c.total_quantity_sold || 0),
          revenue: Number(c.total_revenue || 0),
          avgRate: Number(c.average_selling_rate || 0),
          hasPriceVariance: Boolean(c.has_price_variance),
          raw: c,
        })),
        ...(customAnalytics || []).map((cu, idx) => ({
          type: 'custom' as const,
          id: `custom-${idx}`,
          name: cu.product_name,
          code: undefined,
          category: 'Custom Service',
          qty: Number(cu.total_quantity || 0),
          revenue: Number(cu.total_revenue || 0),
          avgRate: Number(cu.average_selling_rate || 0),
          hasPriceVariance: Boolean(cu.is_dynamic_rate),
          raw: cu,
        })),
      ]
      return list.sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    } catch (err) {
      console.error('Error computing allItemsAnalytics:', err)
      return []
    }
  }, [catalogAnalytics, customAnalytics])

  const itemSalesTotals = useMemo(() => {
    try {
      const totalQty = (allItemsAnalytics || []).reduce((sum, it) => sum + (it.qty || 0), 0)
      const totalRev = (allItemsAnalytics || []).reduce((sum, it) => sum + (it.revenue || 0), 0)
      const activeVariants = (variantAnalytics || []).filter(v => (v?.total_quantity || 0) > 0 || (v?.total_revenue || 0) > 0)
      const topVariant = activeVariants.length > 0 ? activeVariants[0] : null
      return { totalQty, totalRev, topVariant }
    } catch (err) {
      console.error('Error computing itemSalesTotals:', err)
      return { totalQty: 0, totalRev: 0, topVariant: null }
    }
  }, [allItemsAnalytics, variantAnalytics])

  const handleExportItemSalesPDF = () => {
    try {
      setIsExportingItemReport(true)
      const periodLabel = STATEMENT_PERIOD_OPTIONS.find((o) => o.value === itemPeriod)?.label || itemPeriod
      const doc = ProductAnalyticsService.generateComprehensiveItemSalesReportPDF({
        catalogData: catalogAnalytics,
        customData: customAnalytics,
        variantData: variantAnalytics,
        business,
        periodLabel,
        currency: '₹',
      })
      doc.save(`PrintPro_Item_Sales_Report_${itemPeriod}.pdf`)
      showToast('Item Sales Report PDF downloaded', 'success')
    } catch (err) {
      console.error('Failed to export Item Sales PDF:', err)
      showToast('Failed to export PDF report', 'error')
    } finally {
      setIsExportingItemReport(false)
    }
  }

  const handlePrintItemSalesPDF = () => {
    try {
      const periodLabel = STATEMENT_PERIOD_OPTIONS.find((o) => o.value === itemPeriod)?.label || itemPeriod
      const doc = ProductAnalyticsService.generateComprehensiveItemSalesReportPDF({
        catalogData: catalogAnalytics,
        customData: customAnalytics,
        variantData: variantAnalytics,
        business,
        periodLabel,
        currency: '₹',
      })
      doc.autoPrint()
      const blobUrl = doc.output('bloburl')
      window.open(blobUrl, '_blank')
    } catch (err) {
      console.error('Failed to print Item Sales Report:', err)
      showToast('Failed to open print preview', 'error')
    }
  }

  // Modals state
  const [showDenomSheet, setShowDenomSheet] = useState(false)
  const [showAddExpenseSheet, setShowAddExpenseSheet] = useState(false)
  const [showRefundSheet, setShowRefundSheet] = useState(false)
  const [expenseFilterCat, setExpenseFilterCat] = useState('all')

  // Denomination counter state
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  })

  // Add Expense form state
  const [expName, setExpName] = useState('')
  const [expCat, setExpCat] = useState('Paper & Media')
  const [expAmount, setExpAmount] = useState('')
  const [expMethod, setExpMethod] = useState<'cash' | 'upi'>('cash')
  const [expNotes, setExpNotes] = useState('')
  const [expLoanPerson, setExpLoanPerson] = useState('')
  const [expLoanDueDate, setExpLoanDueDate] = useState('')
  const [isSubmittingExp, setIsSubmittingExp] = useState(false)

  // Refund form state
  const [refCustomerId, setRefCustomerId] = useState('')
  const [refAmount, setRefAmount] = useState('')
  const [refMethod, setRefMethod] = useState('cash')
  const [refReason, setRefReason] = useState('')
  const [isSubmittingRef, setIsSubmittingRef] = useState(false)

  const navigate = useNavigate()

  // Reconciled Accounts Receivables & Debtors (synced exactly with Dashboard and Customer Ledger)
  const accountsReceivableData = useMemo(() => {
    return ReconciliationService.calculateAccountsReceivables({
      bills,
      payments,
      customers,
    })
  }, [bills, payments, customers])

  // Daily Calculations & Chronological Daybook Timeline
  const { dayCalculations, dayTransactions } = useMemo(() => {
    let cashSales = 0
    let cashAdvances = 0
    let upiSales = 0
    let upiAdvances = 0

    let cashOperatingExp = 0
    let cashLoans = 0
    let cashDrawings = 0
    let cashRefunds = 0

    let upiOperatingExp = 0
    let upiLoans = 0
    let upiDrawings = 0
    let upiRefunds = 0
    interface DayTransactionItem {
      id: string
      type: string
      amount: number
      label?: string
      method?: string
      time?: string
      details?: string
      category?: string
      title?: string
      mode?: string
      notes?: string
    }
    const txList: DayTransactionItem[] = []

    // 1. Payments collected on this date (excluding non-cash advance allocations)
    payments.forEach((p) => {
      const pDate = (p.date || p.created_at || '').slice(0, 10)
      if (pDate === selectedDate && !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0) {
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

        cashSales += cash
        upiSales += upi

        if (cash > 0) {
          txList.push({
            id: `pay-cash-${p.id}`,
            type: 'inflow',
            category: 'Bill Payment',
            title: p.customerName || `Bill Payment #${p.billId || p.id}`,
            mode: 'cash',
            amount: cash,
            notes: p.notes || ''
          })
        }
        if (upi > 0) {
          txList.push({
            id: `pay-upi-${p.id}`,
            type: 'inflow',
            category: 'Bill Payment (UPI)',
            title: p.customerName || `Bill Payment #${p.billId || p.id}`,
            mode: 'upi',
            amount: upi,
            notes: p.notes || ''
          })
        }
      }
    })

    // 2. Advance Payments deposited on this date
    advancePayments.forEach((ap) => {
      const apDate = (ap.date || ap.created_at || '').slice(0, 10)
      if (apDate === selectedDate && !ap.isReturn && Number(ap.amount || 0) > 0) {
        let cash = Number(ap.cashAmount || ap.cash_amount || 0)
        let upi = Number(ap.upiAmount || ap.upi_amount || 0)
        const amt = Number(ap.amount || 0)
        if (cash === 0 && upi === 0 && amt > 0) {
          const method = String(ap.paymentMethod || ap.payment_method || 'cash').toLowerCase()
          if (method === 'upi') upi = amt
          else cash = amt
        }

        cashAdvances += cash
        upiAdvances += upi

        if (cash > 0) {
          txList.push({
            id: `adv-cash-${ap.id}`,
            type: 'inflow',
            category: 'Advance Deposit',
            title: ap.customerName || `Customer Advance #${ap.id}`,
            mode: 'cash',
            amount: cash,
            notes: ap.notes || ''
          })
        }
        if (upi > 0) {
          txList.push({
            id: `adv-upi-${ap.id}`,
            type: 'inflow',
            category: 'Advance Deposit (UPI)',
            title: ap.customerName || `Customer Advance #${ap.id}`,
            mode: 'upi',
            amount: upi,
            notes: ap.notes || ''
          })
        }
      }
    })

    // 3. Expenses & Hand Loans on this date
    expenses.forEach((e) => {
      const eDate = (e.date || '').slice(0, 10)
      if (eDate === selectedDate) {
        const c = Number(e.cashAmount !== undefined ? e.cashAmount : (e.upiAmount ? 0 : e.amount || e.total || 0))
        const u = Number(e.upiAmount || 0)
        const cat = e.category || 'General'

        if (cat === 'Hand Loan / Personal Transfer') {
          cashLoans += c
          upiLoans += u
        } else if (cat === 'Owner Drawings / Cash Withdrawal') {
          cashDrawings += c
          upiDrawings += u
        } else {
          cashOperatingExp += c
          upiOperatingExp += u
        }

        if (c > 0) {
          txList.push({
            id: `exp-cash-${e.id}`,
            type: 'outflow',
            category: cat,
            title: e.itemName || e.description || 'Expense',
            mode: 'cash',
            amount: c,
            notes: e.notes || ''
          })
        }
        if (u > 0) {
          txList.push({
            id: `exp-upi-${e.id}`,
            type: 'outflow',
            category: cat,
            title: e.itemName || e.description || 'Expense',
            mode: 'upi',
            amount: u,
            notes: e.notes || ''
          })
        }
      }
    })

    // 4. Refunds on this date
    payments.forEach((p) => {
      const pDate = (p.date || p.created_at || '').slice(0, 10)
      if (pDate === selectedDate && (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)) {
        const amt = Math.abs(Number(p.amount || p.totalPaid || 0))
        const method = String(p.paymentMethod || p.payment_method || 'cash').toLowerCase()
        if (method === 'upi') {
          upiRefunds += amt
          txList.push({
            id: `ref-upi-${p.id}`,
            type: 'outflow',
            category: 'Refund (UPI)',
            title: p.customerName || 'Customer Refund',
            mode: 'upi',
            amount: amt,
            notes: p.reason || p.notes || ''
          })
        } else if (method === 'cash') {
          cashRefunds += amt
          txList.push({
            id: `ref-cash-${p.id}`,
            type: 'outflow',
            category: 'Refund (Cash)',
            title: p.customerName || 'Customer Refund',
            mode: 'cash',
            amount: amt,
            notes: p.reason || p.notes || ''
          })
        } else {
          // 'credit' / 'advance' / ledger credit refunds affect customer balance, not physical drawer cash
          txList.push({
            id: `ref-credit-${p.id}`,
            type: 'outflow',
            category: 'Refund (Advance Credit)',
            title: p.customerName || 'Customer Refund',
            mode: 'credit',
            amount: amt,
            notes: p.reason || p.notes || ''
          })
        }
      }
    })

    const totalCashIn = Number((cashSales + cashAdvances).toFixed(2))
    const totalCashOut = Number((cashOperatingExp + cashLoans + cashDrawings + cashRefunds).toFixed(2))
    const closingCash = Number((openingCash + totalCashIn - totalCashOut).toFixed(2))

    const totalUpiIn = Number((upiSales + upiAdvances).toFixed(2))
    const totalUpiOut = Number((upiOperatingExp + upiLoans + upiDrawings + upiRefunds).toFixed(2))
    const netUpi = Number((totalUpiIn - totalUpiOut).toFixed(2))

    return {
      dayCalculations: {
        cashIn: totalCashIn,
        cashSales,
        cashAdvances,
        cashOut: totalCashOut,
        cashOperatingExp,
        cashLoans,
        cashDrawings,
        cashRefunds,
        closingCash,
        upiIn: totalUpiIn,
        upiSales,
        upiAdvances,
        upiOut: totalUpiOut,
        upiOperatingExp,
        upiLoans,
        upiDrawings,
        upiRefunds,
        netUpi
      },
      dayTransactions: txList
    }
  }, [payments, advancePayments, expenses, selectedDate, openingCash])

  // Counted cash in denomination modal
  const totalCountedCash = useMemo(() => {
    return DENOMINATIONS.reduce((sum, denom) => sum + denom * (Number(denomCounts[denom]) || 0), 0)
  }, [denomCounts])
  const cashVariance = Number((totalCountedCash - dayCalculations.closingCash).toFixed(2))

  // Refunds list
  const refundsList = useMemo(() => {
    return payments.filter((p) => p && (p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0))
  }, [payments])

  // Analytics P&L
  const analyticsData = useMemo(() => {
    const grossRev = bills.filter((b) => !b.deleted && !b.deleted_at).reduce((s, b) => s + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0)
    const totalExp = expenses.reduce((s, e) => s + Number(e.amount || e.total || 0), 0)
    const totalRef = refundsList.reduce((s, r) => s + Math.abs(Number(r.amount || r.totalPaid || 0)), 0)
    const netRev = Math.max(0, grossRev - totalRef)
    const netProfit = Number((netRev - totalExp).toFixed(2))
    const netMarginPct = netRev > 0 ? Number(((netProfit / netRev) * 100).toFixed(1)) : 0
    return { netRev, totalExp, totalRef, netProfit, netMarginPct }
  }, [bills, expenses, refundsList])

  // WhatsApp Z-Report
  const handleShareWhatsAppZReport = () => {
    let msg = `*DAILY FINANCIAL Z-REPORT - ${business?.shopName || 'PrintPro'}*\n`
    msg += `*Date:* ${selectedDate}\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `• Opening Cash in Drawer: ₹${openingCash.toFixed(2)}\n`
    msg += `• Cash Collections: ₹${dayCalculations.cashIn.toFixed(2)} (Sales: ₹${dayCalculations.cashSales.toFixed(2)} | Adv: ₹${dayCalculations.cashAdvances.toFixed(2)})\n`
    msg += `• Cash Outflows: ₹${dayCalculations.cashOut.toFixed(2)} (Exp: ₹${dayCalculations.cashOperatingExp.toFixed(2)} | Loans/Drawings: ₹${(dayCalculations.cashLoans + dayCalculations.cashDrawings).toFixed(2)} | Ref: ₹${dayCalculations.cashRefunds.toFixed(2)})\n`
    msg += `• *Closing Cash in Drawer: ₹${dayCalculations.closingCash.toFixed(2)}*\n`
    msg += `──────────────────────\n`
    msg += `• UPI Inflow: ₹${dayCalculations.upiIn.toFixed(2)}\n`
    msg += `• UPI Outflows: ₹${dayCalculations.upiOut.toFixed(2)}\n`
    msg += `• *Net Digital Liquidity: ₹${dayCalculations.netUpi.toFixed(2)}*\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    const encoded = encodeURIComponent(msg)
    const phone = (business?.phone || '').trim().replace(/[^0-9]/g, '')
    if (phone) {
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, '_blank')
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
    }
  }

  // Create Expense / Hand Loan / Outflow Submit
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(expAmount || 0)
    if (!expName.trim() || amt <= 0) {
      showToast('Enter valid expense title and amount', 'error')
      return
    }
    if (expCat === 'Hand Loan / Personal Transfer' && !expLoanPerson.trim()) {
      showToast('Enter borrower person name for Hand Loan', 'error')
      return
    }
    setIsSubmittingExp(true)
    try {
      let notesCombined = expNotes.trim()
      if (expCat === 'Hand Loan / Personal Transfer') {
        const loanDetails = [
          expLoanPerson ? `Borrower: ${expLoanPerson.trim()}` : '',
          expLoanDueDate ? `Return Due: ${expLoanDueDate}` : '',
        ].filter(Boolean).join(' | ')
        notesCombined = notesCombined ? `${notesCombined} (${loanDetails})` : loanDetails
      }

      await createExpense({
        item_name: expName.trim(),
        category: expCat,
        total: amt,
        amount: amt,
        cash_amount: expMethod === 'cash' ? amt : 0,
        upi_amount: expMethod === 'upi' ? amt : 0,
        date: selectedDate,
        notes: notesCombined ? `${notesCombined} [${expMethod === 'upi' ? 'UPI' : 'Cash'}]` : `[Paid via ${expMethod === 'upi' ? 'UPI' : 'Cash'}]`
      })

      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      showToast(`Saved ${expCat} of ₹${amt.toFixed(2)}`, 'success')
      setExpName('')
      setExpAmount('')
      setExpNotes('')
      setExpLoanPerson('')
      setExpLoanDueDate('')
      setShowAddExpenseSheet(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg || 'Failed to record expense', 'error')
    } finally {
      setIsSubmittingExp(false)
    }
  }

  // Delete Expense Handler
  const handleDeleteExpense = async (id: string, name: string) => {
    if (!window.confirm(`Delete expense '${name}'?`)) return
    try {
      await deleteExpense(id)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['accounting'] })
      showToast('Expense removed', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg || 'Failed to delete expense', 'error')
    }
  }

  // Process Refund Submit
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(refAmount || 0)
    if (amt <= 0) {
      showToast('Enter valid refund amount', 'error')
      return
    }
    if (refMethod === 'credit' && !refCustomerId) {
      showToast('Please select a customer for Advance Credit refund', 'error')
      return
    }
    setIsSubmittingRef(true)
    try {
      if (processRefund) {
        processRefund({
          customerId: refCustomerId || undefined,
          amount: amt,
          method: refMethod,
          reason: refReason.trim() || 'Mobile Refund',
        })
      }
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      showToast(`Refund of ₹${amt.toFixed(2)} processed!`, 'success')
      setRefAmount('')
      setRefReason('')
      setShowRefundSheet(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(msg || 'Failed to process refund', 'error')
    } finally {
      setIsSubmittingRef(false)
    }
  }

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (expenseFilterCat === 'all') return expenses
    if (expenseFilterCat === 'loans') {
      return expenses.filter(e => e.category === 'Hand Loan / Personal Transfer' || e.category === 'Owner Drawings / Cash Withdrawal')
    }
    return expenses.filter(e => e.category === expenseFilterCat)
  }, [expenses, expenseFilterCat])

  return (
    <MobileLayout title="Finance & Accounts">
      {/* 1. Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>FINANCIAL CENTER</span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>ACCOUNTS & CASHBOOK</h2>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="mobile-btn mobile-btn-secondary"
            onClick={() => setShowDenomSheet(true)}
            style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem' }}
          >
            <Calculator size={14} color="var(--aurora-cyan, #00f0ff)" /> Count
          </button>
          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={handleShareWhatsAppZReport}
            style={{ width: 'auto', padding: '0 10px', minHeight: '34px', fontSize: '0.75rem', backgroundColor: '#25D366' }}
          >
            <MessageSquare size={14} /> Z-Report
          </button>
        </div>
      </div>

      {/* ── ACCOUNTS RECEIVABLE MOBILE SUMMARY BANNER ── */}
      <div
        className="mobile-card"
        style={{
          marginBottom: '14px',
          padding: '12px 14px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 56, 96, 0.3)',
          background: 'linear-gradient(135deg, rgba(255, 56, 96, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)',
          cursor: 'pointer',
        }}
        onClick={() => navigate('/customers?filter=with-dues')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <CreditCard size={13} color="var(--error)" />
              <span>Accounts Receivable (Net Dues)</span>
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--error)', margin: '4px 0 2px' }}>
              ₹{accountsReceivableData.totalReceivables.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {accountsReceivableData.debtorCount} debtor{accountsReceivableData.debtorCount === 1 ? '' : 's'} · ₹{accountsReceivableData.totalGrossDue.toFixed(2)} gross · ₹{accountsReceivableData.totalAdvancePool.toFixed(2)} adv pool
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-secondary)', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}>
            <span>Ledger</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* 2. 5 Sub-Tabs Pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '14px' }}>
        {[
          { key: 'register', label: 'Cashbook' },
          { key: 'expenses', label: `Expenses (${expenses.length})` },
          { key: 'refunds', label: 'Refunds' },
          { key: 'analytics', label: 'P&L & Analytics' },
          { key: 'items', label: 'Item Sales' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key)
              setSearchParams({ tab: tab.key })
            }}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: activeTab === tab.key ? '1px solid var(--aurora-cyan, #00f0ff)' : '1px solid var(--border)',
              background: activeTab === tab.key ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-card)',
              color: activeTab === tab.key ? 'var(--aurora-cyan, #00f0ff)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CASHBOOK & REGISTER */}
      {activeTab === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Date Picker Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Calendar size={16} color="var(--aurora-cyan, #00f0ff)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              className="mobile-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ minHeight: '32px', fontSize: '0.8rem', padding: '4px 8px', flex: 1 }}
            />
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid #00f0ff', color: '#00f0ff', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Today
              </button>
            )}
          </div>

          {/* DYNAMIC OPENING CASH CARD */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'rgba(0, 240, 255, 0.3)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={15} color="#00f0ff" />
                <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  Opening Cash in Drawer
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempOpeningCashInput(String(openingCash))
                  setIsEditingOpeningCash(!isEditingOpeningCash)
                }}
                style={{ background: 'none', border: 'none', color: '#00f0ff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Edit2 size={12} /> {isEditingOpeningCash ? 'Close' : 'Set Amount'}
              </button>
            </div>

            {isEditingOpeningCash ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="mobile-input currency-num"
                    style={{ height: '34px', fontSize: '0.85rem' }}
                    placeholder="Enter opening cash..."
                    value={tempOpeningCashInput}
                    onChange={(e) => setTempOpeningCashInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="mobile-btn mobile-btn-primary"
                    onClick={() => handleSaveOpeningCash(Number(tempOpeningCashInput))}
                    style={{ width: 'auto', minHeight: '34px', padding: '0 12px', fontSize: '0.76rem' }}
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[0, 500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSaveOpeningCash(preset)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: '#94a3b8',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  ₹{openingCash.toFixed(2)}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Starts today's physical drawer
                </span>
              </div>
            )}
          </div>

          {/* KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>CLOSING CASH IN DRAWER</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981', margin: '2px 0' }}>
                ₹{dayCalculations.closingCash.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                Start ₹{openingCash} + In ₹{dayCalculations.cashIn} - Out ₹{dayCalculations.cashOut}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-cyan, #00f0ff)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>UPI / DIGITAL INFLOW</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--aurora-cyan, #00f0ff)', margin: '2px 0' }}>
                ₹{dayCalculations.upiIn.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                Net digital: ₹{dayCalculations.netUpi.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL CASH INFLOWS</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#60a5fa', margin: '2px 0' }}>
                +₹{dayCalculations.cashIn.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                Sales: ₹{dayCalculations.cashSales.toFixed(2)} · Adv: ₹{dayCalculations.cashAdvances.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-amber, #f59e0b)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL CASH OUTFLOWS</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)', margin: '2px 0' }}>
                -₹{dayCalculations.cashOut.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                Exp: ₹{dayCalculations.cashOperatingExp.toFixed(2)} · Loans: ₹{dayCalculations.cashLoans.toFixed(2)} · Ref: ₹{dayCalculations.cashRefunds.toFixed(2)}
              </div>
            </div>
          </div>

          {/* HAND LOANS & SPECIAL TRANSFERS BANNER */}
          {(dayCalculations.cashLoans > 0 || dayCalculations.upiLoans > 0 || dayCalculations.cashDrawings > 0 || dayCalculations.upiDrawings > 0) && (
            <div className="mobile-card" style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#c084fc' }}>Hand Loans & Credit Out Today</div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    Cash: ₹{dayCalculations.cashLoans.toFixed(2)} · UPI: ₹{dayCalculations.upiLoans.toFixed(2)}
                  </div>
                </div>
                <span className="mobile-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontWeight: 800 }}>
                  ₹{(dayCalculations.cashLoans + dayCalculations.upiLoans + dayCalculations.cashDrawings + dayCalculations.upiDrawings).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* DAY TRANSACTIONS TIMELINE */}
          <div className="mobile-card" style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                Day Transactions Timeline ({dayTransactions.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddExpenseSheet(true)}
                style={{ background: 'none', border: 'none', color: '#00f0ff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
              >
                + Outflow
              </button>
            </div>

            {dayTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                No cash or UPI transactions recorded on this date.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dayTransactions.map((tx) => {
                  const isInflow = tx.type === 'inflow'
                  const isLoan = tx.category === 'Hand Loan / Personal Transfer'
                  return (
                    <div
                      key={tx.id}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isInflow ? 'rgba(16, 185, 129, 0.15)' : isLoan ? 'rgba(168, 85, 247, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {isInflow ? (
                            <ArrowDownLeft size={14} color="#10b981" />
                          ) : (
                            <ArrowUpRight size={14} color={isLoan ? '#c084fc' : '#f59e0b'} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#f8fafc' }}>
                            {tx.title}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            {tx.category} • <span style={{ textTransform: 'uppercase', fontWeight: 700, color: tx.mode === 'upi' ? '#00f0ff' : '#94a3b8' }}>{tx.mode}</span>
                            {tx.notes ? ` • ${tx.notes}` : ''}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontWeight: 900,
                            fontSize: '0.88rem',
                            fontFamily: 'var(--font-mono)',
                            color: isInflow ? '#10b981' : isLoan ? '#c084fc' : '#f59e0b'
                          }}
                        >
                          {isInflow ? '+' : '-'}₹{tx.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSES & OUTFLOWS */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>Expenses & Hand Loans</div>
            <button
              type="button"
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowAddExpenseSheet(true)}
              style={{ width: 'auto', minHeight: '34px', fontSize: '0.75rem', padding: '0 12px' }}
            >
              <Plus size={14} /> Record Outflow
            </button>
          </div>

          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'loans', label: 'Hand Loans' },
              { id: 'Paper & Media', label: 'Paper & Ink' },
              { id: 'Equipment & Repairs', label: 'Repairs' },
              { id: 'Staff Wages & Advance', label: 'Wages' },
              { id: 'Shop Rent', label: 'Rent' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setExpenseFilterCat(f.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  background: expenseFilterCat === f.id ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: expenseFilterCat === f.id ? '1px solid #00f0ff' : '1px solid var(--border)',
                  color: expenseFilterCat === f.id ? '#00f0ff' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No expenses or hand loans recorded.
            </div>
          ) : (
            filteredExpenses.slice(0, 50).map((exp) => {
              const isLoan = exp.category === 'Hand Loan / Personal Transfer'
              return (
                <div key={exp.id} className="mobile-card" style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>
                          {exp.itemName || exp.description}
                        </span>
                        {isLoan && (
                          <span className="mobile-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontSize: '0.62rem', padding: '1px 6px' }}>
                            Hand Loan
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span style={{ color: isLoan ? '#c084fc' : '#94a3b8' }}>{exp.category}</span> • {exp.date ? exp.date.slice(0, 10) : ''} • {exp.cashAmount > 0 ? '💵 Cash' : '📱 UPI'}
                      </div>
                      {exp.notes && (
                        <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '3px' }}>
                          {exp.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ color: isLoan ? '#c084fc' : 'var(--aurora-amber, #f59e0b)', fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                        -₹{Number(exp.amount || exp.total || 0).toFixed(2)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id, exp.itemName || exp.description)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* TAB 3: REFUNDS */}
      {activeTab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Customer Refunds</div>
            <button
              type="button"
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowRefundSheet(true)}
              style={{ width: 'auto', minHeight: '34px', fontSize: '0.75rem', padding: '0 12px' }}
            >
              <Plus size={14} /> Process Refund
            </button>
          </div>

          {refundsList.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
              No refunds recorded.
            </div>
          ) : (
            refundsList.map((ref, idx) => (
              <div key={idx} className="mobile-card" style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{ref.customerName || 'Refund'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ref.reason || ref.notes || 'Reversal'}</div>
                  </div>
                  <strong style={{ color: 'var(--aurora-pink, #ff2fb0)' }}>
                    -₹{Math.abs(Number(ref.amount || ref.totalPaid || 0)).toFixed(2)}
                  </strong>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET OPERATING PROFIT</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>
                ₹{analyticsData.netProfit.toFixed(2)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '12px', borderLeft: '3px solid var(--aurora-cyan, #00f0ff)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>NET MARGIN HEALTH</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)' }}>
                {analyticsData.netMarginPct}%
              </div>
            </div>
          </div>

          <div className="mobile-card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>Net Revenue</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₹{analyticsData.netRev.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Total Expenses: ₹{analyticsData.totalExp.toFixed(2)} • Refunds: ₹{analyticsData.totalRef.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ITEM SALES */}
      {activeTab === 'items' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top Actions & PDF Export Header */}
          <div className="mobile-card" style={{ padding: '12px 14px', background: 'linear-gradient(135deg, rgba(16,13,35,0.95), rgba(30,27,75,0.6))', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <Layers size={16} color="var(--aurora-cyan, #00f0ff)" />
                  Item & Variant Intelligence
                </h3>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Complete sales report for catalog products, custom items & print variants
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleExportItemSalesPDF}
                  disabled={isExportingItemReport}
                  className="mobile-btn"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: 'var(--aurora-cyan, #00f0ff)',
                    color: '#000000',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Export PDF Report"
                >
                  <Download size={13} />
                  {isExportingItemReport ? 'Generating...' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  onClick={handlePrintItemSalesPDF}
                  className="mobile-btn mobile-btn-secondary"
                  style={{
                    padding: '6px 10px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title="Print Report"
                >
                  <Printer size={13} />
                  Print
                </button>
              </div>
            </div>
          </div>

          {/* Quick KPI Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div className="mobile-card" style={{ padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Units Sold</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                {itemSalesTotals.totalQty.toLocaleString('en-IN')}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Realized Revenue</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                ₹{itemSalesTotals.totalRev.toFixed(0)}
              </div>
            </div>

            <div className="mobile-card" style={{ padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Top Print Variant</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--aurora-cyan, #00f0ff)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {itemSalesTotals.topVariant ? itemSalesTotals.topVariant.variant_label : 'N/A'}
              </div>
            </div>
          </div>

          {/* Controls: SubTabs & Period */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <button
                type="button"
                onClick={() => setItemSubTab('variants')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: itemSubTab === 'variants' ? 700 : 500,
                  background: itemSubTab === 'variants' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'variants' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Variants ({variantAnalytics.filter(v => v.total_quantity > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setItemSubTab('all')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: itemSubTab === 'all' ? 700 : 500,
                  background: itemSubTab === 'all' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'all' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                All ({allItemsAnalytics.length})
              </button>
              <button
                type="button"
                onClick={() => setItemSubTab('catalog')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: itemSubTab === 'catalog' ? 700 : 500,
                  background: itemSubTab === 'catalog' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'catalog' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Catalog ({catalogAnalytics.length})
              </button>
              <button
                type="button"
                onClick={() => setItemSubTab('custom')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: itemSubTab === 'custom' ? 700 : 500,
                  background: itemSubTab === 'custom' ? 'var(--aurora-cyan, #00f0ff)' : 'transparent',
                  color: itemSubTab === 'custom' ? '#000000' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Custom ({customAnalytics.length})
              </button>
            </div>

            <select
              value={itemPeriod}
              onChange={(e) => setItemPeriod(e.target.value)}
              className="mobile-input"
              style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.72rem', width: 'auto' }}
            >
              {STATEMENT_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Filter items or variants..."
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              className="mobile-input"
              style={{ paddingLeft: '32px', fontSize: '0.75rem', minHeight: '32px' }}
            />
          </div>

          {/* SUBTAB 1: PRINT VARIANTS (A4/A3 Color & B/W, Sides, Binding) */}
          {itemSubTab === 'variants' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(variantAnalytics || [])
                .filter((v) => {
                  if (!v) return false
                  if (itemSearchQuery) {
                    const q = itemSearchQuery.toLowerCase()
                    return (v.variant_label || '').toLowerCase().includes(q) || (v.variant_key || '').toLowerCase().includes(q)
                  }
                  return true
                })
                .map((v) => {
                  const hasSales = (v.total_quantity || 0) > 0 || (v.total_revenue || 0) > 0
                  return (
                    <div
                      key={v.variant_key || v.variant_label}
                      className="mobile-card"
                      onClick={() => setSelectedItemVariant(v)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderLeft: hasSales ? '3px solid var(--aurora-cyan, #00f0ff)' : '3px solid var(--border)',
                        opacity: hasSales ? 1 : 0.65,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.variant_label || 'Print Variant'}</span>
                          {v.paper_size && v.paper_size !== 'N/A' && (
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(0,240,255,0.1)', color: '#00f0ff', fontFamily: 'monospace' }}>
                              {v.paper_size}
                            </span>
                          )}
                          {v.print_type === 'Color' && (
                            <span style={{ fontSize: '0.62rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', fontWeight: 600 }}>
                              Color
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {v.total_quantity || 0} prints sold • {v.min_rate !== v.max_rate ? `₹${(v.min_rate || 0).toFixed(0)}-₹${(v.max_rate || 0).toFixed(0)} (Avg ₹${(v.average_rate || 0).toFixed(1)})` : `Rate: ₹${(v.average_rate || 0).toFixed(1)}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: hasSales ? '#10b981' : 'var(--text-muted)', fontSize: '0.88rem' }}>
                          ₹{(v.total_revenue || 0).toFixed(2)}
                        </strong>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}

          {/* SUBTAB 2: ALL ITEMS (Combined Catalog & Custom) */}
          {itemSubTab === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(allItemsAnalytics || [])
                .filter((item) => {
                  if (!item) return false
                  if (itemSearchQuery) {
                    const q = itemSearchQuery.toLowerCase()
                    return (item.name || '').toLowerCase().includes(q) || ((item.code || '').toLowerCase().includes(q))
                  }
                  return true
                })
                .map((item) => (
                  <div
                    key={item.id}
                    className="mobile-card"
                    onClick={() => {
                      if (item.type === 'catalog') {
                        setSelectedItemProduct(item.raw as ProductSalesAnalyticsData)
                      } else {
                        setSelectedItemCustom(item.raw as CustomItemAnalyticsData)
                      }
                    }}
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name || 'Item'}</span>
                        <span style={{
                          fontSize: '0.62rem',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: item.type === 'catalog' ? 'rgba(0,240,255,0.1)' : 'rgba(245,158,11,0.15)',
                          color: item.type === 'catalog' ? '#00f0ff' : '#fbbf24',
                          fontWeight: 600
                        }}>
                          {item.type === 'catalog' ? (item.code || 'Catalog') : 'Custom'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.qty || 0} sold • Avg ₹{(item.avgRate || 0).toFixed(1)}
                        {item.hasPriceVariance && (
                          <span style={{ marginLeft: '6px', color: '#f59e0b' }}>• Dynamic</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
                        ₹{(item.revenue || 0).toFixed(2)}
                      </strong>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* SUBTAB 3: CATALOG ONLY */}
          {itemSubTab === 'catalog' && (
            (catalogAnalytics || []).length === 0 ? (
              <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No catalog sales in selected period.
              </div>
            ) : (
              (catalogAnalytics || [])
                .filter((prod) => {
                  if (!prod) return false
                  if (itemSearchQuery) {
                    const q = itemSearchQuery.toLowerCase()
                    return (prod.product_name || '').toLowerCase().includes(q) || ((prod.product_code || '').toLowerCase().includes(q))
                  }
                  return true
                })
                .map((prod) => (
                  <div
                    key={prod.product_id}
                    className="mobile-card"
                    onClick={() => setSelectedItemProduct(prod)}
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prod.product_name || 'Product'}</span>
                        {prod.product_code && (
                          <span style={{ fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(0,240,255,0.1)', color: '#00f0ff', fontFamily: 'monospace' }}>
                            {prod.product_code}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {prod.total_quantity_sold || 0} sold • Avg ₹{(prod.average_selling_rate || 0).toFixed(1)}
                        {prod.has_price_variance && (
                          <span style={{ marginLeft: '6px', color: '#f59e0b' }}>• Dynamic</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
                        ₹{(prod.total_revenue || 0).toFixed(2)}
                      </strong>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                ))
            )
          )}

          {/* SUBTAB 4: CUSTOM ONLY */}
          {itemSubTab === 'custom' && (
            (customAnalytics || []).length === 0 ? (
              <div className="mobile-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No custom services in selected period.
              </div>
            ) : (
              (customAnalytics || [])
                .filter((item) => {
                  if (!item) return false
                  if (itemSearchQuery) {
                    const q = itemSearchQuery.toLowerCase()
                    return (item.product_name || '').toLowerCase().includes(q)
                  }
                  return true
                })
                .map((item, idx) => (
                  <div
                    key={idx}
                    className="mobile-card"
                    onClick={() => setSelectedItemCustom(item)}
                    style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product_name || 'Custom Service'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.total_quantity || 0} qty • Rate: ₹{(item.min_rate || 0).toFixed(0)}-₹{(item.max_rate || 0).toFixed(0)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
                        ₹{(item.total_revenue || 0).toFixed(2)}
                      </strong>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                ))
            )
          )}
        </div>
      )}

      {/* Denomination Counter BottomSheet */}
      <BottomSheet isOpen={showDenomSheet} onClose={() => setShowDenomSheet(false)} title="Cash Drawer Note Counter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>EXPECTED</div>
              <strong>₹{dayCalculations.closingCash.toFixed(2)}</strong>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COUNTED</div>
              <strong style={{ color: 'var(--aurora-cyan, #00f0ff)' }}>₹{totalCountedCash.toFixed(2)}</strong>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>VARIANCE</div>
              <strong style={{ color: cashVariance === 0 ? '#10b981' : cashVariance > 0 ? 'var(--aurora-cyan, #00f0ff)' : '#ef4444' }}>
                {cashVariance >= 0 ? '+' : ''}₹{cashVariance.toFixed(2)}
              </strong>
            </div>
          </div>

          {DENOMINATIONS.map((denom) => (
            <div key={denom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{denom} note</span>
              <input
                type="number"
                min="0"
                step="1"
                className="mobile-input"
                style={{ width: '80px', minHeight: '32px', textAlign: 'center' }}
                placeholder="0"
                value={denomCounts[denom] || ''}
                onChange={(e) => {
                  const raw = e.target.value
                  const val = raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0))
                  setDenomCounts((prev) => ({ ...prev, [denom]: val }))
                }}
              />
            </div>
          ))}

          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={() => {
              if (cashVariance !== 0) {
                const isShort = cashVariance < 0
                const diffAbs = Math.abs(cashVariance).toFixed(2)
                const confirmed = window.confirm(
                  `Cash Discrepancy Detected:\n\n• Counted in Drawer: ₹${totalCountedCash.toFixed(2)}\n• Expected Closing Cash: ₹${dayCalculations.closingCash.toFixed(2)}\n• Variance: ${isShort ? 'SHORTAGE' : 'EXCESS'} of ₹${diffAbs}\n\nDo you want to confirm this count with the recorded variance?`
                )
                if (!confirmed) return
              }
              showToast(
                `Drawer verified: ₹${totalCountedCash.toFixed(2)}${cashVariance !== 0 ? ` (${cashVariance > 0 ? '+' : ''}₹${cashVariance.toFixed(2)} variance)` : ''}`,
                cashVariance !== 0 ? 'warning' : 'success'
              )
              setShowDenomSheet(false)
            }}
          >
            Confirm Count
          </button>
        </div>
      </BottomSheet>

      {/* Record Expense / Hand Loan / Outflow BottomSheet */}
      <BottomSheet isOpen={showAddExpenseSheet} onClose={() => setShowAddExpenseSheet(false)} title="Record Business Outflow">
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
              Category *
            </label>
            <select className="mobile-input" value={expCat} onChange={(e) => setExpCat(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
              {expCat === 'Hand Loan / Personal Transfer' ? 'Loan / Transfer Purpose *' : 'Expense Title *'}
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder={expCat === 'Hand Loan / Personal Transfer' ? 'e.g. Hand loan to Ramesh' : 'e.g. A4 Paper Rim, Electricity Bill'}
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
              required
            />
          </div>

          {expCat === 'Hand Loan / Personal Transfer' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Borrower Person Name
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder="e.g. Ramesh"
                  value={expLoanPerson}
                  onChange={(e) => setExpLoanPerson(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                  Expected Return Date
                </label>
                <input
                  type="date"
                  className="mobile-input"
                  value={expLoanDueDate}
                  onChange={(e) => setExpLoanDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                className="mobile-input currency-num"
                placeholder="0.00"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                Payment Source
              </label>
              <select className="mobile-input" value={expMethod} onChange={(e) => setExpMethod(e.target.value as 'cash' | 'upi')}>
                <option value="cash">💵 Cash Drawer</option>
                <option value="upi">📱 UPI / Bank</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
              Additional Notes (Optional)
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Receipt #, remarks"
              value={expNotes}
              onChange={(e) => setExpNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmittingExp} style={{ marginTop: '4px' }}>
            {isSubmittingExp ? 'Saving Outflow...' : 'Save Outflow Record'}
          </button>
        </form>
      </BottomSheet>

      {/* Process Refund BottomSheet */}
      <BottomSheet isOpen={showRefundSheet} onClose={() => setShowRefundSheet(false)} title="Process Refund">
        <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <select className="mobile-input" value={refCustomerId} onChange={(e) => setRefCustomerId(e.target.value)}>
            <option value="">-- Customer (Optional) --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.phone || 'Customer'}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            className="mobile-input"
            placeholder="Refund Amount (₹) *"
            value={refAmount}
            onChange={(e) => setRefAmount(e.target.value)}
            required
          />
          <select className="mobile-input" value={refMethod} onChange={(e) => setRefMethod(e.target.value)}>
            <option value="cash">Cash Out</option>
            <option value="upi">UPI Transfer</option>
            <option value="credit">Advance Credit</option>
          </select>
          <input
            type="text"
            className="mobile-input"
            placeholder="Reason for refund *"
            value={refReason}
            onChange={(e) => setRefReason(e.target.value)}
            required
          />
          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isSubmittingRef}>
            {isSubmittingRef ? 'Processing...' : 'Confirm Refund'}
          </button>
        </form>
      </BottomSheet>

      {/* Product Drilldown Modal (Bottom Sheet on Mobile) */}
      <ProductDrilldownModal
        isOpen={!!selectedItemProduct}
        onClose={() => setSelectedItemProduct(null)}
        productData={selectedItemProduct}
        business={business}
        periodLabel={itemPeriod}
      />

      {/* Custom Service Drilldown Modal (Bottom Sheet on Mobile) */}
      <CustomServiceDrilldownModal
        isOpen={!!selectedItemCustom}
        onClose={() => setSelectedItemCustom(null)}
        serviceData={selectedItemCustom}
        business={business}
        periodLabel={itemPeriod}
      />

      {/* Print Variant Drilldown Modal (Bottom Sheet on Mobile) */}
      <VariantDrilldownModal
        isOpen={!!selectedItemVariant}
        onClose={() => setSelectedItemVariant(null)}
        variantData={selectedItemVariant}
        business={business}
        periodLabel={itemPeriod}
      />
    </MobileLayout>
  )
}

