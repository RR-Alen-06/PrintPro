import React, { useState, useMemo } from 'react'
import { Wallet, Search, ArrowDownLeft, ArrowUpRight, User, ExternalLink, Calendar, X } from 'lucide-react'
import EmptyState from '../common/EmptyState'

interface GlobalAdvanceRegisterProps {
  customers: any[]
  advancePayments: any[]
  onSelectCustomer: (customerId: string, tab?: 'overview' | 'bills' | 'ledger' | 'advances') => void
}

export const GlobalAdvanceRegister: React.FC<GlobalAdvanceRegisterProps> = ({
  customers = [],
  advancePayments = [],
  onSelectCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | 'deposits' | 'returns'>('all')

  const activeCustomers = useMemo(() => customers.filter((c) => c && !c.deleted), [customers])

  // Customer Advance Balances Leaderboard
  const customersWithAdvance = useMemo(() => {
    return activeCustomers
      .filter((c) => Number(c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0) > 0)
      .sort((a, b) => {
        const balA = Number(a.advanceBalance || a.advance_balance || a.creditBalance || a.credit_balance || 0)
        const balB = Number(b.advanceBalance || b.advance_balance || b.creditBalance || b.credit_balance || 0)
        return balB - balA
      })
  }, [activeCustomers])

  const totalHeldAdvance = useMemo(() => {
    return customersWithAdvance.reduce((sum, c) => {
      return sum + Number(c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0)
    }, 0)
  }, [customersWithAdvance])

  // Filter transaction records
  const filteredRecords = useMemo(() => {
    return (Array.isArray(advancePayments) ? advancePayments : [])
      .filter((ap) => {
        if (!ap) return false
        const isReturn = ap.isReturn || ap.amount < 0 || ap.type === 'return'
        if (actionFilter === 'deposits' && isReturn) return false
        if (actionFilter === 'returns' && !isReturn) return false

        const name = String(ap.customerName || '').toLowerCase()
        const id = String(ap.customerId || ap.id || '').toLowerCase()
        const q = searchQuery.toLowerCase()
        const matchSearch = !searchQuery || name.includes(q) || id.includes(q)

        const apDate = ap.date ? ap.date.slice(0, 10) : ''
        const matchFrom = !dateFrom || apDate >= dateFrom
        const matchTo = !dateTo || apDate <= dateTo

        return matchSearch && matchFrom && matchTo
      })
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [advancePayments, searchQuery, dateFrom, dateTo, actionFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Global KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>
            Total Advance Held (Company-wide)
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '6px 0 2px' }}>
            ₹{totalHeldAdvance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across {customersWithAdvance.length} customers
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.78rem', textTransform: 'uppercase' }}>
            Total Advance Transactions
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)', margin: '6px 0 2px' }}>
            {advancePayments.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Audit register records</div>
        </div>
      </div>

      {/* 2. Customer Advance Balance Summary Carousel / Chips */}
      {customersWithAdvance.length > 0 && (
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
            Customers Holding Advance Balances ({customersWithAdvance.length})
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
            {customersWithAdvance.map((c) => {
              const bal = Number(c.advanceBalance || c.advance_balance || c.creditBalance || c.credit_balance || 0)
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectCustomer(c.id, 'advances')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    cursor: 'pointer',
                    minWidth: '150px',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                  title="View customer advance details"
                >
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                    ₹{bal.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Filters Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Transactions' },
            { key: 'deposits', label: 'Deposits Only' },
            { key: 'returns', label: 'Returns Only' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn btn-sm ${actionFilter === t.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActionFilter(t.key as any)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ minWidth: '180px', maxWidth: '240px' }}>
            <Search size={14} />
            <input
              type="text"
              className="form-input"
              placeholder="Search customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ height: '34px', fontSize: '0.78rem', width: '130px' }}
              title="From Date"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ height: '34px', fontSize: '0.78rem', width: '130px' }}
              title="To Date"
            />
            {(dateFrom || dateTo || searchQuery) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  setSearchQuery('')
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Complete Audit Register Table */}
      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No Advance Records Found"
          description="No advance deposits or returns match the selected filter criteria."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((ap) => {
                  const isReturn = ap.isReturn || ap.amount < 0 || ap.type === 'return'
                  const displayAmt = Math.abs(Number(ap.amount || 0))

                  return (
                    <tr key={ap.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {ap.date ? ap.date.slice(0, 10) : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        <span
                          onClick={() => onSelectCustomer(ap.customerId, 'advances')}
                          style={{ cursor: 'pointer', color: 'var(--aurora-cyan, #00f0ff)' }}
                          title="Open Customer Hub"
                        >
                          {ap.customerName || `Customer #${ap.customerId}`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${isReturn ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                          {isReturn ? 'Return' : 'Deposit'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {ap.paymentMethod || 'Cash'}
                      </td>
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: isReturn ? 'var(--aurora-amber, #f59e0b)' : '#10b981',
                        }}
                      >
                        {isReturn ? `-₹${displayAmt.toFixed(2)}` : `+₹${displayAmt.toFixed(2)}`}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {ap.notes || '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => onSelectCustomer(ap.customerId, 'advances')}
                        >
                          Customer <ExternalLink size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
