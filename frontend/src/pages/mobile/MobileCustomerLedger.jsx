import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { Wallet, Download, CheckCircle, AlertCircle, ArrowLeftRight, User, RefreshCw, MessageSquare, Phone, QrCode } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomerLedger() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramCustId = searchParams.get('customerId')

  const {
    customers, bills, payments, advancePayments, recordPayment, processRefund,
    writeOffBill, business, showToast
  } = useAppContext()

  const activeCustomers = useMemo(() => (customers || []).filter(c => !c.deleted), [customers])
  const [selectedCustomerId, setSelectedCustomerId] = useState(paramCustId || activeCustomers[0]?.id || '')

  const selectedCustomer = useMemo(() => {
    return activeCustomers.find(c => String(c.id) === String(selectedCustomerId))
  }, [activeCustomers, selectedCustomerId])

  // Customer Ledger Calculations matching desktop
  const ledgerData = useMemo(() => {
    if (!selectedCustomerId) return { totalInvoiced: 0, totalPaid: 0, totalBalance: 0, transactions: [] }

    const custBills = (bills || []).filter(b => String(b.customerId) === String(selectedCustomerId) && !b.deleted)
    const custPayments = (payments || []).filter(p => String(p.customerId) === String(selectedCustomerId))
    const custAdvances = (advancePayments || []).filter(ap => String(ap.customerId) === String(selectedCustomerId))

    const totalInvoiced = custBills.reduce((s, b) => s + Number(b.total || 0), 0)
    const totalBalance = custBills.reduce((s, b) => s + Number(b.balance || 0), 0)
    const totalPaid = custPayments.reduce((s, p) => s + Number(p.totalPaid || 0), 0)

    const txns = []
    custBills.forEach(b => {
      txns.push({
        id: b.id,
        date: b.date,
        type: 'INVOICE',
        ref: `#${b.invoiceNumber || b.id}`,
        amount: Number(b.total || 0),
        balance: Number(b.balance || 0),
        status: b.status
      })
    })

    custPayments.forEach(p => {
      txns.push({
        id: p.id,
        date: p.date,
        type: 'PAYMENT',
        ref: `Payment (${p.notes || 'Recorded'})`,
        amount: Number(p.totalPaid || 0),
        cash: Number(p.cashAmount || 0),
        upi: Number(p.upiAmount || 0)
      })
    })

    txns.sort((a, b) => new Date(b.date) - new Date(a.date))

    return {
      totalInvoiced,
      totalPaid,
      totalBalance,
      transactions: txns
    }
  }, [selectedCustomerId, bills, payments, advancePayments])

  return (
    <MobileLayout title="Customer Ledger" onSwitchToDesktop={() => navigate('/customer-ledger')}>
      {/* Customer Selector Dropdown */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '6px' }}>
          SELECT CLIENT / CUSTOMER
        </label>
        <select
          className="mobile-input"
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
        >
          {activeCustomers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type}) • Bal: ₹{Number(c.creditBalance || 0).toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {selectedCustomer && (
        <>
          {/* Customer Summary Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>ACCOUNT STATEMENT</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {selectedCustomer.name}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Phone: {selectedCustomer.phone || 'N/A'}
                </div>
              </div>
              <span className={`mobile-badge ${selectedCustomer.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                {selectedCustomer.type.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>INVOICED</div>
                <div className="currency-num" style={{ fontSize: '1rem', color: '#ffffff' }}>₹{ledgerData.totalInvoiced.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>PAID</div>
                <div className="currency-num" style={{ fontSize: '1rem', color: 'var(--success)' }}>₹{ledgerData.totalPaid.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>DUE</div>
                <div className="currency-num" style={{ fontSize: '1rem', color: ledgerData.totalBalance > 0 ? 'var(--error)' : 'var(--success)' }}>₹{ledgerData.totalBalance.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Transactions Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.04em' }}>
              TRANSACTION HISTORY
            </h4>

            {ledgerData.transactions.length === 0 ? (
              <div className="mobile-card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                No recorded ledger transactions for this customer.
              </div>
            ) : (
              ledgerData.transactions.map(txn => (
                <div key={txn.id} className="mobile-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{txn.ref}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{txn.date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="currency-num" style={{ fontSize: '1.05rem', color: txn.type === 'INVOICE' ? 'var(--text-primary)' : 'var(--success)' }}>
                        {txn.type === 'INVOICE' ? `₹${txn.amount.toFixed(2)}` : `+₹${txn.amount.toFixed(2)}`}
                      </div>
                      <span className={`mobile-badge ${txn.type === 'INVOICE' ? 'mobile-badge-info' : 'mobile-badge-success'}`} style={{ fontSize: '0.65rem' }}>
                        {txn.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </MobileLayout>
  )
}
