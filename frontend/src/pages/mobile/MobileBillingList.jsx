import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePaymentMutations } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  Search, SlidersHorizontal, CheckCircle2, MessageSquare, Trash2,
  ChevronRight, FileText, PlusCircle, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileBillingList() {
  const navigate = useNavigate()
  const { showToast, business } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { deleteBill: deleteBillMutation, isDeletingBill } = useBillMutations()
  const { createPayment, isCreatingPayment } = usePaymentMutations()

  const [searchTerm, setSearchTerm] = useState('')
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('all') // 'all' | 'paid' | 'partial' | 'unpaid' | 'deleted'
  const [selectedCustomer, setSelectedCustomer] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'oldest' | 'highest' | 'lowest'

  // Quick Action confirmation modal state
  const [quickPayBill, setQuickPayBill] = useState(null)
  const [deleteConfirmBill, setDeleteConfirmBill] = useState(null)

  // Live Filtering & Sorting Logic
  const processedBills = useMemo(() => {
    let result = (serverBills || []).filter(b => !b.isGroupParent)

    // Status filter
    if (selectedStatus === 'deleted') {
      result = result.filter(b => b.deleted === true)
    } else {
      result = result.filter(b => !b.deleted)
      if (selectedStatus !== 'all') {
        result = result.filter(b => b.status === selectedStatus)
      }
    }

    // Customer filter
    if (selectedCustomer !== 'all') {
      result = result.filter(b => String(b.customerId || b.customer_id) === String(selectedCustomer))
    }

    // Date Range filter
    if (startDate) {
      result = result.filter(b => new Date(b.date) >= new Date(startDate))
    }
    if (endDate) {
      const endD = new Date(endDate)
      endD.setHours(23, 59, 59, 999)
      result = result.filter(b => new Date(b.date) <= endD)
    }

    // Live Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(b =>
        (b.invoiceNumber || b.invoice_number || b.id || '').toLowerCase().includes(q) ||
        (b.customerName || b.customer_name || '').toLowerCase().includes(q) ||
        (b.customerPhone || '').includes(q) ||
        (b.notes || '').toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.date || b.created_at || b.createdAt) - new Date(a.date || a.created_at || a.createdAt)
      if (sortBy === 'oldest') return new Date(a.date || a.created_at || a.createdAt) - new Date(b.date || b.created_at || b.createdAt)
      if (sortBy === 'highest') return Number(b.total || 0) - Number(a.total || 0)
      if (sortBy === 'lowest') return Number(a.total || 0) - Number(b.total || 0)
      return 0
    })

    return result
  }, [serverBills, selectedStatus, selectedCustomer, startDate, endDate, searchTerm, sortBy])

  // Quick Pay Execution via TanStack Mutation
  const handleConfirmQuickPay = async () => {
    if (!quickPayBill) return
    const balance = Number(quickPayBill.balance || 0)
    if (balance <= 0) {
      showToast('Bill is already fully paid.', 'info')
      setQuickPayBill(null)
      return
    }

    try {
      await createPayment({
        bill_id: quickPayBill.id,
        customer_id: quickPayBill.customerId || quickPayBill.customer_id,
        date: new Date().toISOString().slice(0, 10),
        cash_amount: balance,
        upi_amount: 0,
        total_paid: balance,
        payment_type: 'full',
        notes: 'Mobile Quick Pay (Full Cash Settlement)'
      })
      showToast(`Bill #${quickPayBill.invoiceNumber || quickPayBill.invoice_number || quickPayBill.id} marked FULLY PAID!`, 'success')
    } catch (e) {
      showToast(e.message || 'Failed to record payment', 'error')
    } finally {
      setQuickPayBill(null)
    }
  }

  // Delete Bill Execution via TanStack Mutation
  const handleConfirmDelete = async () => {
    if (!deleteConfirmBill) return
    try {
      await deleteBillMutation(deleteConfirmBill.id)
      showToast(`Bill #${deleteConfirmBill.invoiceNumber || deleteConfirmBill.invoice_number || deleteConfirmBill.id} archived.`, 'success')
    } catch (e) {
      showToast(e.message || 'Failed to archive bill', 'error')
    } finally {
      setDeleteConfirmBill(null)
    }
  }

  // WhatsApp Share Trigger
  const handleShareWhatsApp = (bill, e) => {
    e.stopPropagation()
    const cust = serverCustomers.find(c => String(c.id) === String(bill.customerId || bill.customer_id))
    const phone = bill.customerPhone || cust?.phone || ''
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    const shopName = business?.shopName || 'PrintPro'
    const invId = bill.invoiceNumber || bill.invoice_number || bill.id
    const total = Number(bill.total || 0).toFixed(2)
    const due = Number(bill.balance || 0).toFixed(2)

    const text = `Invoice #${invId} from ${shopName}\nTotal Amount: ₹${total}\nBalance Due: ₹${due}\nStatus: ${(bill.status || 'unpaid').toUpperCase()}\nThank you for doing business with us!`
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const isLoading = isLoadingBills || isLoadingCustomers

  return (
    <MobileLayout
      title="Print Bills Terminal"
      onSwitchToDesktop={() => {
        localStorage.setItem('printpro_viewport_pref', 'desktop')
        navigate('/billing')
      }}
    >
      {/* Header Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--accent-secondary)' }} />
          <input
            type="text"
            className="mobile-input"
            style={{ paddingLeft: '42px', paddingRight: '14px' }}
            placeholder="Search invoice #, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          className="mobile-icon-btn"
          onClick={() => setShowFilterModal(true)}
          style={{
            borderColor: selectedStatus !== 'all' || startDate || endDate ? 'var(--accent-primary)' : 'var(--border-light)',
            color: selectedStatus !== 'all' || startDate || endDate ? 'var(--accent-primary)' : 'var(--text-secondary)'
          }}
          title="Open Filters"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {/* Quick Status Pill Bar */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: 'All Bills' },
          { id: 'paid', label: 'Paid' },
          { id: 'partial', label: 'Partial' },
          { id: 'unpaid', label: 'Unpaid' },
          { id: 'deleted', label: 'Archived' },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStatus(s.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: selectedStatus === s.id ? '1px solid var(--accent-secondary)' : '1px solid var(--border)',
              background: selectedStatus === s.id ? 'rgba(0, 240, 255, 0.15)' : 'var(--bg-card)',
              color: selectedStatus === s.id ? 'var(--accent-secondary)' : 'var(--text-secondary)',
              boxShadow: selectedStatus === s.id ? '0 0 8px rgba(0, 240, 255, 0.3)' : 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Bill List Count Subheader */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          {isLoading ? 'LOADING INVOICES...' : `SHOWING ${processedBills.length} INVOICE RECORDS`}
        </span>
        <button
          onClick={() => navigate('/mobile/create-bill')}
          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <PlusCircle size={16} /> + New Bill
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '30px 16px' }}>
          <Loader2 size={28} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading live invoice records from cloud...</p>
        </div>
      )}

      {/* Invoice Card Stack */}
      {!isLoading && processedBills.length === 0 ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ marginBottom: '12px', color: 'var(--accent-primary)', opacity: 0.6 }} />
          <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            NO INVOICES MATCH FILTER
          </h4>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>Try clearing your search terms or date filter.</p>
        </div>
      ) : (
        !isLoading && processedBills.map((bill) => {
          const isPaid = bill.status === 'paid'
          const isPartial = bill.status === 'partial'
          const balance = Number(bill.balance || 0)

          return (
            <div
              key={bill.id}
              className="mobile-card"
              onClick={() => navigate(`/mobile/bill/${bill.id}`)}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {bill.customerName || bill.customer_name || 'Walk-in Customer'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', marginTop: '2px' }}>
                    #{bill.invoiceNumber || bill.invoice_number || bill.id} • {bill.date}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="currency-num" style={{ fontSize: '1.15rem', color: '#ffffff' }}>
                    ₹{Number(bill.total || 0).toLocaleString('en-IN')}
                  </div>
                  {balance > 0 && (
                    <div className="currency-num" style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
                      Due: ₹{balance.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`mobile-badge ${isPaid ? 'mobile-badge-success' : isPartial ? 'mobile-badge-warning' : 'mobile-badge-error'}`}>
                    {(bill.status || 'unpaid').toUpperCase()}
                  </span>
                  {bill.isGroupParent && (
                    <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.65rem' }}>
                      GROUP MASTER
                    </span>
                  )}
                  {bill.hasReturn && (
                    <span className="mobile-badge mobile-badge-warning" style={{ fontSize: '0.65rem' }}>
                      RETURNED
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Mark Paid Quick Action */}
                  {!isPaid && !bill.deleted && (
                    <button
                      className="mobile-icon-btn"
                      onClick={(e) => { e.stopPropagation(); setQuickPayBill(bill) }}
                      title="Quick Mark Paid"
                      style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', color: 'var(--success)', borderColor: 'var(--success-bg)' }}
                      disabled={isCreatingPayment}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}

                  {/* WhatsApp Action */}
                  <button
                    className="mobile-icon-btn"
                    onClick={(e) => handleShareWhatsApp(bill, e)}
                    title="Share Invoice WhatsApp"
                    style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', color: '#25D366' }}
                  >
                    <MessageSquare size={16} />
                  </button>

                  {/* Delete Action */}
                  {!bill.deleted && (
                    <button
                      className="mobile-icon-btn"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmBill(bill) }}
                      title="Archive Invoice"
                      style={{ width: '36px', height: '36px', minWidth: '36px', minHeight: '36px', color: 'var(--error)', borderColor: 'var(--error-bg)' }}
                      disabled={isDeletingBill}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* Filter Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter Invoice Terminal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CUSTOMER FILTER
            </label>
            <select
              className="mobile-input"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="all">All Customers</option>
              {(serverCustomers || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DATE RANGE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                type="date"
                className="mobile-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="mobile-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SORT ORDER
            </label>
            <select
              className="mobile-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Amount</option>
              <option value="lowest">Lowest Amount</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
            <button
              className="mobile-btn mobile-btn-secondary"
              onClick={() => {
                setSelectedStatus('all')
                setSelectedCustomer('all')
                setStartDate('')
                setEndDate('')
                setSortBy('newest')
                setSearchTerm('')
                setShowFilterModal(false)
              }}
            >
              Reset Filters
            </button>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => setShowFilterModal(false)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Quick Pay Confirmation Modal */}
      {quickPayBill && (
        <div className="bottom-sheet-overlay" onClick={() => setQuickPayBill(null)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Mark Bill #{quickPayBill.invoiceNumber || quickPayBill.invoice_number || quickPayBill.id} as PAID?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This will record a full cash payment of <strong className="currency-num" style={{ color: 'var(--success)' }}>₹{Number(quickPayBill.balance || 0).toFixed(2)}</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button className="mobile-btn mobile-btn-secondary" onClick={() => setQuickPayBill(null)}>
                Cancel
              </button>
              <button className="mobile-btn mobile-btn-primary" onClick={handleConfirmQuickPay} disabled={isCreatingPayment}>
                {isCreatingPayment ? 'Processing...' : 'Confirm Full Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBill && (
        <div className="bottom-sheet-overlay" onClick={() => setDeleteConfirmBill(null)}>
          <div className="bottom-sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-drag-handle" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--error)' }}>
              Archive Bill #{deleteConfirmBill.invoiceNumber || deleteConfirmBill.invoice_number || deleteConfirmBill.id}?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Are you sure you want to move this invoice to deleted bills?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button className="mobile-btn mobile-btn-secondary" onClick={() => setDeleteConfirmBill(null)}>
                Cancel
              </button>
              <button
                className="mobile-btn"
                style={{ background: 'var(--error)', color: '#fff' }}
                onClick={handleConfirmDelete}
                disabled={isDeletingBill}
              >
                {isDeletingBill ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  )
}
