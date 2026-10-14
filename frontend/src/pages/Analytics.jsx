import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  TrendingUp,
  Package,
  Users,
  Layers,
  Banknote,
  Smartphone,
  ArrowUpDown,
  ChevronRight,
  BarChart3,
  X,
  FileSpreadsheet,
  Download,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieChartIcon,
  RefreshCw,
  Percent
} from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import '../utils/chartSetup'
import { useAppContext } from '../context/AppContext'
import {
  getProductAnalytics,
  getProductCustomerBreakdown,
  getProductTrends,
  getAnalyticsSummary,
  getExpensesByVendor,
  getExpensesByCategory,
  getTaxGstAnalytics,
  getCustomerInsights,
  getPaymentBreakdown
} from '../api/analytics'
import { exportToCSV } from '../utils/csvExport'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const PERIODS = [
  { id: 'daily', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'yearly', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
  { id: 'all', label: 'All Time' },
]

const getPeriodRange = (period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'daily') {
    const dStr = today.toISOString().slice(0, 10)
    return { startDate: dStr, endDate: dStr }
  }
  if (period === 'yesterday') {
    const yest = new Date(today)
    yest.setDate(today.getDate() - 1)
    const yStr = yest.toISOString().slice(0, 10)
    return { startDate: yStr, endDate: yStr }
  }
  if (period === 'weekly') {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { startDate: mon.toISOString().slice(0, 10), endDate: sun.toISOString().slice(0, 10) }
  }
  if (period === 'monthly') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    const first = new Date(now.getFullYear(), q * 3, 1)
    const last = new Date(now.getFullYear(), q * 3 + 3, 0)
    return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) }
  }
  if (period === 'yearly') {
    const first = new Date(now.getFullYear(), 0, 1)
    const last = new Date(now.getFullYear(), 11, 31)
    return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) }
  }
  return { startDate: '', endDate: '' }
}

