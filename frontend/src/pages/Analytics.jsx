import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  Package,
  Users,
  Calendar,
  Layers,
  DollarSign,
  Banknote,
  Smartphone,
  Tag,
  ShieldAlert,
  ArrowUpDown,
  ChevronRight,
  Sparkles,
  BarChart3,
  X,
  Clock,
  Printer
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import {
  getProductAnalytics,
  getProductCustomerBreakdown,
  getProductTrends,
  getAnalyticsSummary,
  getPromoUsageAnalytics,
  getExpensesByVendor,
  getExpensesByCategory
} from '../api/analytics'

const PERIODS = [
  { id: 'daily', label: 'Today' },
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
  const { business, showAlert } = useAppContext()

  const [activeTab, setActiveTab] = useState('products') // 'products' | 'expenses' | 'financials' | 'promos'
  const [period, setPeriod] = useState('monthly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [loading, setLoading] = useState(true)

  // Server-side loaded data
  const [summaryData, setSummaryData] = useState(null)
  const [productsData, setProductsData] = useState([])
  const [grandTotalRev, setGrandTotalRev] = useState(0)
  const [promoUsageData, setPromoUsageData] = useState([])
  const [revenueTrends, setRevenueTrends] = useState([])
  const [vendorsData, setVendorsData] = useState([])
  const [categoriesData, setCategoriesData] = useState([])
  const [grandTotalExpenses, setGrandTotalExpenses] = useState(0)

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

  // Fetch all analytics from server
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = {}
      if (dateParams.startDate) params.startDate = dateParams.startDate
      if (dateParams.endDate) params.endDate = dateParams.endDate

      const [sumRes, prodRes, promoRes, trendRes, vendorRes, catRes] = await Promise.all([
        getAnalyticsSummary(params),
        getProductAnalytics(params),
        getPromoUsageAnalytics(params),
        getProductTrends({ ...params, period: period === 'daily' ? 'daily' : 'monthly' }),
        getExpensesByVendor(params).catch(() => ({ data: { data: { vendors: [], grand_total_expenses: 0 } } })),
        getExpensesByCategory(params).catch(() => ({ data: { data: { categories: [], grand_total_expenses: 0 } } }))
      ])

      setSummaryData(sumRes.data.data || null)
      setProductsData(prodRes.data.data?.products || [])
      setGrandTotalRev(prodRes.data.data?.grand_total_revenue || 0)
      setPromoUsageData(promoRes.data.data || [])
      setRevenueTrends(trendRes.data.data || [])
      setVendorsData(vendorRes.data.data?.vendors || [])
      setCategoriesData(catRes.data.data?.categories || [])
      setGrandTotalExpenses(vendorRes.data.data?.grand_total_expenses || 0)
    } catch (err) {
      console.error('Failed to load server analytics:', err)
      if (showAlert) showAlert('Failed to fetch analytics from server.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [dateParams])

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

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <TrendingUp className="text-accent" size={28} />
            Business & Product Analytics
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Real-time server-side product sales breakdown, customer preferences, and financial trends.
          </p>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Period selector buttons */}
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

          {/* Custom Date Inputs */}
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
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Total Revenue</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc' }}>
            ₹{(summaryData?.total_revenue || 0).toFixed(2)}
          </div>
          <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '4px' }}>
            {summaryData?.bill_count || 0} invoices generated
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Banknote size={14} /> Cash Collected
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#10b981' }}>
            ₹{(summaryData?.cash_revenue || 0).toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Smartphone size={14} /> UPI Collected
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#3b82f6' }}>
            ₹{(summaryData?.upi_revenue || 0).toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f43f5e' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#f43f5e' }}>
            Expenses & Refunds
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f43f5e' }}>
            ₹{((summaryData?.total_expenses || 0) + (summaryData?.total_refunds || 0)).toFixed(2)}
          </div>
        </div>

        <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--accent)' }}>
          <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px', color: 'var(--accent)' }}>
            Net Profit (Margin)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--accent)' }}>
            ₹{(summaryData?.net_profit || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} /> Products & Services ({productsData.length})
        </button>
        <button
          className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('expenses')}
        >
          <Layers size={16} /> Expenses by Vendor & Category
        </button>
        <button
          className={`btn ${activeTab === 'financials' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('financials')}
        >
          <BarChart3 size={16} /> Financial Trends
        </button>
        <button
          className={`btn ${activeTab === 'promos' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('promos')}
        >
          <Tag size={16} /> Promo Codes ({promoUsageData.length})
        </button>
      </div>

      {/* ── TAB: EXPENSES BY VENDOR & CATEGORY ───────────────────────────────── */}
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
                          ₹{Number(v.total_expenses).toFixed(2)}
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
                          {v.expense_count}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span>C: ₹{Number(v.cash_amount).toFixed(0)}</span> | <span>U: ₹{Number(v.upi_amount).toFixed(0)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses by Category */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Expenses by Category</h3>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Category-wise cost allocation for this period.
                </span>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.95rem' }}>
                Total: ₹{grandTotalExpenses.toFixed(2)}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px' }} className="text-muted">
                Loading category expense data...
              </div>
            ) : categoriesData.length === 0 ? (
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
                      <th style={{ textAlign: 'right' }}>Entries</th>
                      <th style={{ textAlign: 'right' }}>Cash / UPI</th>
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
                          ₹{Number(c.total_expenses).toFixed(2)}
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
                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                          {c.expense_count}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span>C: ₹{Number(c.cash_amount).toFixed(0)}</span> | <span>U: ₹{Number(c.upi_amount).toFixed(0)}</span>
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

      {/* ── TAB 1: PRODUCTS & SERVICES BREAKDOWN ─────────────────────────────── */}
      {activeTab === 'products' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedProduct ? '1.2fr 1fr' : '1fr', gap: '20px' }}>
          {/* Products Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Product & Service Sales</h3>
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
                Calculating product analytics from server...
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
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
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

          {/* Drilldown Side-Panel for Selected Product */}
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
                  {/* Summary Metric Badges */}
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

                  {/* Top Customers Breakdown */}
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

      {/* ── TAB 2: FINANCIAL BREAKDOWN & TRENDS ──────────────────────────────── */}
      {activeTab === 'financials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Revenue Trend */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Revenue Over Time</h3>
            {revenueTrends.length === 0 ? (
              <div className="text-muted" style={{ padding: '24px', textAlign: 'center' }}>No revenue trend data available.</div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {revenueTrends.map((t) => {
                  const maxVal = Math.max(...revenueTrends.map(x => x.revenue), 1)
                  const share = (t.revenue / maxVal) * 100

                  return (
                    <div key={t.period_key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t.period_label}</span>
                        <span style={{ fontWeight: 700 }}>₹{t.revenue.toFixed(2)} ({t.bill_count} bills)</span>
                      </div>
                      <div style={{ background: '#1e293b', borderRadius: '4px', overflow: 'hidden', height: '10px' }}>
                        <div style={{ width: `${Math.max(share, 3)}%`, height: '100%', background: '#3b82f6' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Payment Collection Breakdown (Cash vs UPI) */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Payment Collection Method</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
                  <Banknote size={16} /> Total Cash Collected
                </span>
                <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>₹{(summaryData?.cash_revenue || 0).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6' }}>
                  <Smartphone size={16} /> Total UPI Collected
                </span>
                <strong style={{ color: '#3b82f6', fontSize: '1.1rem' }}>₹{(summaryData?.upi_revenue || 0).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}>
                  Refunds & Expenses Outflow
                </span>
                <strong style={{ color: '#f43f5e', fontSize: '1.1rem' }}>-₹{((summaryData?.total_expenses || 0) + (summaryData?.total_refunds || 0)).toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: PROMO CODE PERFORMANCE ───────────────────────────────────── */}
      {activeTab === 'promos' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Promo & Coupon Code Performance</h3>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Usage tracking, discount given, and total sales driven per coupon.
              </span>
            </div>
          </div>

          {promoUsageData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px' }} className="text-muted">
              No promo codes active or redeemed in this period.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Coupon Code</th>
                    <th>Discount Rule</th>
                    <th style={{ textAlign: 'right' }}>Times Redeemed</th>
                    <th style={{ textAlign: 'right' }}>Total Discount Given</th>
                    <th style={{ textAlign: 'right' }}>Sales Generated</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {promoUsageData.map((p) => (
                    <tr key={p.id || p.code}>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{p.code}</td>
                      <td>
                        {p.discount_type === 'percent' ? `${p.discount_value}% Off` : `₹${p.discount_value} Flat`}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{p.times_used}</td>
                      <td style={{ textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>
                        ₹{p.total_discount_given.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                        ₹{p.total_sales_generated.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: p.is_active !== false ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                            color: p.is_active !== false ? '#10b981' : '#94a3b8'
                          }}
                        >
                          {p.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Analytics
