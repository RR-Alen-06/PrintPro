import React, { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Trash2, CheckCircle, Plus, Banknote, Smartphone, RefreshCw, Percent, Calculator, ExternalLink } from 'lucide-react'
import PeriodReport from '../components/PeriodReport'
import EmptyState from '../components/common/EmptyState'

const Accounting = () => {
  const { bills, payments, expenses, advancePayments, customers, inventory, addExpense, deleteExpense, deletedPayments, syncFromCloud, showToast } = useAppContext()

  const today = new Date().toISOString().slice(0, 10)
  const [expForm, setExpForm] = useState({
    date: today,
    description: '',
    amount: '',
    cashAmount: '',
    upiAmount: '',
    receiptUrl: '',
  })
  const [expError, setExpError] = useState('')
  const [expSuccess, setExpSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('general') // 'general' | 'gst'

  const gstReport = useMemo(() => {
    const activeBills = bills.filter((b) => !b.deleted && !b.isGroupParent)
    
    let totalTaxable = 0
    let totalCGST = 0
    let totalSGST = 0
    let totalGST = 0

    const ratesMap = {}
    const hsnMap = {}
    const b2bList = []
    const b2cList = []

    activeBills.forEach(b => {
      const cust = customers.find(c => c.id === b.customerId)
      const gstin = cust?.gstin || ''
      
      let billTaxable = 0
      let billCGST = 0
      let billSGST = 0
      let billGST = 0

      if (b.items && b.items.length > 0) {
        b.items.forEach(item => {
          const rate = Number(item.gstRate || 0)
          const totalAmt = Number(item.amount || 0)
          const qty = Number(item.qty || 1)
          
          const taxable = totalAmt / (1 + rate / 100)
          const gst = totalAmt - taxable
          const halfGst = gst / 2

          billTaxable += taxable
          billGST += gst
          billCGST += halfGst
          billSGST += halfGst

          if (!ratesMap[rate]) ratesMap[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 }
          ratesMap[rate].taxable += taxable
          ratesMap[rate].cgst += halfGst
          ratesMap[rate].sgst += halfGst
          ratesMap[rate].total += totalAmt

          const invItem = inventory?.find(i => String(i.id) === String(item.itemId))
          const hsn = invItem?.hsnCode || '9989'
          if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, total: 0, qty: 0 }
          hsnMap[hsn].taxable += taxable
          hsnMap[hsn].cgst += halfGst
          hsnMap[hsn].sgst += halfGst
          hsnMap[hsn].total += totalAmt
          hsnMap[hsn].qty += qty
        })
      } else {
        const rate = 18
        const totalAmt = Number(b.total || 0)
        const billGstAmount = Number(b.gstAmount || 0)
        const taxable = totalAmt - billGstAmount
        const halfGst = billGstAmount / 2

        billTaxable += taxable
        billGST += billGstAmount
        billCGST += halfGst
        billSGST += halfGst

        if (!ratesMap[rate]) ratesMap[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 }
        ratesMap[rate].taxable += taxable
        ratesMap[rate].cgst += halfGst
        ratesMap[rate].sgst += halfGst
        ratesMap[rate].total += totalAmt

        const hsn = '9989'
        if (!hsnMap[hsn]) hsnMap[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, total: 0, qty: 0 }
        hsnMap[hsn].taxable += taxable
        hsnMap[hsn].cgst += halfGst
        hsnMap[hsn].sgst += halfGst
        hsnMap[hsn].total += totalAmt
        hsnMap[hsn].qty += 1
      }

      totalTaxable += billTaxable
      totalCGST += billCGST
      totalSGST += billSGST
      totalGST += billGST

      const record = {
        billId: b.id,
        date: b.date,
        customerName: b.customerName,
        gstin,
        taxable: billTaxable,
        cgst: billCGST,
        sgst: billSGST,
        total: b.total
      }

      if (gstin) {
        b2bList.push(record)
      } else {
        b2cList.push(record)
      }
    })

    return {
      totalTaxable,
      totalCGST,
      totalSGST,
      totalGST,
      rates: Object.entries(ratesMap).map(([rate, vals]) => ({ rate: Number(rate), ...vals })),
      hsn: Object.values(hsnMap),
      b2b: b2bList,
      b2c: b2cList
    }
  }, [bills, customers, inventory])

  const exportGSTR1CSV = () => {
    let csvContent = 'GSTIN of Recipient,Receiver Name,Invoice Number,Invoice Date,Invoice Value,Taxable Value,CGST Amount,SGST Amount,Total GST\n'
    gstReport.b2b.forEach(row => {
      csvContent += `"${row.gstin}","${row.customerName}","${row.billId}","${row.date}",${row.total.toFixed(2)},${row.taxable.toFixed(2)},${row.cgst.toFixed(2)},${row.sgst.toFixed(2)},${(row.cgst + row.sgst).toFixed(2)}\n`
    })

    csvContent += '\nHSN SUMMARY\n'
    csvContent += 'HSN Code,Total Quantity,Total Value,Taxable Value,Central Tax Amount,State/UT Tax Amount,Total Tax\n'
    gstReport.hsn.forEach(row => {
      csvContent += `"${row.hsn}",${row.qty},${row.total.toFixed(2)},${row.taxable.toFixed(2)},${row.cgst.toFixed(2)},${row.sgst.toFixed(2)},${(row.cgst + row.sgst).toFixed(2)}\n`
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `GSTR_1_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('GSTR-1 CSV exported successfully!', 'success')
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeBills = bills.filter((b) => !b.deleted && !b.isGroupParent)

    // Separate normal payments from refund payments
    const normalPayments = (payments || []).filter(p => !p.isRefund && p.paymentType !== 'refund' && Number(p.totalPaid || 0) >= 0)
    const refundPaymentsList = (payments || []).filter(p => p.isRefund || p.paymentType === 'refund' || Number(p.totalPaid || 0) < 0)

    // Net Revenue = sum of total on active bills
    // (We use b.total so it represents invoiced revenue, matching Dashboard logic)
    const realizedRevenue = activeBills.reduce((s, b) => s + Number(b.total || 0), 0)

    // Total refund outflow
    const totalRefundOutflow = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.totalPaid || 0)), 0)

    const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)

    // Net Profit = Net Revenue - Total Expenses
    const netProfit = realizedRevenue - totalExpenses
    
    const totalCustomerAdvance = customers
      .filter((c) => !c.deleted)
      .reduce((sum, c) => sum + Number(c.advanceBalance || c.creditBalance || 0), 0)

    // Cash inflow from payments (exclude FIFO advance transfers)
    const deletedBillIds = new Set((bills || []).filter(b => b.deleted).map(b => String(b.id)))
    const pInflow = (payments || [])
      .filter((p) => !p.isRefund && p.paymentType !== 'refund' 
        && !p.notes?.includes('from advance deposit') 
        && !p.notes?.includes('FIFO payment')
        && !deletedBillIds.has(String(p.billId))
        && (Number(p.cashAmount || 0) + Number(p.upiAmount || 0)) > 0)
      .reduce((sum, p) => sum + Number(p.cashAmount || 0) + Number(p.upiAmount || 0), 0)
      
    // Advance inflow EXCLUDING refund-credit advance deposits, advance returns, excess payments (already in pInflow), and opening balance
    const advInflow = (advancePayments || [])
      .filter(ap => !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening') && Number(ap.amount || 0) > 0)
      .reduce((sum, ap) => {
        const cash = Number(ap.cashAmount || 0)
        const upi = Number(ap.upiAmount || 0)
        return sum + (cash + upi > 0 ? cash + upi : Number(ap.amount || 0))
      }, 0)
      
    const totalCashInflow = pInflow + advInflow

    // Net Cash Flow = Total Inflow - Expenses - Refunds
    const netCashFlow = totalCashInflow - totalExpenses - totalRefundOutflow
    const pendingReceivables = activeBills
      .filter((b) => b.status !== 'paid')
      .reduce((s, b) => s + Number(b.balance || 0), 0)

    // Cash/UPI collected from NORMAL payments only (not refunds)
    const cashFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const upiFromNormalPayments = normalPayments.reduce((s, p) => s + Number(p.upiAmount || 0), 0)
    // Cash/UPI refunded out
    const cashRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.cashAmount || 0)), 0)
    const upiRefunded = refundPaymentsList.reduce((s, p) => s + Math.abs(Number(p.upiAmount || 0)), 0)
    // Net cash/UPI collected (gross - refunds)
    const validAdvances = (advancePayments || []).filter(ap => Number(ap.amount || 0) > 0 && !ap.isRefundCredit && !ap.isReturn && !ap.isExcessCredit && !ap.notes?.toLowerCase().includes('excess') && !ap.notes?.toLowerCase().includes('opening'))
    const cashFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const upiFromAdvances = validAdvances.reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)
    const cashCollected = cashFromNormalPayments + cashFromAdvances  // gross cash received
    const upiCollected = upiFromNormalPayments + upiFromAdvances      // gross UPI received

    // Cash/UPI from expenses
    const cashSpent = (expenses || []).reduce((s, e) => s + Number(e.cashAmount || 0), 0)
    const upiSpent = (expenses || []).reduce((s, e) => s + Number(e.upiAmount || 0), 0)

    return {
      realizedRevenue, totalExpenses, netCashFlow, pendingReceivables,
      cashCollected, upiCollected, cashSpent, upiSpent,
      totalCustomerAdvance, totalCashInflow,
      netProfit, totalRefundOutflow, cashRefunded, upiRefunded
    }
  }, [bills, payments, expenses, advancePayments, customers])

  const refundStats = useMemo(() => {
    // 1. Bill Refunds (negative payments)
    const billRefundsList = payments.filter((p) => p.totalPaid < 0 || p.isRefund)
    const billRefundsTotal = billRefundsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const billRefundsCash = billRefundsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const billRefundsUpi = billRefundsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // 2. Payment Deletions (deleted payments)
    const delPaymentsList = deletedPayments || []
    const delPaymentsTotal = delPaymentsList.reduce((s, p) => s + Number(p.totalPaid || 0), 0)
    const delPaymentsCash = delPaymentsList.reduce((s, p) => s + Number(p.cashAmount || 0), 0)
    const delPaymentsUpi = delPaymentsList.reduce((s, p) => s + Number(p.upiAmount || 0), 0)

    // 3. Advance Returns (negative advance payments)
    const advReturnsList = (advancePayments || []).filter((ap) => ap.amount < 0 || ap.isReturn)
    const advReturnsTotal = advReturnsList.reduce((s, ap) => s + Number(ap.amount || 0), 0)
    const advReturnsCash = advReturnsList.reduce((s, ap) => s + Number(ap.cashAmount || 0), 0)
    const advReturnsUpi = advReturnsList.reduce((s, ap) => s + Number(ap.upiAmount || 0), 0)

    return {
      billRefundsTotal: Math.abs(billRefundsTotal),
      billRefundsCash: Math.abs(billRefundsCash),
      billRefundsUpi: Math.abs(billRefundsUpi),
      billRefundsList,

      delPaymentsTotal: Math.abs(delPaymentsTotal),
      delPaymentsCash: Math.abs(delPaymentsCash),
      delPaymentsUpi: Math.abs(delPaymentsUpi),
      delPaymentsList,

      advReturnsTotal: Math.abs(advReturnsTotal),
      advReturnsCash: Math.abs(advReturnsCash),
      advReturnsUpi: Math.abs(advReturnsUpi),
      advReturnsList,
    }
  }, [payments, deletedPayments, advancePayments])

  const refundLogs = useMemo(() => {
    const logs = []
    
    // Add bill refunds
    refundStats.billRefundsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Bill Refund',
        description: `Refund for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: r.notes || '',
      })
    })

    // Add deleted payments
    refundStats.delPaymentsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.deletedAt || r.date,
        type: 'Payment Deletion',
        description: `Deleted Payment for Bill #${r.billId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.totalPaid || 0),
        notes: `Deleted on ${new Date(r.deletedAt).toLocaleDateString()}`,
      })
    })

    // Add advance returns
    refundStats.advReturnsList.forEach(r => {
      logs.push({
        id: r.id,
        date: r.date,
        type: 'Advance Return',
        description: `Returned Advance to Customer #${r.customerId}`,
        cash: Math.abs(r.cashAmount || 0),
        upi: Math.abs(r.upiAmount || 0),
        total: Math.abs(r.amount || 0),
        notes: r.notes || '',
      })
    })

    // Sort by date descending
    return logs.sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [refundStats])

  // ── Expense form ──────────────────────────────────────────────────────────
  const handleExpenseChange = (field, value) => {
    setExpForm((f) => ({ ...f, [field]: value }))
    setExpError('')
  }

  const handleAddExpense = (e) => {
    e.preventDefault()
    const amount = Number(expForm.amount)
    const cash = Number(expForm.cashAmount || 0)
    const upi = Number(expForm.upiAmount || 0)

    if (!expForm.description.trim()) { setExpError('Description is required.'); return }
    if (!amount || amount <= 0) { setExpError('Enter a valid amount.'); return }
    if (Math.abs(cash + upi - amount) > 0.01) {
      setExpError(`Cash (₹${cash}) + UPI (₹${upi}) = ₹${(cash + upi).toFixed(2)} must equal Total ₹${amount.toFixed(2)}.`)
      return
    }

    addExpense({
      date: expForm.date || today,
      description: expForm.description.trim(),
      amount,
      cashAmount: cash,
      upiAmount: upi,
      receiptUrl: expForm.receiptUrl || '',
    })

    setExpForm({ date: today, description: '', amount: '', cashAmount: '', upiAmount: '', receiptUrl: '' })
    setExpSuccess(true)
    setTimeout(() => setExpSuccess(false), 3000)
  }

  const sortedExpenses = useMemo(() => {
    return [...(expenses || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [expenses])

  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      await syncFromCloud()
      showToast('Data synced successfully', 'success')
    } catch (e) {
      showToast('Failed to sync data', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  // Appended Features logic
  const totalInflow = stats.cashCollected + stats.upiCollected
    const cashPercent = totalInflow > 0 ? ((stats.cashCollected / totalInflow) * 100).toFixed(1) : 0
    const upiPercent = totalInflow > 0 ? ((stats.upiCollected / totalInflow) * 100).toFixed(1) : 0
    const taxLiability = (stats.realizedRevenue * 0.18).toFixed(2)

    return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Accounting</h1>
          <p>Track revenue, expenses, cash flow, and cash vs UPI breakdowns.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleSync} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* Tabs bar */}
      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', marginBottom: '24px', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === 'general' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'general' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'general' ? 700 : 500,
            padding: '8px 16px', cursor: 'pointer', fontSize: '0.95rem'
          }}
        >
          General Ledger & Expenses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gst')}
          style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === 'gst' ? '3px solid var(--accent)' : 'none',
            color: activeTab === 'gst' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'gst' ? 700 : 500,
            padding: '8px 16px', cursor: 'pointer', fontSize: '0.95rem'
          }}
        >
          GST Tax Filings (GSTR-1 / GSTR-3B)
        </button>
      </div>

      {activeTab === 'general' ? (
        <>
          {/* Summary stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success"><DollarSign /></div>
                <div>
                  <div className="stat-card-label">Net Revenue</div>
                  <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{stats.realizedRevenue.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Total collected (after refunds).</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><TrendingDown /></div>
                <div>
                  <div className="stat-card-label">Refund Outflows</div>
                  <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₹{stats.totalRefundOutflow.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Already deducted from Net Revenue.</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}><DollarSign /></div>
                <div>
                  <div className="stat-card-label">Total Advance Balance</div>
                  <div className="stat-card-value" style={{ color: 'var(--info)' }}>₹{stats.totalCustomerAdvance.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Current customer credits.</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}><TrendingUp /></div>
                <div>
                  <div className="stat-card-label">Total Cash Inflow</div>
                  <div className="stat-card-value" style={{ color: 'var(--success)' }}>₹{stats.totalCashInflow.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Net cash received (refund credits excluded).</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon error"><TrendingDown /></div>
                <div>
                  <div className="stat-card-label">Total Expenses</div>
                  <div className="stat-card-value" style={{ color: 'var(--error)' }}>₹{stats.totalExpenses.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Total amount spent on expenses.</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className={`stat-card-icon ${stats.netProfit >= 0 ? 'success' : 'error'}`}>
                  {stats.netProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
                </div>
                <div>
                  <div className="stat-card-label">Net Profit</div>
                  <div className="stat-card-value" style={{ color: stats.netProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    ₹{stats.netProfit.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="stat-card-sub">Revenue minus Expenses.</div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon success" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><Calculator /></div>
                <div>
                  <div className="stat-card-label">Pending Receivables</div>
                  <div className="stat-card-value" style={{ color: 'var(--warning)' }}>₹{stats.pendingReceivables.toFixed(2)}</div>
                </div>
              </div>
              <div className="stat-card-sub">Outstanding from open bills.</div>
            </div>
          </div>

          {/* Cash vs UPI breakdown */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px' }}>Cash vs UPI Breakdown</h2>
            <div className="grid-2" style={{ gap: '16px' }}>
              <div>
                <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Collected (Gross from Customers)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Collected</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>₹{stats.cashCollected.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Collected</span>
                    <span style={{ fontWeight: 700, color: 'var(--info)' }}>₹{stats.upiCollected.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Refunded Out</span>
                    <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.cashRefunded.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Refunded Out</span>
                    <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.upiRefunded.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Spent (Expenses)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Banknote size={16} /> Cash Spent</span>
                    <span style={{ fontWeight: 700, color: 'var(--error)' }}>₹{stats.cashSpent.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Smartphone size={16} /> UPI Spent</span>
                    <span style={{ fontWeight: 700, color: 'var(--warning)' }}>₹{stats.upiSpent.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Refunds & Reversals Summary */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px' }}>Refunds & Reversals Summary</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', border: 'none', padding: 0 }}>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bill Refunds</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>₹{refundStats.billRefundsTotal.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Cash: ₹{refundStats.billRefundsCash.toFixed(2)}</span>
                  <span>UPI: ₹{refundStats.billRefundsUpi.toFixed(2)}</span>
                </div>
              </div>
              
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Payment Deletions</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--error)' }}>₹{refundStats.delPaymentsTotal.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Cash: ₹{refundStats.delPaymentsCash.toFixed(2)}</span>
                  <span>UPI: ₹{refundStats.delPaymentsUpi.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Advance Returns</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>₹{refundStats.advReturnsTotal.toFixed(2)}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Cash: ₹{refundStats.advReturnsCash.toFixed(2)}</span>
                  <span>UPI: ₹{refundStats.advReturnsUpi.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <PeriodReport />

          {/* Add Expense */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ marginBottom: '16px' }}>Add Expense</h2>
            <form onSubmit={handleAddExpense} autoComplete="off">
              <div className="grid-2" style={{ gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={expForm.date} onChange={(e) => handleExpenseChange('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Item / Description</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Printer ink purchase, electricity bill"
                    value={expForm.description}
                    onChange={(e) => handleExpenseChange('description', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-3" style={{ gap: '16px', marginTop: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Total Amount (₹) <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input
                    className="form-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={expForm.amount}
                    onChange={(e) => handleExpenseChange('amount', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cash Paid (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={expForm.cashAmount}
                    onChange={(e) => handleExpenseChange('cashAmount', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">UPI Paid (₹)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={expForm.upiAmount}
                    onChange={(e) => handleExpenseChange('upiAmount', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Receipt Image / URL Link</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. https://invoice-link.com or Google Drive image URL"
                  value={expForm.receiptUrl || ''}
                  onChange={(e) => handleExpenseChange('receiptUrl', e.target.value)}
                />
              </div>

              {expError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '12px',
                  background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: '0.875rem'
                }}>
                  <AlertCircle size={16} /> {expError}
                </div>
              )}

              {expSuccess && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', marginBottom: '12px',
                  background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.875rem'
                }}>
                  <CheckCircle size={16} /> Expense saved successfully.
                </div>
              )}

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Cash + UPI must equal total amount.
              </p>
              <button type="submit" className="btn btn-primary">
                <Plus size={16} /> Save Expense
              </button>
            </form>
          </div>

          {/* Expense Log */}
          <div className="card">
            <h2 style={{ marginBottom: '16px' }}>Expense Log ({sortedExpenses.length})</h2>
            {sortedExpenses.length === 0 ? (
              <EmptyState
                Icon={TrendingDown}
                title="No expenses recorded"
                description="You haven't logged any business expenses yet. Use the form above to add your first expense."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Expense ID</th>
                      <th>Item / Description</th>
                      <th>Total</th>
                      <th>Cash</th>
                      <th>UPI</th>
                      <th style={{ width: '80px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.date}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{exp.id}</td>
                        <td>{exp.description}</td>
                        <td style={{ fontWeight: 600, color: 'var(--error)' }}>₹{Number(exp.amount).toFixed(2)}</td>
                        <td>₹{Number(exp.cashAmount || 0).toFixed(2)}</td>
                        <td>₹{Number(exp.upiAmount || 0).toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {exp.receiptUrl && (
                              <a
                                href={exp.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--info)', padding: '4px', display: 'inline-flex', alignItems: 'center' }}
                                title="View Receipt Link"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--error)' }}
                              onClick={() => {
                                if (window.confirm(`Delete expense "${exp.description}"?`)) deleteExpense(exp.id)
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Refund & Reversal Log */}
          <div className="card" style={{ marginTop: '24px' }}>
            <h2 style={{ marginBottom: '16px' }}>Refund & Reversal Log ({refundLogs.length})</h2>
            {refundLogs.length === 0 ? (
              <EmptyState
                Icon={AlertCircle}
                title="No refund transactions recorded"
                description="All bill reversals and credit notes will appear here."
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref/Trans ID</th>
                      <th>Customer Name</th>
                      <th>Type</th>
                      <th>Total Outflow</th>
                      <th>Cash Out</th>
                      <th>UPI Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundLogs.map((p) => (
                      <tr key={p.id}>
                        <td>{p.date}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.id}</td>
                        <td>{p.customerName}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: p.type === 'REFUND' ? 'rgba(245,158,11,0.12)' : p.type === 'DELETED_PAY' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                            color: p.type === 'REFUND' ? 'var(--warning)' : p.type === 'DELETED_PAY' ? 'var(--error)' : 'var(--info)',
                            textTransform: 'uppercase'
                          }}>
                            {p.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--error)' }}>₹{Math.abs(Number(p.amount || 0)).toFixed(2)}</td>
                        <td>₹{Math.abs(Number(p.cashAmount || 0)).toFixed(2)}</td>
                        <td>₹{Math.abs(Number(p.upiAmount || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Grid for Cash/UPI ratio and Tax liability */}
          <div className="grid-2" style={{ gap: '24px', marginTop: '24px' }}>
            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Percent size={18} /> Inflow Ratio (Cash vs UPI)
              </h3>
              <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span><Banknote size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }}/> Cash: {cashPercent}%</span>
                <span><Smartphone size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }}/> UPI: {upiPercent}%</span>
              </div>
              <div style={{ height: '12px', background: 'var(--border)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${cashPercent}%`, background: 'var(--success)', transition: 'width 0.5s' }} />
                <div style={{ width: `${upiPercent}%`, background: 'var(--accent)', transition: 'width 0.5s' }} />
              </div>
              <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Based on total inflows collected in the selected period.</p>
            </div>

            <div className="card">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Calculator size={18} /> Estimated Tax Liability
              </h3>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)', marginBottom: '8px' }}>
                ₹{taxLiability}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated GST (18%) based on realized revenue (₹{stats.realizedRevenue.toFixed(2)}) for the selected period.</p>
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary stats */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>GST Report Summary</h2>
                <p className="text-muted">Calculated tax brackets for active invoices in this period</p>
              </div>
              <button className="btn btn-primary" onClick={exportGSTR1CSV}>
                Export GSTR-1 CSV
              </button>
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', marginTop: '20px', border: 'none', padding: 0 }}>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total GST Collected</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>₹{gstReport.totalGST.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CGST (Central Tax)</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>₹{gstReport.totalCGST.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SGST (State Tax)</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--info)' }}>₹{gstReport.totalSGST.toFixed(2)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Taxable Turnover</h4>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{gstReport.totalTaxable.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Tax Rates Summary Table */}
          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>Tax Rates Breakdown</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>GST Bracket</th>
                    <th>Taxable Turnover</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>Total GST</th>
                  </tr>
                </thead>
                <tbody>
                  {gstReport.rates.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No taxable sales recorded in this period.</td></tr>
                  ) : (
                    gstReport.rates.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.rate}% GST</td>
                        <td>₹{r.taxable.toFixed(2)}</td>
                        <td>₹{r.cgst.toFixed(2)}</td>
                        <td>₹{r.sgst.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>₹{(r.cgst + r.sgst).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HSN Code Summary Table */}
          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>HSN Code Summary (GSTR-1 HSN Section)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>HSN Code</th>
                    <th>Total Qty</th>
                    <th>Taxable Turnover</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>Total GST</th>
                  </tr>
                </thead>
                <tbody>
                  {gstReport.hsn.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No HSN code activity recorded.</td></tr>
                  ) : (
                    gstReport.hsn.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{h.hsn}</td>
                        <td>{h.qty}</td>
                        <td>₹{h.taxable.toFixed(2)}</td>
                        <td>₹{h.cgst.toFixed(2)}</td>
                        <td>₹{h.sgst.toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>₹{(h.cgst + h.sgst).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* B2B Transactions Table */}
          <div className="card">
            <h3 style={{ marginBottom: '12px' }}>B2B Transactions Log (Customers with GSTIN)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Date</th>
                    <th>Recipient Name</th>
                    <th>Recipient GSTIN</th>
                    <th>Taxable Value</th>
                    <th>CGST</th>
                    <th>SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {gstReport.b2b.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No B2B sales registered in this period.</td></tr>
                  ) : (
                    gstReport.b2b.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{row.billId}</td>
                        <td>{row.date}</td>
                        <td>{row.customerName}</td>
                        <td style={{ fontFamily: 'monospace' }}>{row.gstin}</td>
                        <td>₹{row.taxable.toFixed(2)}</td>
                        <td>₹{row.cgst.toFixed(2)}</td>
                        <td>₹{row.sgst.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Accounting