const Analytics = () => {
  const { bills, payments, expenses } = useAppContext()
  const reportRef = useRef(null)

  // 5 Active Tabs
  const [activeTab, setActiveTab] = useState('products') // 'products' | 'financials' | 'customers' | 'tax' | 'expenses'
  const [period, setPeriod] = useState('monthly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [isOfflineCached, setIsOfflineCached] = useState(false)

  // Server-side loaded data
  const [summaryData, setSummaryData] = useState(null)
  const [productsData, setProductsData] = useState([])
  const [grandTotalRev, setGrandTotalRev] = useState(0)
  const [revenueTrends, setRevenueTrends] = useState([])
  const [vendorsData, setVendorsData] = useState([])
  const [categoriesData, setCategoriesData] = useState([])
  const [grandTotalExpenses, setGrandTotalExpenses] = useState(0)
  const [taxData, setTaxData] = useState(null)
  const [customerInsights, setCustomerInsights] = useState(null)
  const [paymentBreakdown, setPaymentBreakdown] = useState(null)

  // Product Drilldown state
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productCustomers, setProductCustomers] = useState([])
  const [productTrendList, setProductTrendList] = useState([])
  const [drilldownLoading, setDrilldownLoading] = useState(false)

  // Product sorting
  const [sortField, setSortField] = useState('total_revenue')
  const [sortAsc, setSortAsc] = useState(false)

  // Date range calculation
  const dateParams = useMemo(() => {
    if (period === 'custom') {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    return getPeriodRange(period)
  }, [period, customStartDate, customEndDate])

  // Fetch all analytics from server with fallback and localStorage cache
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (dateParams.startDate) params.startDate = dateParams.startDate
      if (dateParams.endDate) params.endDate = dateParams.endDate

      // Offline detection check
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cacheRaw = localStorage.getItem('printpro-analytics-cache')
        if (cacheRaw) {
          const cached = JSON.parse(cacheRaw)
          setSummaryData(cached.summaryData)
          setProductsData(cached.productsData || [])
          setGrandTotalRev(cached.grandTotalRev || 0)
          setRevenueTrends(cached.revenueTrends || [])
          setVendorsData(cached.vendorsData || [])
          setCategoriesData(cached.categoriesData || [])
          setGrandTotalExpenses(cached.grandTotalExpenses || 0)
          setTaxData(cached.taxData)
          setCustomerInsights(cached.customerInsights)
          setPaymentBreakdown(cached.paymentBreakdown)
          setIsOfflineCached(true)
          setLoading(false)
          return
        }
      }

      const [sumRes, prodRes, trendRes, vendorRes, catRes, taxRes, custRes, payRes] = await Promise.all([
        getAnalyticsSummary(params).catch(() => ({ data: { data: null } })),
        getProductAnalytics(params).catch(() => ({ data: { data: null } })),
        getProductTrends({ ...params, period: period === 'daily' ? 'daily' : 'monthly' }).catch(() => ({ data: { data: [] } })),
        getExpensesByVendor(params).catch(() => ({ data: { data: { vendors: [], grand_total_expenses: 0 } } })),
        getExpensesByCategory(params).catch(() => ({ data: { data: { categories: [], grand_total_expenses: 0 } } })),
        getTaxGstAnalytics(params).catch(() => ({ data: { data: null } })),
        getCustomerInsights(params).catch(() => ({ data: { data: null } })),
        getPaymentBreakdown(params).catch(() => ({ data: { data: null } }))
      ])

      let summary = sumRes.data.data
      let products = prodRes.data.data?.products || []
      let grandRevenue = prodRes.data.data?.grand_total_revenue || 0
      let fetchedTax = taxRes.data.data
      let fetchedCust = custRes.data.data
      let fetchedPay = payRes.data.data

      // Fallback: If server summary is null, compute client-side metrics from local AppContext state
      if (!summary && bills && bills.length > 0) {
        const nonDeletedBills = bills.filter(b => !b.deleted)
        const totalRev = nonDeletedBills.reduce((s, b) => s + (Number(b.total) || 0), 0)
        const totalPaid = nonDeletedBills.reduce((s, b) => s + (Number(b.amountPaid) || 0), 0)
        const totalDue = nonDeletedBills.reduce((s, b) => s + (Number(b.balanceDue) || 0), 0)
        const uniqueCusts = new Set(nonDeletedBills.map(b => b.customerId || b.customerName).filter(Boolean)).size

        const cashRev = (payments || []).reduce((s, p) => s + (Number(p.cashAmount) || 0), 0)
        const upiRev = (payments || []).reduce((s, p) => s + (Number(p.upiAmount) || 0), 0)
        const expTotal = (expenses || []).reduce((s, e) => s + (Number(e.amount || e.total) || 0), 0)

        summary = {
          total_revenue: totalRev,
          total_collected: totalPaid,
          total_due: totalDue,
          cash_revenue: cashRev,
          upi_revenue: upiRev,
          total_refunds: 0,
          total_expenses: expTotal,
          net_profit: totalRev - expTotal,
          bill_count: nonDeletedBills.length,
          unique_customers: uniqueCusts,
          average_bill_value: nonDeletedBills.length > 0 ? totalRev / nonDeletedBills.length : 0
        }

        if (!fetchedPay) {
          const totCollected = cashRev + upiRev
          fetchedPay = {
            total_collected: totCollected,
            net_collected: totCollected,
            cash_collected: cashRev,
            upi_collected: upiRev,
            total_refunds: 0,
            cash_percentage: totCollected > 0 ? (cashRev / totCollected) * 100 : 0,
            upi_percentage: totCollected > 0 ? (upiRev / totCollected) * 100 : 0,
            total_transactions: (payments || []).length
          }
        }
      }

      setSummaryData(summary)
      setProductsData(products)
      setGrandTotalRev(grandRevenue)
      setRevenueTrends(trendRes.data.data || [])
      setVendorsData(vendorRes.data.data?.vendors || [])
      setCategoriesData(catRes.data.data?.categories || [])
      setGrandTotalExpenses(vendorRes.data.data?.grand_total_expenses || 0)
      setTaxData(fetchedTax)
      setCustomerInsights(fetchedCust)
      setPaymentBreakdown(fetchedPay)
      setIsOfflineCached(false)

      // Save to localStorage snapshot
      try {
        localStorage.setItem('printpro-analytics-cache', JSON.stringify({
          summaryData: summary,
          productsData: products,
          grandTotalRev: grandRevenue,
          revenueTrends: trendRes.data.data || [],
          vendorsData: vendorRes.data.data?.vendors || [],
          categoriesData: catRes.data.data?.categories || [],
          grandTotalExpenses: vendorRes.data.data?.grand_total_expenses || 0,
          taxData: fetchedTax,
          customerInsights: fetchedCust,
          paymentBreakdown: fetchedPay,
          cachedAt: new Date().toISOString()
        }))
      } catch {
        // quota limit fallback
      }
    } catch (err) {
      console.warn('Analytics loading fallback engaged:', err)
      setIsOfflineCached(true)
    } finally {
      setLoading(false)
    }
  }, [dateParams, period, bills, payments, expenses])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Handle drilldown on product click
  const handleSelectProduct = async (prod) => {
    if (selectedProduct?.item_name === prod.item_name && selectedProduct?.print_type === prod.print_type && selectedProduct?.sides === prod.sides) {
      setSelectedProduct(null)
      return
    }

    setSelectedProduct(prod)
    try {
      setDrilldownLoading(true)
      const params = {}
      if (dateParams.startDate) params.startDate = dateParams.startDate
      if (dateParams.endDate) params.endDate = dateParams.endDate

      const [custRes, trendRes] = await Promise.all([
        getProductCustomerBreakdown(prod.item_name, params),
        getProductTrends({ itemName: prod.item_name, period: 'monthly' })
      ])

      setProductCustomers(custRes.data.data || [])
      setProductTrendList(trendRes.data.data || [])
    } catch (err) {
      console.error('Error fetching product drilldown:', err)
    } finally {
      setDrilldownLoading(false)
    }
  }

  // Sorted products
  const sortedProducts = useMemo(() => {
    return [...productsData].sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA)
    })
  }, [productsData, sortField, sortAsc])

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(false)
    }
  }

  // PDF Export Generation
  const handleDownloadPdf = async () => {
    if (!reportRef.current) return
    try {
      setExportingPdf(true)
      const element = reportRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a'
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      })

      const imgWidth = 595.28
      const pageHeight = 841.89
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`PrintPro-Analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('PDF generation error:', err)
      alert('Unable to generate PDF report. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }

  // CSV Export for active view
  const handleExportCSV = () => {
    if (activeTab === 'products') {
      const rows = sortedProducts.map(p => [
        p.item_name,
        p.print_type || '-',
        p.sides || '-',
        p.total_qty,
        p.total_revenue,
        p.avg_unit_price,
        p.bill_count,
        `${p.percentage_of_total}%`
      ])
      exportToCSV(`Products_Sales_${period}`, rows, ['Item Name', 'Print Type', 'Sides', 'Qty Sold', 'Total Revenue (INR)', 'Avg Unit Price', 'Bills Count', '% of Total Sales'])
    } else if (activeTab === 'financials') {
      const rows = revenueTrends.map(r => [
        r.period_label,
        r.revenue,
        r.qty,
        r.bill_count
      ])
      exportToCSV(`Financial_Trends_${period}`, rows, ['Period', 'Revenue (INR)', 'Total Qty', 'Bill Count'])
    } else if (activeTab === 'customers') {
      const rows = (customerInsights?.customers || []).map(c => [
        c.customer_name,
        c.customer_phone || '-',
        c.ltv,
        c.total_bills,
        c.average_basket,
        c.current_due,
        c.status,
        c.days_since_last_purchase
      ])
      exportToCSV(`Customer_Insights_${period}`, rows, ['Customer Name', 'Phone', 'Lifetime Value (LTV)', 'Total Bills', 'Avg Order Value', 'Current Balance Due', 'Status', 'Days Since Last Order'])
    } else if (activeTab === 'tax') {
      const rows = (taxData?.rates || []).map(r => [
        `${r.rate}%`,
        r.bill_count,
        r.taxable_amount,
        r.gst_collected,
        r.total_amount
      ])
      exportToCSV(`GST_Tax_Report_${period}`, rows, ['GST Rate', 'Invoices', 'Taxable Amount (INR)', 'GST Collected (INR)', 'Gross Total (INR)'])
    } else if (activeTab === 'expenses') {
      const rows = vendorsData.map(v => [
        v.vendor_name,
        v.total_spent,
        v.purchase_count,
        v.cash_spent,
        v.upi_spent,
        `${v.percentage_of_total}%`
      ])
      exportToCSV(`Vendor_Expenses_${period}`, rows, ['Vendor Name', 'Total Spent (INR)', 'Purchases Count', 'Cash Paid', 'UPI Paid', '% Share'])
    }
  }

  // Chart Data Configurations
  const trendChartData = useMemo(() => {
    const labels = revenueTrends.map(t => t.period_label)
    const revenues = revenueTrends.map(t => t.revenue)
    return {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Revenue (₹)',
          data: revenues,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
        }
      ]
    }
  }, [revenueTrends])

  const topProductsChartData = useMemo(() => {
    const top5 = [...productsData].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5)
    return {
      labels: top5.map(p => p.item_name.length > 14 ? p.item_name.slice(0, 14) + '...' : p.item_name),
      datasets: [
        {
          label: 'Revenue (₹)',
          data: top5.map(p => p.total_revenue),
          backgroundColor: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
          borderRadius: 6
        }
      ]
    }
  }, [productsData])

  const paymentDonutData = useMemo(() => {
    const cash = paymentBreakdown?.cash_collected || summaryData?.cash_revenue || 0
    const upi = paymentBreakdown?.upi_collected || summaryData?.upi_revenue || 0
    return {
      labels: ['Cash', 'UPI'],
      datasets: [
        {
          data: [cash, upi],
          backgroundColor: ['#10b981', '#3b82f6'],
          borderWidth: 2,
          borderColor: '#1e293b'
        }
      ]
    }
  }, [paymentBreakdown, summaryData])

  const expenseCategoryDonutData = useMemo(() => {
    const topCats = categoriesData.slice(0, 5)
    return {
      labels: topCats.map(c => c.category),
      datasets: [
        {
          data: topCats.map(c => c.total_spent),
          backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981'],
          borderWidth: 2,
          borderColor: '#1e293b'
        }
      ]
    }
  }, [categoriesData])

  return (
    <div className="analytics-page" ref={reportRef} style={{ paddingBottom: '30px' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <TrendingUp className="text-accent" size={28} />
              Business Intelligence & Analytics
            </h1>
            {isOfflineCached && (
              <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} /> Offline Snapshot
              </span>
            )}
          </div>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Real-time sales breakdown, customer lifetime value, GST liability, and payment settlements.
          </p>
        </div>

        {/* Global Export & Action Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchAnalytics}
            title="Reload Analytics"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileSpreadsheet size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} /> {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="form-control"
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="text-muted">to</span>
              <input
                type="date"
                className="form-control"
                style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary KPI Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Gross Revenue</div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            ₹{(summaryData?.total_revenue || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            <span className="font-mono">{summaryData?.bill_count || 0}</span> invoices generated
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Banknote size={14} /> Cash Collected
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
            ₹{(summaryData?.cash_revenue || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {paymentBreakdown?.cash_tx_count || 0} cash receipts
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Smartphone size={14} /> UPI Collected
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#3b82f6' }}>
            ₹{(summaryData?.upi_revenue || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {paymentBreakdown?.upi_tx_count || 0} digital payments
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f43f5e' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#f43f5e' }}>
            Expenses & Refunds
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f43f5e' }}>
            ₹{((summaryData?.total_expenses || 0) + (summaryData?.total_refunds || 0)).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            Outflow allocation
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--accent)' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: 'var(--accent)' }}>
            Net Profit (Margin)
          </div>
          <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent)' }}>
            ₹{(summaryData?.net_profit || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {summaryData?.total_revenue > 0 ? ((summaryData.net_profit / summaryData.total_revenue) * 100).toFixed(1) : 0}% margin
          </div>
        </div>
      </div>

      {/* Main 5 Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px', flexWrap: 'wrap', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px' }}
          onClick={() => setActiveTab('products')}
        >
          <Package size={15} /> Products & Sales ({productsData.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'financials' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px' }}
          onClick={() => setActiveTab('financials')}
        >
          <BarChart3 size={15} /> Financials & Cash/UPI
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'customers' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px' }}
          onClick={() => setActiveTab('customers')}
        >
          <Users size={15} /> Customer Insights (LTV & Churn)
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'tax' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px' }}
          onClick={() => setActiveTab('tax')}
        >
          <Receipt size={15} /> Tax & GST Breakdown
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px' }}
          onClick={() => setActiveTab('expenses')}
        >
          <Layers size={15} /> Expense & ROI ({vendorsData.length})
        </button>
      </div>

      {/* ── TAB 1: PRODUCTS & SALES ─────────────────────────────────────────── */}
      {activeTab === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedProduct ? '1.2fr 1fr' : '1fr', gap: '20px' }}>
          <div className="card">
            {/* Visual Mini Chart for Top 5 Products */}
            {productsData.length > 0 && (
              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={16} className="text-accent" /> Top 5 Revenue Contributing Products
                </h4>
                <div style={{ height: '180px' }}>
                  <Bar
                    data={topProductsChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false } },
                        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Product & Service Sales Performance</h3>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Click any item to view top buyers and monthly trend.
                </span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.95rem' }}>
                Total: ₹{grandTotalRev.toFixed(2)}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                Calculating product analytics...
              </div>
            ) : sortedProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                No product sales found for this date period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('item_name')}>
                        Item / Service <ArrowUpDown size={12} />
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('total_qty')}>
                        Qty Sold <ArrowUpDown size={12} />
                      </th>
                      <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('total_revenue')}>
                        Revenue (₹) <ArrowUpDown size={12} />
                      </th>
                      <th style={{ width: '130px', cursor: 'pointer' }} onClick={() => toggleSort('percentage_of_total')}>
                        % of Sales <ArrowUpDown size={12} />
                      </th>
                      <th style={{ textAlign: 'right' }}>Avg Price</th>
                      <th style={{ textAlign: 'right' }}>Bills</th>
                      <th style={{ width: '24px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((p, idx) => {
                      const isSelected = selectedProduct?.display_name === p.display_name
                      return (
                        <tr
                          key={idx}
                          onClick={() => handleSelectProduct(p)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent'
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <div>{p.item_name}</div>
                            {p.print_type && (
                              <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                                {p.print_type.toUpperCase()} • {p.sides === 'double' ? '2-Sided' : '1-Sided'}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {p.total_qty.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ₹{p.total_revenue.toFixed(2)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(p.percentage_of_total, 2)}%`, height: '100%', background: 'var(--accent)' }} />
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8', width: '38px', textAlign: 'right' }}>
                                {p.percentage_of_total.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                            ₹{p.avg_unit_price.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                            {p.bill_count}
                          </td>
                          <td>
                            <ChevronRight size={14} style={{ opacity: isSelected ? 1 : 0.4 }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Drilldown Panel */}
          {selectedProduct && (
            <div className="card" style={{ border: '1px solid rgba(99, 102, 241, 0.4)', background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Drilldown</div>
                  <h3 style={{ margin: '2px 0 0 0', color: 'var(--accent)' }}>{selectedProduct.display_name}</h3>
                </div>
                <button className="btn-icon" onClick={() => setSelectedProduct(null)}>
                  <X size={16} />
                </button>
              </div>

              {drilldownLoading ? (
                <div style={{ textAlign: 'center', padding: '30px' }} className="text-muted">
                  Loading customer details & trends...
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Total Qty</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedProduct.total_qty}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Revenue</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981' }}>₹{selectedProduct.total_revenue.toFixed(0)}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>Market Share</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}>{selectedProduct.percentage_of_total.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.88rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} className="text-accent" /> Top Customers for this Item
                    </h4>
                    {productCustomers.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: '0.82rem' }}>No individual customer purchase records found.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Customer</th>
                              <th style={{ textAlign: 'right' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Spent</th>
                              <th style={{ textAlign: 'right' }}>Orders</th>
                            </tr>
                          </thead>
                          <tbody>
                            {productCustomers.map((c, i) => (
                              <tr key={i}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                                  {c.customer_phone && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{c.customer_phone}</div>}
                                </td>
                                <td style={{ textAlign: 'right' }}>{c.total_qty}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>₹{c.total_spent.toFixed(2)}</td>
                                <td style={{ textAlign: 'right' }}>{c.order_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Monthly Trend for Item */}
                  <div>
                    <h4 style={{ fontSize: '0.88rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BarChart3 size={14} className="text-accent" /> Monthly Trend
                    </h4>
                    {productTrendList.length === 0 ? (
                      <div className="text-muted" style={{ fontSize: '0.82rem' }}>No historical trend points available.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {productTrendList.map((t) => {
                          const maxRev = Math.max(...productTrendList.map(x => x.revenue), 1)
                          const pct = (t.revenue / maxRev) * 100

                          return (
                            <div key={t.period_key}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                                <span>{t.period_label}</span>
                                <span style={{ fontWeight: 600 }}>₹{t.revenue.toFixed(0)} ({t.qty} units)</span>
                              </div>
                              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.max(pct, 3)}%`, height: '100%', background: 'var(--accent)' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── TAB 2: FINANCIALS & CASH/UPI BREAKDOWN ────────────────────────────── */}
      {activeTab === 'financials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Revenue Over Time Chart */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} className="text-accent" /> Revenue Over Time Trend
            </h3>
            {revenueTrends.length === 0 ? (
              <div className="text-muted" style={{ padding: '36px', textAlign: 'center' }}>No revenue trend data available.</div>
            ) : (
              <div style={{ height: '260px' }}>
                <Line
                  data={trendChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Payment Method Donut & Ratio */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChartIcon size={18} className="text-accent" /> Payment Mode Distribution
            </h3>
            {((paymentBreakdown?.cash_collected || summaryData?.cash_revenue || 0) === 0 &&
              (paymentBreakdown?.upi_collected || summaryData?.upi_revenue || 0) === 0) ? (
              <div className="text-muted" style={{ padding: '36px', textAlign: 'center' }}>
                No payment collection records available for this period.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                <div style={{ height: '200px' }}>
                  <Doughnut
                    data={paymentDonutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom' } },
                      cutout: '70%'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '6px', borderLeft: '3px solid #10b981' }}>
                    <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Cash Share</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {paymentBreakdown?.cash_percentage || 0}%
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>₹{(summaryData?.cash_revenue || 0).toFixed(2)}</div>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', borderLeft: '3px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>UPI Share</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      {paymentBreakdown?.upi_percentage || 0}%
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>₹{(summaryData?.upi_revenue || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: CUSTOMER INSIGHTS (LTV & CHURN) ─────────────────────────── */}
      {activeTab === 'customers' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Customer Insights KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Analyzed Customers</div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                {customerInsights?.summary?.total_customers_analyzed || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Active Buyers (&lt; 60 days)
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
                {customerInsights?.summary?.active_customers || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={14} /> At-Risk Churn (&gt; 60 days)
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b' }}>
                {customerInsights?.summary?.at_risk_customers || 0}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--accent)' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
                Average Customer LTV
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent)' }}>
                ₹{(customerInsights?.summary?.average_customer_ltv || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Customer LTV & Engagement Table */}
          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem' }}>Top Customer Lifetime Value (LTV) & Retention</h3>
            {(!customerInsights || !customerInsights.customers || customerInsights.customers.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                No customer engagement records found for this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th style={{ textAlign: 'right' }}>Total Orders</th>
                      <th style={{ textAlign: 'right' }}>Lifetime Value (₹)</th>
                      <th style={{ textAlign: 'right' }}>Avg Basket</th>
                      <th style={{ textAlign: 'right' }}>Current Balance Due</th>
                      <th style={{ textAlign: 'center' }}>Inactivity</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInsights.customers.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                        <td className="text-muted" style={{ fontSize: '0.8rem' }}>{c.customer_phone || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.total_bills}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                          ₹{c.ltv.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                          ₹{c.average_basket.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: c.current_due > 0 ? 'var(--error)' : '#94a3b8' }}>
                          ₹{c.current_due.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                          {c.days_since_last_purchase === 999 ? 'N/A' : `${c.days_since_last_purchase} days ago`}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="badge"
                            style={{
                              background: c.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: c.status === 'active' ? '#10b981' : '#f59e0b',
                              fontSize: '0.72rem'
                            }}
                          >
                            {c.status === 'active' ? 'ACTIVE' : 'AT RISK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: TAX & GST BREAKDOWN ───────────────────────────────────────── */}
      {activeTab === 'tax' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Tax KPI Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '16px' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>Taxable Sales Subtotal</div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
                ₹{(taxData?.total_subtotal || 0).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Percent size={14} /> Total GST Collected
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f59e0b' }}>
                ₹{(taxData?.total_gst || 0).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: '#3b82f6' }}>
                CGST (50% Split)
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#3b82f6' }}>
                ₹{(taxData?.cgst || 0).toFixed(2)}
              </div>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
              <div className="text-muted" style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>
                SGST (50% Split)
              </div>
              <div className="font-mono tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#8b5cf6' }}>
                ₹{(taxData?.sgst || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Rate-Wise Tax Summary Table */}
          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem' }}>GST Rate-Wise Breakdown</h3>
            {(!taxData || !taxData.rates || taxData.rates.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                No GST records found for this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th>GST Slab Rate</th>
                      <th style={{ textAlign: 'right' }}>Invoices</th>
                      <th style={{ textAlign: 'right' }}>Taxable Amount (₹)</th>
                      <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                      <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                      <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
                      <th style={{ textAlign: 'right' }}>Gross Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxData.rates.map((r, idx) => {
                      const cgstPart = (r.gst_collected / 2).toFixed(2)
                      const sgstPart = (r.gst_collected / 2).toFixed(2)
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.rate}% Slab</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.bill_count}</td>
                          <td style={{ textAlign: 'right' }}>₹{r.taxable_amount.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>₹{cgstPart}</td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>₹{sgstPart}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>₹{r.gst_collected.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{r.total_amount.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 5: EXPENSE & ROI ─────────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Expenses by Vendor */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Expenses by Vendor</h3>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Suppliers & procurement spend for this period.
                </span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.95rem' }}>
                Total: ₹{grandTotalExpenses.toFixed(2)}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                Loading vendor expense data...
              </div>
            ) : vendorsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                No vendor expenses recorded in this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th>Vendor / Supplier</th>
                      <th style={{ textAlign: 'right' }}>Total Spent (₹)</th>
                      <th style={{ width: '120px' }}>% of Total</th>
                      <th style={{ textAlign: 'right' }}>Entries</th>
                      <th style={{ textAlign: 'right' }}>Cash / UPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorsData.map((v, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{v.vendor_name}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--error)' }}>
                          ₹{Number(v.total_spent || v.total_expenses).toFixed(2)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(v.percentage_of_total, 2)}%`, height: '100%', background: 'var(--error)' }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', width: '38px', textAlign: 'right' }}>
                              {Number(v.percentage_of_total).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                          {v.purchase_count || v.expense_count}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span>C: ₹{Number(v.cash_spent || v.cash_amount || 0).toFixed(0)}</span> | <span>U: ₹{Number(v.upi_spent || v.upi_amount || 0).toFixed(0)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses by Category + Donut Allocation */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Category Allocation & ROI</h3>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Procurement cost vs business returns.
                </span>
              </div>
            </div>

            {categoriesData.length > 0 && (
              <div style={{ height: '180px', marginBottom: '16px' }}>
                <Doughnut
                  data={expenseCategoryDonutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right' } },
                    cutout: '65%'
                  }}
                />
              </div>
            )}

            {categoriesData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                No categorized expenses recorded in this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ fontSize: '0.88rem' }}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Total Spent (₹)</th>
                      <th style={{ width: '120px' }}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoriesData.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>
                          <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
                            {c.category}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--error)' }}>
                          ₹{Number(c.total_spent || c.total_expenses).toFixed(2)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(c.percentage_of_total, 2)}%`, height: '100%', background: '#f59e0b' }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', width: '38px', textAlign: 'right' }}>
                              {Number(c.percentage_of_total).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Analytics
