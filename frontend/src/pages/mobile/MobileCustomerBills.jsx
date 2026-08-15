import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import { FileText, Search, User, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomerBills() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramCustId = searchParams.get('customerId')

  // TanStack Queries
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()

  const activeCustomers = useMemo(() => (customers || []).filter(c => !c.deleted && !c.deleted_at), [customers])

  const [selectedCustomerId, setSelectedCustomerId] = useState(paramCustId || '')

  useEffect(() => {
    if (!selectedCustomerId && activeCustomers.length > 0) {
      setSelectedCustomerId(paramCustId || activeCustomers[0].id)
    }
  }, [activeCustomers, selectedCustomerId, paramCustId])

  const selectedCustomer = useMemo(() => {
    return activeCustomers.find(c => String(c.id) === String(selectedCustomerId))
  }, [activeCustomers, selectedCustomerId])

  const filteredBills = useMemo(() => {
    return (bills || []).filter(b => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === String(selectedCustomerId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [bills, selectedCustomerId])

  const isLoading = isLoadingBills || isLoadingCustomers

  return (
    <MobileLayout title="Customer Invoices" onSwitchToDesktop={() => navigate('/customer-bills')}>
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
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '24px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading customer invoices...</p>
        </div>
      )}

      {!isLoading && selectedCustomer && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              INVOICES FOR {selectedCustomer.name.toUpperCase()}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredBills.length} Bill(s)</span>
          </div>

          {filteredBills.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              No bills found for this customer.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredBills.map(bill => (
                <div key={bill.id} className="mobile-card" onClick={() => navigate(`/mobile/bill/${bill.id}`)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>
                        #{bill.invoiceNumber || bill.invoice_number || bill.id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date: {bill.date}</div>
                    </div>
                    <span className={`mobile-badge ${bill.status === 'paid' ? 'mobile-badge-success' : 'mobile-badge-error'}`}>
                      {(bill.status || 'unpaid').toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Total: <strong className="currency-num">₹{Number(bill.total || 0).toFixed(2)}</strong>
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                      View Invoice <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </MobileLayout>
  )
}
