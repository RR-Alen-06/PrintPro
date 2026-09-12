import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { useInventory, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'

import MobileLayout from '../../components/mobile/MobileLayout'
import {
  Search as SearchIcon, X, Receipt, Users, Inbox,
  ChevronRight, Phone, Calendar, ArrowRight, DollarSign,
  Package, Tag, CheckCircle2, AlertCircle, Clock, Loader2, Wallet, Share2
} from 'lucide-react'
import {
  searchBills, searchCustomers, searchInventory,
  searchExpenses, searchAdvances
} from '../../utils/search'
import { formatReceiptForWhatsApp } from '../../utils/receiptFormatter'
import { useAppContext } from '../../context/AppContext'
import '../../styles/mobile.css'

export default function MobileSearch() {
  const navigate = useNavigate()
  const { settings = {} } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // TanStack Queries
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: inventory = [], isLoading: isLoadingInventory } = useInventory()
  const { data: expenses = [], isLoading: isLoadingExpenses } = useExpenses()
  const { data: advances = [], isLoading: isLoadingAdvances } = useAdvancePayments()


  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'bills')
  const [query, setQuery] = useState(() => searchParams.get('q') || '')

  useEffect(() => {
    const q = searchParams.get('q')
    const tab = searchParams.get('tab')
    if (q !== null && q !== undefined) setQuery(q)
    if (tab && ['bills', 'customers', 'inventory', 'expenses', 'advances'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Tab specific filters
  const [billStatusFilter, setBillStatusFilter] = useState('all')
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all')
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState('all')
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all')

  // Filtered bills
  const billResults = useMemo(() => {
    const filters = {}
    if (billStatusFilter !== 'all') {
      filters.status = billStatusFilter
    }
    return searchBills(bills || [], query, filters)
  }, [bills, query, billStatusFilter])

  // Filtered customers
  const customerResults = useMemo(() => {
    const filters = {}
    if (customerTypeFilter !== 'all') {
      filters.type = customerTypeFilter
    }
    return searchCustomers((customers || []).filter(c => !c.deleted && !c.deleted_at), query, filters)
  }, [customers, query, customerTypeFilter])

  // Filtered inventory
  const inventoryResults = useMemo(() => {
    const filters = {}
    if (inventoryTypeFilter !== 'all') {
      filters.type = inventoryTypeFilter
    }
    return searchInventory(inventory || [], query, filters)
  }, [inventory, query, inventoryTypeFilter])

  // Filtered expenses
  const expenseResults = useMemo(() => {
    const filters = {}
    if (expenseCategoryFilter !== 'all') {
      filters.category = expenseCategoryFilter
    }
    return searchExpenses(expenses || [], query, filters)
  }, [expenses, query, expenseCategoryFilter])

  // Filtered advances
  const advanceResults = useMemo(() => {
    return searchAdvances(advances || [], query)
  }, [advances, query])

  const counts = {
    bills: billResults.length,
    customers: customerResults.length,
    inventory: inventoryResults.length,
    expenses: expenseResults.length,
    advances: advanceResults.length,
  }

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'paid') return { label: 'PAID', cls: 'mobile-badge-success' }
    if (s === 'partial') return { label: 'PARTIAL', cls: 'mobile-badge-warning' }
    return { label: 'UNPAID', cls: 'mobile-badge-error' }
  }

  const isLoading =
    (activeTab === 'bills' && isLoadingBills) ||
    (activeTab === 'customers' && isLoadingCustomers) ||
    (activeTab === 'inventory' && isLoadingInventory) ||
    (activeTab === 'expenses' && isLoadingExpenses) ||
    (activeTab === 'advances' && isLoadingAdvances)

  const handleShareBill = (e, bill) => {
    e.stopPropagation()
    const text = formatReceiptForWhatsApp(bill, settings)
    const phone = bill.customerPhone || bill.customer_phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  return (
    <MobileLayout title="Global Omni-Search">
      {/* Search Header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
          GLOBAL OMNI-SEARCH
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
          SYSTEM REGISTRY LOOKUP
        </h2>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Instant multi-entity lookup across all ERP registers
        </div>
      </div>

      {/* Glowing Search Input */}
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <SearchIcon size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{
            paddingLeft: '42px',
            paddingRight: query ? '40px' : '14px',
            boxShadow: query ? '0 0 12px rgba(0, 240, 255, 0.25)' : 'none',
            borderColor: query ? 'var(--accent-secondary)' : 'var(--border)',
          }}
          placeholder="Search invoices, clients, items, vouchers..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSearchParams(e.target.value ? { q: e.target.value, tab: activeTab } : { tab: activeTab })
          }}
          autoFocus
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setSearchParams({ tab: activeTab })
            }}
            style={{
              position: 'absolute',
              right: '12px',
              top: '14px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Entity Tabs with Counter Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'bills', label: 'Bills', icon: Receipt, count: counts.bills },
          { id: 'customers', label: 'Clients', icon: Users, count: counts.customers },
          { id: 'inventory', label: 'Catalog', icon: Inbox, count: counts.inventory },
          { id: 'expenses', label: 'Expenses', icon: DollarSign, count: counts.expenses },
          { id: 'advances', label: 'Advances', icon: Wallet, count: counts.advances },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                setSearchParams(query ? { q: query, tab: tab.id } : { tab: tab.id })
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 2px',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: isActive ? 'rgba(255, 47, 176, 0.16)' : 'var(--bg-card)',
                boxShadow: isActive ? '0 0 12px rgba(255, 47, 176, 0.3)' : 'none',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition)',
                minWidth: '58px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Icon size={13} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{tab.label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  marginTop: '2px',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontFamily: 'monospace',
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sub-Filter Pills */}
      {activeTab === 'bills' && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
          {[
            { id: 'all', label: 'All Status' },
            { id: 'paid', label: 'Paid' },
            { id: 'partial', label: 'Partial' },
            { id: 'unpaid', label: 'Unpaid' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setBillStatusFilter(f.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: billStatusFilter === f.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: billStatusFilter === f.id ? 'rgba(255, 47, 176, 0.18)' : 'var(--bg-card)',
                color: billStatusFilter === f.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
          {[
            { id: 'all', label: 'All Types' },
            { id: 'regular', label: 'Regular' },
            { id: 'random', label: 'Walk-In' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setCustomerTypeFilter(f.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: customerTypeFilter === f.id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: customerTypeFilter === f.id ? 'rgba(255, 47, 176, 0.18)' : 'var(--bg-card)',
                color: customerTypeFilter === f.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Searching records...</p>
        </div>
      )}

      {/* Results Feed */}
      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* BILLS TAB RESULTS */}
          {activeTab === 'bills' &&
            (billResults.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Receipt size={40} style={{ color: 'var(--accent-primary)', opacity: 0.5, marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No Invoices Found</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No bills match query "{query}".</p>
              </div>
            ) : (
              billResults.map((bill) => {
                const badge = getStatusBadge(bill.status)
                const invNum = bill.billSequence || bill.bill_sequence || bill.billNumber || bill.invoiceNumber || bill.id
                const total = Number(bill.total !== undefined ? bill.total : (bill.total_amount || 0))
                return (
                  <div
                    key={bill.id}
                    className="mobile-card"
                    onClick={() => navigate(`/mobile/bill/${bill.id}`)}
                    style={{ cursor: 'pointer', padding: '14px', transition: 'var(--transition)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          #{invNum}
                        </div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                          {bill.customerName || bill.customer_name || 'Walk-in Customer'}
                        </div>
                      </div>
                      <span className={`mobile-badge ${badge.cls}`} style={{ fontSize: '0.65rem' }}>
                        {badge.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Date: {bill.date || 'Today'}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '6px' }}>Total:</span>
                        <strong className="currency-num" style={{ fontSize: '1rem', color: '#ffffff' }}>
                          ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                      <button
                        onClick={(e) => handleShareBill(e, bill)}
                        style={{
                          background: 'rgba(37, 211, 102, 0.15)',
                          border: '1px solid rgba(37, 211, 102, 0.3)',
                          borderRadius: '6px',
                          color: '#25D366',
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Share2 size={12} /> WhatsApp
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                        View Detail <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                )
              })
            ))}

          {/* CUSTOMERS TAB RESULTS */}
          {activeTab === 'customers' &&
            (customerResults.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Users size={40} style={{ color: 'var(--accent-primary)', opacity: 0.5, marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No Clients Found</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No customers match query "{query}".</p>
              </div>
            ) : (
              customerResults.map((c) => {
                const bal = Number(c.creditBalance || c.credit_balance || c.balanceDue || c.balance_due || 0)
                return (
                  <div
                    key={c.id}
                    className="mobile-card"
                    onClick={() => navigate(`/mobile/customer-ledger?customerId=${c.id}`)}
                    style={{ cursor: 'pointer', padding: '14px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Phone: {c.phone || 'N/A'} • Code: {c.code || c.customerCode || 'N/A'}
                        </div>
                      </div>
                      <span className={`mobile-badge ${c.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {(c.type || 'WALK-IN').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding Balance:</span>
                      <strong className="currency-num" style={{ fontSize: '0.95rem', color: bal > 0 ? 'var(--error)' : 'var(--success)' }}>
                        ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                      Open Ledger <ChevronRight size={14} />
                    </div>
                  </div>
                )
              })
            ))}

          {/* INVENTORY TAB RESULTS */}
          {activeTab === 'inventory' &&
            (inventoryResults.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Inbox size={40} style={{ color: 'var(--accent-primary)', opacity: 0.5, marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No Catalog Items Found</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No inventory items match query "{query}".</p>
              </div>
            ) : (
              inventoryResults.map((item) => (
                <div
                  key={item.id}
                  className="mobile-card"
                  onClick={() => navigate('/mobile/inventory')}
                  style={{ cursor: 'pointer', padding: '14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        HSN: {item.hsnCode || item.hsn_code || 'N/A'} • Code: {item.code || item.itemCode || 'N/A'}
                      </div>
                    </div>
                    <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.65rem' }}>
                      PRINT PAPER
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: '0.74rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Color 1S: <strong className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{item.colorSingle ?? item.color_single ?? 10}</strong></span>
                    <span style={{ color: 'var(--text-secondary)' }}>B/W 1S: <strong className="currency-num" style={{ color: '#ffffff' }}>₹{item.bwSingle ?? item.bw_single ?? 3}</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                    Manage In Inventory <ChevronRight size={14} />
                  </div>
                </div>
              ))
            ))}

          {/* EXPENSES TAB RESULTS */}
          {activeTab === 'expenses' &&
            (expenseResults.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <DollarSign size={40} style={{ color: '#f59e0b', opacity: 0.5, marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No Expenses Found</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No expenses match query "{query}".</p>
              </div>
            ) : (
              expenseResults.map((exp) => (
                <div
                  key={exp.id}
                  className="mobile-card"
                  onClick={() => navigate('/mobile/accounting')}
                  style={{ cursor: 'pointer', padding: '14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {exp.category}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Voucher: #{exp.voucherNumber || exp.voucher_number || exp.id} • {exp.description || 'Expense'}
                      </div>
                    </div>
                    <strong className="currency-num" style={{ fontSize: '1rem', color: '#f59e0b' }}>
                      ₹{Number(exp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Mode: {exp.paymentMethod || exp.payment_method || 'Cash'} • Date: {exp.date}
                  </div>
                </div>
              ))
            ))}

          {/* ADVANCES TAB RESULTS */}
          {activeTab === 'advances' &&
            (advanceResults.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                <Wallet size={40} style={{ color: '#38bdf8', opacity: 0.5, marginBottom: '10px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)' }}>No Advance Receipts Found</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>No advance deposits match query "{query}".</p>
              </div>
            ) : (
              advanceResults.map((adv) => (
                <div
                  key={adv.id}
                  className="mobile-card"
                  onClick={() => navigate('/mobile/advance-payments')}
                  style={{ cursor: 'pointer', padding: '14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {adv.customerName || adv.customer_name || 'Customer'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Receipt: #{adv.receiptNumber || adv.receipt_number || adv.id} • Date: {adv.date}
                      </div>
                    </div>
                    <strong className="currency-num" style={{ fontSize: '1rem', color: '#38bdf8' }}>
                      ₹{Number(adv.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Mode: {adv.paymentMethod || adv.payment_method || 'Cash'}
                  </div>
                </div>
              ))
            ))}
        </div>
      )}
    </MobileLayout>
  )
}
