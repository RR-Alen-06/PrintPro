import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import { Search as SearchIcon, X, Receipt, Users, Inbox, ChevronRight, Phone, Calendar, ArrowRight } from 'lucide-react'
import { searchBills, searchCustomers, searchInventory } from '../../utils/search'
import '../../styles/mobile.css'

export default function MobileSearch() {
  const navigate = useNavigate()
  const { bills, customers, inventory } = useAppContext()

  const [activeTab, setActiveTab] = useState('bills') // 'bills' | 'customers' | 'inventory'
  const [query, setQuery] = useState('')

  // Tab specific filters
  const [billStatusFilter, setBillStatusFilter] = useState('all') // 'all' | 'paid' | 'partial' | 'unpaid'
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all') // 'all' | 'regular' | 'random'
  const [inventoryStockFilter, setInventoryStockFilter] = useState('all') // 'all' | 'lowStock'

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
    return searchCustomers((customers || []).filter(c => !c.deleted), query, filters)
  }, [customers, query, customerTypeFilter])

  // Filtered inventory
  const inventoryResults = useMemo(() => {
    const filters = {}
    if (inventoryStockFilter === 'lowStock') {
      filters.lowStock = true
    }
    return searchInventory(inventory || [], query, filters)
  }, [inventory, query, inventoryStockFilter])

  const counts = {
    bills: billResults.length,
    customers: customerResults.length,
    inventory: inventoryResults.length,
  }

  return (
    <MobileLayout title="Global Search" onSwitchToDesktop={() => navigate('/search')}>
      {/* Search Header */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
          OMNI SEARCH
        </span>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
          SYSTEM SEARCH
        </h2>
      </div>

      {/* Unified Search Input */}
      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <SearchIcon size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
        <input
          type="text"
          className="mobile-input"
          style={{ paddingLeft: '42px', paddingRight: query ? '40px' : '14px' }}
          placeholder="Search invoices, clients, inventory items..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery('')}
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

      {/* Entity Tabs with Badge Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        {[
          { id: 'bills', label: 'Bills', icon: Receipt, count: counts.bills },
          { id: 'customers', label: 'Clients', icon: Users, count: counts.customers },
          { id: 'inventory', label: 'Inventory', icon: Inbox, count: counts.inventory },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 6px',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                background: isActive ? 'rgba(0, 240, 255, 0.12)' : 'var(--bg-input)',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon size={14} />
                <span>{tab.label}</span>
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#0f172a' : 'var(--text-muted)',
                  fontWeight: 800,
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Quick Filter Pills per Tab */}
      {activeTab === 'bills' && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
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
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: billStatusFilter === f.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                background: billStatusFilter === f.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                color: billStatusFilter === f.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
          {[
            { id: 'all', label: 'All Clients' },
            { id: 'regular', label: 'Regular' },
            { id: 'random', label: 'Walk-in' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setCustomerTypeFilter(f.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: customerTypeFilter === f.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                background: customerTypeFilter === f.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                color: customerTypeFilter === f.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
          {[
            { id: 'all', label: 'All Items' },
            { id: 'lowStock', label: 'Low Stock (<10)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setInventoryStockFilter(f.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                border: inventoryStockFilter === f.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
                background: inventoryStockFilter === f.id ? 'rgba(255, 47, 176, 0.15)' : 'var(--bg-card)',
                color: inventoryStockFilter === f.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Results Content */}
      {activeTab === 'bills' && (
        <div>
          {billResults.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              No bills found matching your criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {billResults.map((bill) => (
                <div
                  key={bill.id}
                  className="mobile-card"
                  onClick={() => navigate(`/mobile/bill/${bill.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                        #{bill.invoiceNumber || bill.id}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {bill.customerName || 'Walk-in'}
                      </div>
                    </div>
                    <span
                      className={`mobile-badge ${
                        bill.status === 'paid'
                          ? 'mobile-badge-success'
                          : bill.status === 'partial'
                          ? 'mobile-badge-warning'
                          : 'mobile-badge-error'
                      }`}
                      style={{ fontSize: '0.65rem' }}
                    >
                      {String(bill.status || 'UNPAID').toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {bill.date} • {bill.items?.length || 0} item(s)
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }} className="currency-num">
                      ₹{Number(bill.total || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'customers' && (
        <div>
          {customerResults.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              No customers found matching your criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customerResults.map((cust) => (
                <div
                  key={cust.id}
                  className="mobile-card"
                  onClick={() => navigate(`/mobile/customer-bills?customerId=${cust.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {cust.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {cust.phone ? `Phone: ${cust.phone}` : 'No phone listed'}
                      </div>
                    </div>
                    <span
                      className={`mobile-badge ${cust.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}
                      style={{ fontSize: '0.65rem' }}
                    >
                      {String(cust.type || 'REGULAR').toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Credit: <strong className="currency-num">₹{Number(cust.creditBalance || 0).toFixed(2)}</strong>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                      Invoices <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          {inventoryResults.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              No inventory items found matching your criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {inventoryResults.map((item) => (
                <div key={item.id} className="mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {item.type === 'product'
                          ? `Product • Stock: ${item.stock || 0}`
                          : `Print Rate • Color: ₹${item.colorSingle || 0} / BW: ₹${item.bwSingle || 0}`}
                      </div>
                    </div>
                    {item.type === 'product' && (
                      <span className={`mobile-badge ${(item.stock || 0) < 10 ? 'mobile-badge-warning' : 'mobile-badge-success'}`} style={{ fontSize: '0.65rem' }}>
                        {(item.stock || 0) < 10 ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
                    )}
                  </div>
                  {item.sellingPrice > 0 && (
                    <div style={{ paddingTop: '6px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)' }} className="currency-num">
                        ₹{Number(item.sellingPrice).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </MobileLayout>
  )
}
