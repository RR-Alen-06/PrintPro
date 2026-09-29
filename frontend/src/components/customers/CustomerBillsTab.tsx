import React, { useState, useMemo } from 'react'
import {
  FileText, Search, ChevronDown, ChevronRight, CheckCircle, AlertCircle,
  Pencil, Trash2, Tag, RefreshCw, Smartphone, Copy, Link2, MessageSquare, Plus, X, Wallet
} from 'lucide-react'
import { ReminderService } from '../../services/reminderService'
import EmptyState from '../common/EmptyState'

interface CustomerBillsTabProps {
  customer: any
  bills: any[]
  inventory: any[]
  advanceBalance: number
  business: any
  settings: any
  onUpdateBill: (id: string, data: any) => Promise<any>
  onDeleteBill: (id: string) => Promise<any>
  onPayBill: (bill: any, amounts: { cash: number; upi: number; advance: number }) => Promise<any>
  onApplyPostDiscount: (billId: string, discAmt: number) => Promise<any>
  onRefundBill?: (bill: any, refundData: any) => Promise<any>
  showToast: (msg: string, type?: string) => void
  showConfirm: (msg: string, onConfirm: () => void) => void
}

export const CustomerBillsTab: React.FC<CustomerBillsTabProps> = ({
  customer,
  bills,
  inventory = [],
  advanceBalance,
  business,
  settings,
  onUpdateBill,
  onDeleteBill,
  onPayBill,
  onApplyPostDiscount,
  onRefundBill,
  showToast,
  showConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all')
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null)

  // Direct Pay Modal / Panel per bill
  const [targetBillPayId, setTargetBillPayId] = useState<string | null>(null)
  const [targetCash, setTargetCash] = useState<string>('')
  const [targetUpi, setTargetUpi] = useState<string>('')
  const [targetAdvance, setTargetAdvance] = useState<string>('')
  const [targetPaySuccess, setTargetPaySuccess] = useState(false)
  const [isSubmittingPay, setIsSubmittingPay] = useState(false)

  // Post Discount Modal
  const [postDiscountBillId, setPostDiscountBillId] = useState<string | null>(null)
  const [postDiscountAmount, setPostDiscountAmount] = useState<string>('')

  // Edit Bill Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<any>(null)
  const [editItemRows, setEditItemRows] = useState<any[]>([])
  const [editDiscountType, setEditDiscountType] = useState('flat')
  const [editDiscountValue, setEditDiscountValue] = useState(0)
  const [editCashAmount, setEditCashAmount] = useState(0)
  const [editUpiAmount, setEditUpiAmount] = useState(0)
  const [editAdvanceUsed, setEditAdvanceUsed] = useState(0)
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editCustomGst, setEditCustomGst] = useState('')

  // Filter & sort bills
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (!b || b.deleted || b.deleted_at) return false
      const invNum = String(b.invoiceNumber || b.bill_number || b.id || '').toLowerCase()
      const matchesSearch = !searchQuery || invNum.includes(searchQuery.toLowerCase())
      
      const bal = Number(b.balance || 0)
      let matchesStatus = true
      if (statusFilter === 'unpaid') matchesStatus = bal > 0 && Number(b.amountPaid || b.paid_total || 0) === 0
      else if (statusFilter === 'partial') matchesStatus = bal > 0 && Number(b.amountPaid || b.paid_total || 0) > 0
      else if (statusFilter === 'paid') matchesStatus = bal <= 0

      return matchesSearch && matchesStatus
    }).sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
  }, [bills, searchQuery, statusFilter])

  // Summary totals
  const totalBilled = useMemo(() => bills.reduce((sum, b) => sum + Number(b.total !== undefined ? b.total : (b.grand_total || 0)), 0), [bills])
  const totalPaid = useMemo(() => bills.reduce((sum, b) => sum + Number(b.amountPaid !== undefined ? b.amountPaid : (b.paid_total || b.amount_paid || 0)), 0), [bills])
  const totalOutstanding = useMemo(() => bills.reduce((sum, b) => sum + Number(b.balance || 0), 0), [bills])

  // Open Edit Modal
  const openEditModal = (bill: any) => {
    setEditingBill(bill)
    setEditDate(bill.date || '')
    setEditDueDate(bill.dueDate || '')
    setEditDiscountType(bill.discountType || 'flat')
    setEditDiscountValue(bill.discountValue || 0)
    setEditCashAmount(bill.paymentMethod?.cash || bill.cash_amount || 0)
    setEditUpiAmount(bill.paymentMethod?.upi || bill.upi_amount || 0)
    setEditAdvanceUsed(bill.advanceUsed || bill.advance_used || 0)
    setEditNotes(bill.notes || '')
    setEditCustomGst(bill.gstAmount !== undefined && bill.gstAmount !== null ? String(bill.gstAmount) : '')

    setEditItemRows(
      (bill.items || []).map((item: any, idx: number) => ({
        id: `row-${Date.now()}-${idx}-${Math.random()}`,
        itemId: item.itemId || item.id || '',
        itemName: item.itemName || item.name || 'Custom Item',
        isCustom: !item.itemId,
        printType: item.printType || 'color',
        sides: item.sides || 'single',
        qty: item.qty || 1,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || (item.unitPrice || 0) * (item.qty || 1),
        gstRate: item.gstRate || 0,
      }))
    )
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingBill(null)
    setEditItemRows([])
  }

  // Handle bill editing save
  const handleSaveBillEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBill) return

    const subtotal = editItemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    let disc = 0
    if (editDiscountType === 'percentage') {
      disc = (subtotal * Number(editDiscountValue || 0)) / 100
    } else {
      disc = Number(editDiscountValue || 0)
    }
    const afterDisc = Math.max(0, subtotal - disc)
    const gstAmt = Number(editCustomGst || 0)
    const grandTotal = Number((afterDisc + gstAmt).toFixed(2))

    const paidAmt = Number(editCashAmount || 0) + Number(editUpiAmount || 0) + Number(editAdvanceUsed || 0)
    const newBal = Math.max(0, Number((grandTotal - paidAmt).toFixed(2)))
    const newStatus = newBal <= 0.001 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid')

    try {
      await onUpdateBill(editingBill.id, {
        items: editItemRows,
        subtotal,
        discountType: editDiscountType,
        discountValue: Number(editDiscountValue || 0),
        discountAmount: disc,
        gstAmount: gstAmt,
        total: grandTotal,
        grand_total: grandTotal,
        amountPaid: paidAmt,
        amount_paid: paidAmt,
        balance: newBal,
        status: newStatus,
        notes: editNotes,
        date: editDate,
        dueDate: editDueDate,
        advanceUsed: Number(editAdvanceUsed || 0),
        paymentMethod: {
          cash: Number(editCashAmount || 0),
          upi: Number(editUpiAmount || 0),
          method: Number(editCashAmount || 0) > 0 && Number(editUpiAmount || 0) > 0 ? 'split' : (Number(editUpiAmount || 0) > 0 ? 'upi' : 'cash'),
        },
      })
      showToast('Invoice updated successfully!', 'success')
      closeEditModal()
    } catch (err: any) {
      showToast(err?.message || 'Failed to update invoice', 'error')
    }
  }

  // Handle direct single bill payment
  const handleDirectBillPay = async (bill: any) => {
    const cash = Number(targetCash || 0)
    const upi = Number(targetUpi || 0)
    const adv = Number(targetAdvance || 0)
    const total = cash + upi + adv
    if (total <= 0) {
      showToast('Please enter an amount to pay.', 'warning')
      return
    }
    if (adv > advanceBalance) {
      showToast(`Cannot use ₹${adv.toFixed(2)} from advance. Available balance is ₹${advanceBalance.toFixed(2)}.`, 'error')
      return
    }
    const bal = Number(bill.balance || 0)
    if (total > bal + 0.01) {
      showToast(`Payment of ₹${total.toFixed(2)} exceeds invoice balance of ₹${bal.toFixed(2)}.`, 'warning')
      return
    }

    setIsSubmittingPay(true)
    try {
      await onPayBill(bill, { cash, upi, advance: adv })
      setTargetCash('')
      setTargetUpi('')
      setTargetAdvance('')
      setTargetPaySuccess(true)
      setTimeout(() => {
        setTargetPaySuccess(false)
        setTargetBillPayId(null)
      }, 2000)
    } finally {
      setIsSubmittingPay(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header Summary Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invoices</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{bills.length}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Billed</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{totalBilled.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Paid</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--aurora-cyan, #00f0ff)' }}>₹{totalPaid.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unpaid Due</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: totalOutstanding > 0 ? 'var(--aurora-pink, #ff2fb0)' : '#10b981' }}>
            ₹{totalOutstanding.toFixed(2)}
          </div>
        </div>
      </div>

      {/* 2. Search & Status Filter Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Bills' },
            { key: 'unpaid', label: 'Unpaid' },
            { key: 'partial', label: 'Partial' },
            { key: 'paid', label: 'Paid' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm ${statusFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-input-wrapper" style={{ minWidth: '220px', maxWidth: '300px' }}>
          <Search size={14} />
          <input
            type="text"
            className="form-input"
            placeholder="Search invoice number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* 3. Bills List */}
      {filteredBills.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Invoices Found"
          description={bills.length === 0 ? 'This customer does not have any invoices yet.' : 'No invoices match your selected filter.'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredBills.map((bill) => {
            const billTotal = Number(bill.total !== undefined ? bill.total : (bill.grand_total || 0))
            const billPaid = Number(bill.amountPaid !== undefined ? bill.amountPaid : (bill.paid_total || bill.amount_paid || 0))
            const billBalance = Number(bill.balance || 0)
            const billAdvUsed = Number(bill.advanceUsed || bill.advance_used || 0)
            const isPaid = billBalance <= 0.001
            const isPartial = !isPaid && billPaid > 0
            const isUnpaid = !isPaid && !isPartial
            const isExpanded = expandedBillId === bill.id
            const isPayPanelOpen = targetBillPayId === bill.id

            return (
              <div
                key={bill.id}
                className="card"
                style={{
                  padding: '16px',
                  borderLeft: isPaid ? '4px solid #10b981' : isPartial ? '4px solid var(--aurora-amber, #f59e0b)' : '4px solid var(--aurora-pink, #ff2fb0)',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                          Invoice #{bill.invoiceNumber || bill.bill_number || bill.id}
                        </span>
                        <span
                          className={`badge ${
                            isPaid ? 'badge-success' : isPartial ? 'badge-warning' : 'badge-danger'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID'}
                        </span>
                        {billAdvUsed > 0 && (
                          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem' }}>
                            <Wallet size={11} style={{ marginRight: '3px' }} /> ₹{billAdvUsed.toFixed(2)} Adv
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {bill.date ? new Date(bill.date).toLocaleDateString() : 'N/A'}
                        {bill.dueDate && ` • Due: ${new Date(bill.dueDate).toLocaleDateString()}`}
                        {bill.items?.length ? ` • ${bill.items.length} items` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Financials & Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Total: <strong>₹{billTotal.toFixed(2)}</strong> • Paid: <span style={{ color: '#10b981' }}>₹{billPaid.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isPaid ? '#10b981' : 'var(--aurora-pink, #ff2fb0)' }}>
                        Bal: ₹{billBalance.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!isPaid && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setTargetBillPayId(isPayPanelOpen ? null : bill.id)
                            setTargetCash(billBalance.toFixed(2))
                            setTargetUpi('')
                            setTargetAdvance('')
                          }}
                          style={{ fontSize: '0.75rem' }}
                        >
                          Pay Bill
                        </button>
                      )}

                      {!isPaid && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setPostDiscountBillId(bill.id)
                            setPostDiscountAmount('')
                          }}
                          title="Apply Post-Bill Discount"
                          style={{ fontSize: '0.75rem' }}
                        >
                          <Tag size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(bill)}
                        title="Edit Invoice"
                        style={{ fontSize: '0.75rem' }}
                      >
                        <Pencil size={13} />
                      </button>

                      {customer?.phone && !isPaid && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const text = ReminderService.buildBillReminderMessage(bill, customer, business)
                            const url = ReminderService.getWhatsAppUrl(customer.phone, text)
                            window.open(url, '_blank')
                          }}
                          title="WhatsApp Bill Reminder"
                          style={{ color: '#25D366', fontSize: '0.75rem' }}
                        >
                          <MessageSquare size={13} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          showConfirm(`Are you sure you want to delete Invoice #${bill.invoiceNumber || bill.id}?`, () => {
                            onDeleteBill(bill.id)
                          })
                        }}
                        title="Delete Invoice"
                        style={{ color: 'var(--error)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Direct Pay Inline Panel */}
                {isPayPanelOpen && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '14px',
                      borderRadius: '8px',
                      background: 'rgba(0, 240, 255, 0.05)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                      Pay Invoice #{bill.invoiceNumber || bill.id} — Pending: ₹{billBalance.toFixed(2)}
                    </div>
                    {targetPaySuccess && (
                      <div style={{ color: '#10b981', fontSize: '0.82rem', marginBottom: '8px' }}>
                        ✓ Payment successfully applied!
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cash (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder="0.00"
                          value={targetCash}
                          onChange={(e) => setTargetCash(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UPI (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder="0.00"
                          value={targetUpi}
                          onChange={(e) => setTargetUpi(e.target.value)}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <label style={{ fontSize: '0.75rem', color: advanceBalance > 0 ? '#10b981' : 'var(--text-muted)' }}>
                            Advance (₹)
                          </label>
                          {advanceBalance > 0 && (
                            <button
                              type="button"
                              onClick={() => setTargetAdvance(String(Math.min(advanceBalance, billBalance)))}
                              style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
                            >
                              Max
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          placeholder={advanceBalance > 0 ? `Max ₹${advanceBalance.toFixed(2)}` : 'No advance'}
                          disabled={advanceBalance <= 0}
                          value={targetAdvance}
                          onChange={(e) => setTargetAdvance(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTargetBillPayId(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isSubmittingPay}
                        onClick={() => handleDirectBillPay(bill)}
                      >
                        {isSubmittingPay ? 'Processing...' : 'Confirm Payment'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Items Accordion Breakdown */}
                {isExpanded && (
                  <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Invoice Line Items:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(bill.items || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div>
                            <strong>{item.itemName || item.name || 'Item'}</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                              ({item.qty} × ₹{Number(item.unitPrice || 0).toFixed(2)})
                            </span>
                          </div>
                          <div>₹{Number(item.amount || (item.unitPrice * item.qty) || 0).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    {bill.notes && (
                      <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Notes: {bill.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Post Discount Modal */}
      {postDiscountBillId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Apply Post-Bill Discount</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPostDiscountBillId(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Enter a flat discount to deduct directly from this unpaid invoice balance.
              </p>
              <div className="form-group">
                <label className="form-label">Discount Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                  value={postDiscountAmount}
                  onChange={(e) => setPostDiscountAmount(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setPostDiscountBillId(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const amt = Number(postDiscountAmount || 0)
                    if (amt <= 0) return
                    await onApplyPostDiscount(postDiscountBillId, amt)
                    setPostDiscountBillId(null)
                  }}
                >
                  Apply Discount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {isEditModalOpen && editingBill && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Edit Invoice #{editingBill.invoiceNumber || editingBill.id}</h3>
              <button className="btn btn-ghost btn-sm" onClick={closeEditModal}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveBillEdit} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '14px' }}>
                <label className="form-label">Items</label>
                {editItemRows.map((row, idx) => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={row.itemName}
                      onChange={(e) => {
                        const val = e.target.value
                        setEditItemRows((rows) => rows.map((r, i) => i === idx ? { ...r, itemName: val } : r))
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={row.qty}
                      onChange={(e) => {
                        const qty = Number(e.target.value)
                        setEditItemRows((rows) => rows.map((r, i) => i === idx ? { ...r, qty, amount: qty * r.unitPrice } : r))
                      }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={row.unitPrice}
                      onChange={(e) => {
                        const unitPrice = Number(e.target.value)
                        setEditItemRows((rows) => rows.map((r, i) => i === idx ? { ...r, unitPrice, amount: r.qty * unitPrice } : r))
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditItemRows((rows) => rows.filter((_, i) => i !== idx))}
                      style={{ color: 'var(--error)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Discount & GST */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editDiscountValue}
                    onChange={(e) => setEditDiscountValue(Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">GST Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editCustomGst}
                    onChange={(e) => setEditCustomGst(e.target.value)}
                  />
                </div>
              </div>

              {/* Payments Allocation in Edit */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Cash Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editCashAmount}
                    onChange={(e) => setEditCashAmount(Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">UPI Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editUpiAmount}
                    onChange={(e) => setEditUpiAmount(Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Advance Used</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editAdvanceUsed}
                    onChange={(e) => setEditAdvanceUsed(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
