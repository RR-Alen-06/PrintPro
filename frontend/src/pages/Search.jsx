import React, { useState, useMemo, useEffect } from 'react'
import { Search as SearchIcon, X, ArrowUpDown } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { searchBills, searchCustomers, searchInventory, sortResults } from '../utils/search'
import { useSearchParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'

const Search = () => {
  const { bills, customers, inventory } = useAppContext()
  const [searchParams] = useSearchParams()
  const [searchType, setSearchType] = useState('bills')
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')

  // Sync query from URL when navigating here from the header search
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setQuery(q)
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
    lowStock: false,
  })

  const results = useMemo(() => {
    let filtered = []

    if (searchType === 'bills') {
      filtered = searchBills(bills, query, billFilters)
      filtered = sortResults(filtered, sortBy, sortOrder)
    } else if (searchType === 'customers') {
      filtered = searchCustomers(customers, query, customerFilters)
      filtered = sortResults(filtered, sortBy || 'name', sortOrder)
    } else if (searchType === 'inventory') {
      filtered = searchInventory(inventory, query, inventoryFilters)
      filtered = sortResults(filtered, sortBy || 'name', sortOrder)
    }

    return filtered
  }, [searchType, query, billFilters, customerFilters, inventoryFilters, sortBy, sortOrder, bills, customers, inventory])

  const clearFilters = () => {
    setQuery('')
    if (searchType === 'bills') {
      setBillFilters({ status: '', dateFrom: '', dateTo: '', minAmount: '', maxAmount: '', customerId: '' })
    } else if (searchType === 'customers') {
      setCustomerFilters({ type: '', status: '', hasCredit: '' })
    } else if (searchType === 'inventory') {
      setInventoryFilters({ lowStock: false })
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Advanced Search</h1>
        <p>Find bills, customers, and inventory items with powerful filters.</p>
      </div>

      {/* Search Type Tabs */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
          {['bills', 'customers', 'inventory'].map((type) => (
            <button
              key={type}
              className={`btn btn-ghost`}
              onClick={() => {
                setSearchType(type)
                clearFilters()
              }}
              style={{
                borderBottom: searchType === type ? '2px solid #3b82f6' : 'none',
                paddingBottom: '8px',
                textTransform: 'capitalize',
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Search & Filters Panel */}
        <div className="card">
          <h2>Search & Filter</h2>

          {/* Search Input */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Search Query</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                type="text"
                placeholder={
                  searchType === 'bills'
                    ? 'Search by bill ID, customer name, notes...'
                    : searchType === 'customers'
                      ? 'Search by ID, name, phone, email...'
                      : 'Search by item name...'
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="btn btn-ghost" onClick={() => setQuery('')}>
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Bills Filters */}
          {searchType === 'bills' && (
            <>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={billFilters.status}
                  onChange={(e) => setBillFilters({ ...billFilters, status: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Date Range</label>
                <input
                  className="form-input"
                  type="date"
                  value={billFilters.dateFrom}
                  onChange={(e) => setBillFilters({ ...billFilters, dateFrom: e.target.value })}
                  placeholder="From"
                />
                <input
                  className="form-input"
                  type="date"
                  value={billFilters.dateTo}
                  onChange={(e) => setBillFilters({ ...billFilters, dateTo: e.target.value })}
                  placeholder="To"
                  style={{ marginTop: '8px' }}
                />
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Amount Range</label>
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
                  style={{ marginTop: '8px' }}
                />
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Customer</label>
                <select
                  className="form-select"
                  value={billFilters.customerId}
                  onChange={(e) => setBillFilters({ ...billFilters, customerId: e.target.value })}
                >
                  <option value="">All Customers</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Customers Filters */}
          {searchType === 'customers' && (
            <>
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={customerFilters.type}
                  onChange={(e) => setCustomerFilters({ ...customerFilters, type: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="regular">Regular</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={customerFilters.status}
                  onChange={(e) => setCustomerFilters({ ...customerFilters, status: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Credit</label>
                <select
                  className="form-select"
                  value={customerFilters.hasCredit}
                  onChange={(e) => setCustomerFilters({ ...customerFilters, hasCredit: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="true">Has Credit</option>
                  <option value="false">No Credit</option>
                </select>
              </div>
            </>
          )}

          {/* Inventory Filters */}
          {searchType === 'inventory' && (
            <div className="form-group" style={{ marginTop: '16px' }}>
              <p className="text-muted" style={{ fontSize: '0.82rem' }}>Search inventory items by name to find pricing details.</p>
            </div>
          )}

          {/* Sort */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Sort By</label>
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
                    <option value="colorSingle">Color Single Price</option>
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

          {/* Clear Button */}
          <button className="btn btn-secondary" onClick={clearFilters} style={{ marginTop: '16px', width: '100%' }}>
            <X size={16} /> Clear All Filters
          </button>
        </div>

        {/* Results Panel */}
        <div className="card">
          <h2>Results ({results.length})</h2>

          <div style={{ marginTop: '16px' }}>
            {results.length === 0 ? (
              <EmptyState
                Icon={SearchIcon}
                title="No results found"
                description="No matching records were found for your search query and filter criteria."
                actionText="Reset Search & Filters"
                onAction={clearFilters}
              />
            ) : (
              <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      {searchType === 'bills' && (
                        <>
                          <th>Bill ID</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Status</th>
                        </>
                      )}
                      {searchType === 'customers' && (
                        <>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Phone</th>
                          <th>Credit</th>
                        </>
                      )}
                      {searchType === 'inventory' && (
                        <>
                          <th>Name</th>
                          <th>Color Single (₹)</th>
                          <th>B/W Single (₹)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item) => (
                      <tr key={item.id}>
                        {searchType === 'bills' && (
                          <>
                            <td>{item.id}</td>
                            <td>{item.customerName}</td>
                            <td>{item.date}</td>
                            <td>₹{item.total.toFixed(2)}</td>
                            <td>
                              <span className={`badge badge-${item.status}`}>{item.status}</span>
                            </td>
                          </>
                        )}
                        {searchType === 'customers' && (
                          <>
                            <td>{item.id}</td>
                            <td>{item.name}</td>
                            <td>{item.type}</td>
                            <td>{item.phone}</td>
                            <td>₹{item.creditBalance.toFixed(2)}</td>
                          </>
                        )}
                        {searchType === 'inventory' && (
                          <>
                            <td>{item.name}</td>
                            <td>₹{item.colorSingle.toFixed(2)}</td>
                            <td>₹{item.bwSingle.toFixed(2)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Search
