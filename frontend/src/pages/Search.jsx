import React, { useState, useMemo, useEffect } from 'react'
import {
  Search as SearchIcon, X, ArrowUpDown, Receipt, Users, Inbox,
  DollarSign, Wallet, ExternalLink, Share2, Phone, Eye, FileText, ChevronRight
} from 'lucide-react'
import { useBills } from '../hooks/useBillsQuery'
import { useCustomers } from '../hooks/useCustomersQuery'
import { useInventory, useAdvancePayments } from '../hooks/useEntitiesQuery'
import { useExpenses } from '../hooks/useExpensesQuery'

import {
  searchBills, searchCustomers, searchInventory,
  searchExpenses, searchAdvances, sortResults
} from '../utils/search'
import { useSearchParams, useNavigate } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import { ReminderService } from '../services/reminderService'
import { formatReceiptForWhatsApp } from '../utils/receiptFormatter'
import { useAppContext } from '../context/AppContext'

const Search = () => {
  const navigate = useNavigate()
  const { settings = {} } = useAppContext()
  const { data: serverBills = [] } = useBills()
  const { data: serverCustomers = [] } = useCustomers()
  const { data: serverInventory = [] } = useInventory()
  const { data: serverExpenses = [] } = useExpenses()
  const { data: serverAdvances = [] } = useAdvancePayments()


  const [searchParams, setSearchParams] = useSearchParams()
  const [searchType, setSearchType] = useState(() => searchParams.get('tab') || 'bills')
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')

  // Sync query and tab from URL
  useEffect(() => {
    const q = searchParams.get('q')
    const tab = searchParams.get('tab')
    if (q !== null && q !== undefined) setQuery(q)
    if (tab && ['bills', 'customers', 'inventory', 'expenses', 'advances'].includes(tab)) {
      setSearchType(tab)
    }
  }, [searchParams])

  // Bills filters
  const [billFilters, setBillFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    customerId: '',
  })

  // Customers filters
  const [customerFilters, setCustomerFilters] = useState({
    type: '',
    status: '',
    hasCredit: '',
  })

  // Inventory filters
  const [inventoryFilters, setInventoryFilters] = useState({
    type: 'all',
  })

  // Expenses filters
  const [expenseFilters, setExpenseFilters] = useState({
    category: 'all',
    paymentMethod: 'all',
  })

  // Advances filters
  const [advanceFilters, setAdvanceFilters] = useState({
    status: 'all',
  })

  const results = useMemo(() => {
    let filtered = []

    if (searchType === 'bills') {
      filtered = searchBills(serverBills, query, billFilters)
      filtered = sortResults(filtered, sortBy || 'date', sortOrder)
    } else if (searchType === 'customers') {
      filtered = searchCustomers(serverCustomers, query, customerFilters)
      filtered = sortResults(filtered, sortBy || 'name', sortOrder)
    } else if (searchType === 'inventory') {
      filtered = searchInventory(serverInventory, query, inventoryFilters)
      filtered = sortResults(filtered, sortBy || 'name', sortOrder)
    } else if (searchType === 'expenses') {
      filtered = searchExpenses(serverExpenses, query, expenseFilters)
      filtered = sortResults(filtered, sortBy || 'date', sortOrder)
    } else if (searchType === 'advances') {
      filtered = searchAdvances(serverAdvances, query, advanceFilters)
      filtered = sortResults(filtered, sortBy || 'date', sortOrder)
    }

    return filtered
  }, [
    searchType, query, billFilters, customerFilters, inventoryFilters,
    expenseFilters, advanceFilters, sortBy, sortOrder,
    serverBills, serverCustomers, serverInventory, serverExpenses, serverAdvances
  ])

  const clearFilters = () => {
    setQuery('')
    setSearchParams({})
    if (searchType === 'bills') {
      setBillFilters({ status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '', customerId: '' })
    } else if (searchType === 'customers') {
      setCustomerFilters({ type: '', status: '', hasCredit: '' })
    } else if (searchType === 'inventory') {
      setInventoryFilters({ type: 'all' })
    } else if (searchType === 'expenses') {
      setExpenseFilters({ category: 'all', paymentMethod: 'all' })
    } else if (searchType === 'advances') {
      setAdvanceFilters({ status: 'all' })
    }
  }

  const handleShareBill = (bill) => {
    const text = formatReceiptForWhatsApp(bill, settings)
    const phone = bill.customerPhone || bill.customer_phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const handleShareCustomerStatement = (customer) => {
    const custBills = serverBills.filter((b) => !b.deleted && String(b.customerId) === String(customer.id))
    const totalBilled = custBills.reduce((s, b) => s + Number(b.total !== undefined ? b.total : (b.total_amount || 0)), 0)
    const totalPaid = custBills.reduce((s, b) => s + Number(b.amountPaid !== undefined ? b.amountPaid : (b.amount_paid || b.paidTotal || 0)), 0)
    const currentBalance = Number(customer.creditBalance || customer.credit_balance || customer.balanceDue || customer.balance_due || 0)

    const text = ReminderService.buildCustomerStatementMessage(
      customer,
      custBills,
      totalBilled,
      totalPaid,
      currentBalance,
      settings
    )
    const phone = customer.phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const tabCounts = {
    bills: searchBills(serverBills, query).length,
    customers: searchCustomers(serverCustomers, query).length,
    inventory: searchInventory(serverInventory, query).length,
    expenses: searchExpenses(serverExpenses, query).length,
    advances: searchAdvances(serverAdvances, query).length,
  }

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Global Omni-Search</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Instant multi-register search across Bills, Customers, Inventory, Expenses, and Advance Receipts.
          </p>
        </div>
      </div>

      {/* Register Selection Tabs */}
      <div className="card" style={{ marginBottom: '24px', padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'bills', label: 'Invoices & Bills', icon: Receipt, count: tabCounts.bills },
            { id: 'customers', label: 'Customers & Ledgers', icon: Users, count: tabCounts.customers },
            { id: 'inventory', label: 'Inventory & Rates', icon: Inbox, count: tabCounts.inventory },
            { id: 'expenses', label: 'Expenses & Cashbook', icon: DollarSign, count: tabCounts.expenses },
            { id: 'advances', label: 'Advance Receipts', icon: Wallet, count: tabCounts.advances },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = searchType === tab.id
            return (
              <button
                key={tab.id}
                className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setSearchType(tab.id)
                  setSearchParams(query ? { q: query, tab: tab.id } : { tab: tab.id })
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                    fontFamily: 'monospace',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px', gridTemplateColumns: '320px 1fr' }}>
        {/* Search & Filters Panel */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SearchIcon size={18} color="var(--accent-secondary, #00f0ff)" /> Filter Parameters
          </h2>

          {/* Search Input */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Search Query</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                type="text"
                placeholder={
                  searchType === 'bills'
                    ? 'Bill #, customer, phone, line item...'
                    : searchType === 'customers'
                    ? 'Name, code, phone, GST, address...'
                    : searchType === 'inventory'
                    ? 'Item name, HSN, code...'
                    : searchType === 'expenses'
                    ? 'Voucher #, vendor, category...'
                    : 'Receipt #, customer name...'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearchParams(e.target.value ? { q: e.target.value, tab: searchType } : { tab: searchType })
                }}
                autoFocus
              />
              {query && (
                <button className="btn btn-ghost" onClick={() => {
                  setQuery('')
                  setSearchParams({ tab: searchType })
                }}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Bills Filters */}
          {searchType === 'bills' && (
            <>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Payment Status</label>
                <select
                  className="form-select"
                  value={billFilters.status}
                  onChange={(e) => setBillFilters({ ...billFilters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Date From / To</label>
                <input
                  className="form-input"
                  type="date"
                  value={billFilters.dateFrom}
                  onChange={(e) => setBillFilters({ ...billFilters, dateFrom: e.target.value })}
                  style={{ marginBottom: '6px' }}
                />
                <input
                  className="form-input"
                  type="date"
                  value={billFilters.dateTo}
                  onChange={(e) => setBillFilters({ ...billFilters, dateTo: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Amount Range (₹)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="Min"
                    value={billFilters.minAmount}
                    onChange={(e) => setBillFilters({ ...billFilters, minAmount: e.target.value })}
                  />
                  <input
                    className="form-input"
                    type="number"
                    placeholder="Max"
                    value={billFilters.maxAmount}
                    onChange={(e) => setBillFilters({ ...billFilters, maxAmount: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {/* Customers Filters */}
          {searchType === 'customers' && (
            <>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Customer Type</label>
                <select
                  className="form-select"
                  value={customerFilters.type}
                  onChange={(e) => setCustomerFilters({ ...customerFilters, type: e.target.value })}
                >
                  <option value="">All Types</option>
                  <option value="regular">Regular</option>
                  <option value="random">Walk-in</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Balance Status</label>
                <select
                  className="form-select"
                  value={customerFilters.hasCredit}
                  onChange={(e) => setCustomerFilters({ ...customerFilters, hasCredit: e.target.value })}
                >
                  <option value="">All Balances</option>
                  <option value="true">Has Outstanding Balance</option>
                  <option value="false">Zero Balance / Cleared</option>
                </select>
              </div>
            </>
          )}

          {/* Expenses Filters */}
          {searchType === 'expenses' && (
            <>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Category</label>
                <select
                  className="form-select"
                  value={expenseFilters.category}
                  onChange={(e) => setExpenseFilters({ ...expenseFilters, category: e.target.value })}
                >
                  <option value="all">All Categories</option>
                  <option value="Raw Materials">Raw Materials</option>
                  <option value="Paper & Ink">Paper & Ink</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Rent">Rent</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Payment Method</label>
                <select
                  className="form-select"
                  value={expenseFilters.paymentMethod}
                  onChange={(e) => setExpenseFilters({ ...expenseFilters, paymentMethod: e.target.value })}
                >
                  <option value="all">All Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </>
          )}

          {/* Sort By */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Sort By</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {searchType === 'bills' && (
                  <>
                    <option value="date">Date</option>
                    <option value="total">Total Amount</option>
                    <option value="customerName">Customer</option>
                  </>
                )}
                {searchType === 'customers' && (
                  <>
                    <option value="name">Name</option>
                    <option value="creditBalance">Credit Balance</option>
                  </>
                )}
                {searchType === 'inventory' && (
                  <>
                    <option value="name">Name</option>
                    <option value="colorSingle">Color Rate</option>
                  </>
                )}
                {searchType === 'expenses' && (
                  <>
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="category">Category</option>
                  </>
                )}
                {searchType === 'advances' && (
                  <>
                    <option value="date">Date</option>
                    <option value="amount">Amount</option>
                    <option value="customerName">Customer</option>
                  </>
                )}
              </select>
              <button
                className="btn btn-ghost"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={clearFilters} style={{ width: '100%' }}>
            <X size={15} /> Reset Filters
          </button>
        </div>

        {/* Results Data Panel */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
              Results ({results.length})
            </h2>
            {query && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Showing matches for "<strong>{query}</strong>"
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <EmptyState
              Icon={SearchIcon}
              title="No records found"
              description={`No matching records found in ${searchType.toUpperCase()} for your criteria.`}
              actionText="Clear All Filters"
              onAction={clearFilters}
            />
          ) : (
            <div className="table-container" style={{ maxHeight: '680px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    {searchType === 'bills' && (
                      <>
                        <th>Invoice / Bill #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                    {searchType === 'customers' && (
                      <>
                        <th>Code</th>
                        <th>Customer Name</th>
                        <th>Phone</th>
                        <th>Type</th>
                        <th>Balance Due</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                    {searchType === 'inventory' && (
                      <>
                        <th>Item Name</th>
                        <th>HSN</th>
                        <th>Color 1S (₹)</th>
                        <th>B/W 1S (₹)</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                    {searchType === 'expenses' && (
                      <>
                        <th>Voucher #</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment Mode</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                    {searchType === 'advances' && (
                      <>
                        <th>Receipt #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((item) => {
                    if (searchType === 'bills') {
                      const billNum = item.billSequence || item.bill_sequence || item.billNumber || item.invoiceNumber || item.id
                      const total = Number(item.total !== undefined ? item.total : (item.total_amount || 0))
                      const status = String(item.status || 'unpaid').toLowerCase()
                      return (
                        <tr key={item.id} style={{ transition: 'background 0.15s ease' }}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
                            #{billNum}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.customerName || item.customer_name || 'Walk-in'}</div>
                            {item.customerPhone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📞 {item.customerPhone}</div>}
                          </td>
                          <td>{item.date || 'Today'}</td>
                          <td style={{ fontWeight: 800, color: 'var(--aurora-green, #10b981)' }}>
                            ₹{total.toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge badge-${status}`}>
                              {status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="View Receipt"
                                onClick={() => navigate(`/receipt?id=${item.id}`)}
                              >
                                <Eye size={14} /> View
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="WhatsApp Receipt"
                                onClick={() => handleShareBill(item)}
                              >
                                <Share2 size={14} color="#25D366" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    if (searchType === 'customers') {
                      const bal = Number(item.creditBalance || item.credit_balance || item.balanceDue || item.balance_due || 0)
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            {item.code || item.customerCode || item.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.phone || 'N/A'}</td>
                          <td>
                            <span className={`badge ${item.type === 'regular' ? 'badge-info' : 'badge-default'}`}>
                              {(item.type || 'random').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 800, color: bal > 0 ? '#ef4444' : '#10b981' }}>
                            {bal > 0 ? `₹${bal.toFixed(2)}` : 'Cleared'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Open Customer Ledger"
                                onClick={() => navigate(`/customer-ledger?customerId=${item.id}`)}
                              >
                                <FileText size={14} /> Ledger
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title="WhatsApp Statement"
                                onClick={() => handleShareCustomerStatement(item)}
                              >
                                <Share2 size={14} color="#25D366" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    if (searchType === 'inventory') {
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.hsnCode || item.hsn_code || 'N/A'}</td>
                          <td style={{ color: 'var(--accent-primary, #ff2fb0)', fontWeight: 700 }}>
                            ₹{Number(item.colorSingle !== undefined ? item.colorSingle : (item.color_single || 10)).toFixed(2)}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            ₹{Number(item.bwSingle !== undefined ? item.bwSingle : (item.bw_single || 3)).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate('/inventory')}
                            >
                              <ExternalLink size={14} /> Manage Rates
                            </button>
                          </td>
                        </tr>
                      )
                    }

                    if (searchType === 'expenses') {
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            #{item.voucherNumber || item.voucher_number || item.id}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.category}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                          </td>
                          <td>{item.date}</td>
                          <td style={{ fontWeight: 800, color: '#f59e0b' }}>
                            ₹{Number(item.amount || 0).toFixed(2)}
                          </td>
                          <td>{item.paymentMethod || item.payment_method || 'Cash'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate('/accounting')}
                            >
                              <ExternalLink size={14} /> View Cashbook
                            </button>
                          </td>
                        </tr>
                      )
                    }

                    if (searchType === 'advances') {
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            #{item.receiptNumber || item.receipt_number || item.id}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {item.customerName || item.customer_name || 'Customer'}
                          </td>
                          <td>{item.date}</td>
                          <td style={{ fontWeight: 800, color: '#38bdf8' }}>
                            ₹{Number(item.amount || 0).toFixed(2)}
                          </td>
                          <td>{item.paymentMethod || item.payment_method || 'Cash'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => navigate('/advance-payments')}
                            >
                              <ExternalLink size={14} /> Advance Desk
                            </button>
                          </td>
                        </tr>
                      )
                    }

                    return null
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Search
