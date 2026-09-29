import React, { useState } from 'react'
import {
  DollarSign, Wallet, ArrowDownLeft, ArrowUpRight, Calculator, FileText,
  Calendar, CheckCircle, AlertTriangle, Smartphone, ChevronRight
} from 'lucide-react'
import EmptyState from '../common/EmptyState'

interface CashbookRegisterTabProps {
  date: string
  onDateChange: (newDate: string) => void
  openingCash: number
  onUpdateOpeningCash: (newOpening: number) => void
  cashIn: number
  upiIn: number
  cashOut: number
  upiOut: number
  closingCash: number
  transactions: any[]
  onOpenDenominationModal: () => void
  onOpenZReportModal: () => void
  showToast: (msg: string, type?: string) => void
}

export const CashbookRegisterTab: React.FC<CashbookRegisterTabProps> = ({
  date,
  onDateChange,
  openingCash,
  onUpdateOpeningCash,
  cashIn,
  upiIn,
  cashOut,
  upiOut,
  closingCash,
  transactions = [],
  onOpenDenominationModal,
  onOpenZReportModal,
  showToast,
}) => {
  const [isEditingOpening, setIsEditingOpening] = useState(false)
  const [openingInput, setOpeningInput] = useState(String(openingCash))
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out'>('all')

  const totalCollected = cashIn + upiIn
  const totalOutflows = cashOut + upiOut

  const handleSaveOpening = () => {
    const val = Math.max(0, Number(openingInput || 0))
    onUpdateOpeningCash(val)
    setIsEditingOpening(false)
    showToast(`Opening cash drawer updated to ₹${val.toFixed(2)}`, 'success')
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (txFilter === 'in') return tx.type === 'in'
    if (txFilter === 'out') return tx.type === 'out'
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Action Strip with Date Picker, Denomination Counter & Z-Report */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} color="var(--aurora-cyan, #00f0ff)" />
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Register Date:</span>
          <input
            type="date"
            className="form-input"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            style={{ width: '150px', height: '34px', fontSize: '0.82rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenDenominationModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calculator size={14} color="var(--aurora-cyan, #00f0ff)" />
            Count Cash Drawer
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenZReportModal}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} />
            Daily Z-Report
          </button>
        </div>
      </div>

      {/* 2. Key Financial Inflow/Outflow KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Net In-Drawer Cash */}
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid #10b981',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Cash In Drawer
            </div>
            <Wallet size={16} color="#10b981" />
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '4px 0 2px' }}>
            ₹{closingCash.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Opening (₹{openingCash.toFixed(0)}) + In (₹{cashIn.toFixed(0)}) - Out (₹{cashOut.toFixed(0)})
          </div>
        </div>

        {/* Digital UPI Collected */}
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-cyan, #00f0ff)',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Digital UPI Revenue
            </div>
            <Smartphone size={16} color="var(--aurora-cyan, #00f0ff)" />
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)', margin: '4px 0 2px' }}>
            ₹{upiIn.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Settled directly into bank via QR</div>
        </div>

        {/* Total Inflows */}
        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Total Inflows (Cash + UPI)
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px' }}>
            ₹{totalCollected.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            From sales, billing & advance deposits
          </div>
        </div>

        {/* Outflows / Expenses */}
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-amber, #f59e0b)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Total Outflows
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)', margin: '4px 0 2px' }}>
            ₹{totalOutflows.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Expenses (₹{totalOutflows.toFixed(0)}) & refunds
          </div>
        </div>
      </div>

      {/* 3. Opening Cash Drawer Editor Box */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Opening Cash Float</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Starting change placed in the cash register drawer at the beginning of the shift.
          </div>
        </div>

        {isEditingOpening ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              value={openingInput}
              onChange={(e) => setOpeningInput(e.target.value)}
              style={{ width: '130px', height: '34px' }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveOpening}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditingOpening(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              ₹{openingCash.toFixed(2)}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setOpeningInput(String(openingCash))
                setIsEditingOpening(true)
              }}
            >
              Change Float
            </button>
          </div>
        )}
      </div>

      {/* 4. Daily Transactions Stream Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Day Book Cash & Digital Stream</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Chronological log of payments, advance receipts, and expense payouts.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: 'all', label: 'All Transactions' },
              { key: 'in', label: 'Inflows Only' },
              { key: 'out', label: 'Outflows Only' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn btn-sm ${txFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTxFilter(f.key as any)}
                style={{ fontSize: '0.75rem' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No Cashbook Entries for this Date"
            description="No bill payments or expenses were recorded on the selected date."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Time / Ref</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Category / Source</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>Method</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Cash Flow (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>UPI Flow (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, idx) => {
                  const isIn = tx.type === 'in'
                  return (
                    <tr
                      key={tx.id || idx}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        <div>{tx.time || tx.date || ''}</div>
                        {tx.ref && <div style={{ fontSize: '0.7rem', color: 'var(--aurora-cyan, #00f0ff)', fontFamily: 'monospace' }}>{tx.ref}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isIn ? '#10b981' : 'var(--aurora-amber, #f59e0b)',
                            }}
                          />
                          <span>{tx.description}</span>
                        </div>
                        {tx.partyName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '14px' }}>
                            {tx.partyName}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {tx.method || 'Cash'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: tx.cashAmount ? 700 : 400 }}>
                        {tx.cashAmount ? (
                          <span style={{ color: isIn ? '#10b981' : 'var(--aurora-amber, #f59e0b)' }}>
                            {isIn ? '+' : '-'}₹{Number(tx.cashAmount).toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: tx.upiAmount ? 700 : 400 }}>
                        {tx.upiAmount ? (
                          <span style={{ color: 'var(--aurora-cyan, #00f0ff)' }}>
                            {isIn ? '+' : '-'}₹{Number(tx.upiAmount).toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>
                        <span style={{ color: isIn ? '#10b981' : 'var(--aurora-amber, #f59e0b)' }}>
                          {isIn ? '+' : '-'}₹{Number(tx.total).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
