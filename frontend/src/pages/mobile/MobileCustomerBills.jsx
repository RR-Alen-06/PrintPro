import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePaymentMutations } from '../../hooks/useEntitiesQuery'
import { ReminderService } from '../../services/reminderService'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import {
  FileText, Search, User, ChevronRight, CheckCircle, AlertCircle,
  Loader2, Pencil, Trash2, RotateCcw, Plus, DollarSign, CreditCard,
  X, Check, Wallet, MessageCircle, QrCode, Smartphone, Copy
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileCustomerBills() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paramCustId = searchParams.get('customerId')
  const { showToast, business, settings } = useAppContext()

  // TanStack Queries & Mutations
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { updateBill: updateBillMutation, deleteBill: deleteBillMutation, isUpdatingBill, isDeletingBill } = useBillMutations()
  const { createPayment, isCreatingPayment } = usePaymentMutations()

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
    return (bills || [])
      .filter(b => !b.deleted && !b.deleted_at && String(b.customerId || b.customer_id) === String(selectedCustomerId))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [bills, selectedCustomerId])

  // Customer Financial Stats
  const customerStats = useMemo(() => {
    if (!selectedCustomer) return { totalBilled: 0, totalPaid: 0, totalOutstanding: 0, advanceBalance: 0 }
    const totalBilled = filteredBills.reduce((sum, b) => sum + Number(b.total || 0), 0)
    const totalPaid = filteredBills.reduce((sum, b) => sum + Number(b.amountPaid || b.amount_paid || 0), 0)
    const totalOutstanding = filteredBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)
    const advanceBalance = Number(selectedCustomer.creditBalance || selectedCustomer.credit_balance || 0)
    return { totalBilled, totalPaid, totalOutstanding, advanceBalance }
  }, [selectedCustomer, filteredBills])

  // ── Edit Bill BottomSheet State ──
  const [showEditSheet, setShowEditSheet] = useState(false)
  const [editingBill, setEditingBill] = useState(null)
  const [itemRows, setItemRows] = useState([])
  const [editDate, setEditDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [discountType, setDiscountType] = useState('flat')
  const [discountValue, setDiscountValue] = useState('')
  const [notes, setNotes] = useState('')

  // ── UPI QR Modal State ──
  const [showUpiSheet, setShowUpiSheet] = useState(false)
  const [upiModalAmount, setUpiModalAmount] = useState(0)
  const [upiModalNotes, setUpiModalNotes] = useState('')

  const getUpiLink = (amount, notesText = 'Bill Payment') => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: Number(amount).toFixed(2),
      cu: 'INR',
      tn: notesText,
    })
    return `upi://pay?${params.toString()}`
  }

  const openEditSheet = useCallback((bill) => {
    setEditingBill(bill)
    setEditDate(bill.date || new Date().toISOString().slice(0, 10))
    setEditDueDate(bill.dueDate || bill.due_date || '')
    setDiscountType(bill.discountType || bill.discount_type || 'flat')
    setDiscountValue(String(bill.discountValue || bill.discount_value || bill.discount || 0))
    setNotes(bill.notes || '')
    
    const items = (bill.items || []).map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      name: item.name || item.itemName || item.item_name || 'Print Item',
      printType: item.printType || item.print_type || 'color',
      sides: item.sides || 'single',
      qty: Number(item.qty || item.quantity || 1),
      unitPrice: Number(item.unitPrice || item.unit_price || 0),
      amount: Number(item.amount || (Number(item.qty || 1) * Number(item.unitPrice || item.unit_price || 0)))
    }))
    setItemRows(items.length > 0 ? items : [{ id: `item-${Date.now()}`, name: 'Print Paper', printType: 'color', sides: 'single', qty: 1, unitPrice: 10, amount: 10 }])
    setShowEditSheet(true)
  }, [])

  const handleAddItemRow = useCallback(() => {
    setItemRows(prev => [
      ...prev,
      { id: `item-${Date.now()}-${Math.random()}`, name: 'Print Item', printType: 'color', sides: 'single', qty: 1, unitPrice: 10, amount: 10 }
    ])
  }, [])

  const handleRemoveItemRow = useCallback((id) => {
    setItemRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev))
  }, [])

  const handleItemRowChange = useCallback((id, field, value) => {
    setItemRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, [field]: value }
      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(value || 0) : Number(row.qty || 0)
        const p = field === 'unitPrice' ? Number(value || 0) : Number(row.unitPrice || 0)
        updated.amount = q * p
      }
      return updated
    }))
  }, [])

  // Dynamic calculations for edit modal
  const editSubtotal = useMemo(() => {
    return itemRows.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  }, [itemRows])

  const editDiscountAmount = useMemo(() => {
    const val = Number(discountValue || 0)
    if (discountType === 'percent') {
      return (editSubtotal * val) / 100
    }
    return val
  }, [editSubtotal, discountType, discountValue])

  const editGrandTotal = useMemo(() => {
    return Math.max(0, editSubtotal - editDiscountAmount)
  }, [editSubtotal, editDiscountAmount])

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingBill) return

    try {
      const currentPaid = Number(editingBill.amountPaid || editingBill.amount_paid || 0)
      const newBalance = Math.max(0, editGrandTotal - currentPaid)
      const newStatus = newBalance <= 0 ? 'paid' : (currentPaid > 0 ? 'partial' : 'unpaid')

      const payload = {
        date: editDate,
        due_date: editDueDate,
        dueDate: editDueDate,
        items: itemRows.map(r => ({
          item_name: r.name,
          name: r.name,
          print_type: r.printType,
          printType: r.printType,
          sides: r.sides,
          qty: Number(r.qty || 1),
          unit_price: Number(r.unitPrice || 0),
          unitPrice: Number(r.unitPrice || 0),
          amount: Number(r.amount || 0)
        })),
        subtotal: editSubtotal,
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        discount: editDiscountAmount,
        total: editGrandTotal,
        balance: newBalance,
        status: newStatus,
        notes
      }

      await updateBillMutation({ id: editingBill.id, data: payload })
      showToast(`Bill #${editingBill.invoiceNumber || editingBill.invoice_number} updated!`, 'success')
      setShowEditSheet(false)
    } catch (err) {
      showToast(err.message || 'Failed to update bill', 'error')
    }
  }

  // ── Delete Bill Handler ──
  const handleDeleteBill = async (bill) => {
    const invNo = bill.invoiceNumber || bill.invoice_number || bill.id
    if (window.confirm(`Are you sure you want to delete invoice #${invNo}?`)) {
      try {
        await deleteBillMutation(bill.id)
        showToast(`Invoice #${invNo} deleted`, 'info')
      } catch (err) {
        showToast(err.message || 'Failed to delete bill', 'error')
      }
    }
  }

  // ── Refund BottomSheet State ──
  const [showRefundSheet, setShowRefundSheet] = useState(false)
  const [refundingBill, setRefundingBill] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash') // 'cash' | 'upi'
  const [refundNotes, setRefundNotes] = useState('')

  const openRefundSheet = (bill) => {
    setRefundingBill(bill)
    const paid = Number(bill.amountPaid || bill.amount_paid || 0)
    setRefundAmount(String(paid))
    setRefundMethod('cash')
    setRefundNotes('Customer bill return / refund')
    setShowRefundSheet(true)
  }

  const handleProcessRefund = async (e) => {
    e.preventDefault()
    if (!refundingBill) return
    const amt = Number(refundAmount || 0)
    if (amt <= 0) {
      showToast('Please enter a valid refund amount', 'error')
      return
    }

    try {
      await createPayment({
        bill_id: refundingBill.id,
        customer_id: selectedCustomerId,
        date: new Date().toISOString().slice(0, 10),
        cash_amount: refundMethod === 'cash' ? -amt : 0,
        upi_amount: refundMethod === 'upi' ? -amt : 0,
        total_paid: -amt,
        payment_type: 'refund',
        notes: refundNotes || 'Invoice Refund'
      })

      // Update bill paid amount and balance
      const currentPaid = Number(refundingBill.amountPaid || refundingBill.amount_paid || 0)
      const currentTotal = Number(refundingBill.total || 0)
      const newPaid = Math.max(0, currentPaid - amt)
      const newBal = Math.max(0, currentTotal - newPaid)
      const newStatus = newBal <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'unpaid')

      await updateBillMutation({
        id: refundingBill.id,
        data: {
          amount_paid: newPaid,
          amountPaid: newPaid,
          balance: newBal,
          status: newStatus
        }
      })

      showToast(`Refund of ₹${amt.toFixed(2)} processed successfully!`, 'success')
      setShowRefundSheet(false)
    } catch (err) {
      showToast(err.message || 'Failed to process refund', 'error')
    }
  }

  const isLoading = isLoadingBills || isLoadingCustomers

  return (
    <MobileLayout title="Customer Invoices">
      {/* Customer Selector Dropdown */}
      <div style={{ marginBottom: '14px' }}>
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
          {/* Customer Summary Card */}
          <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
                  CLIENT STATEMENT SUMMARY
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {selectedCustomer.name}
                </h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Phone: {selectedCustomer.phone || 'N/A'} • Code: {selectedCustomer.customer_code || selectedCustomer.code || 'N/A'}
                </div>
              </div>
              <span className={`mobile-badge ${selectedCustomer.type === 'regular' ? 'mobile-badge-info' : 'mobile-badge-warning'}`}>
                {(selectedCustomer.type || 'regular').toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ADVANCE BALANCE</span>
                <strong className="currency-num" style={{ fontSize: '1.05rem', color: customerStats.advanceBalance > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                  ₹{customerStats.advanceBalance.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL OUTSTANDING</span>
                <strong className="currency-num" style={{ fontSize: '1.05rem', color: customerStats.totalOutstanding > 0 ? 'var(--error)' : 'var(--success)' }}>
                  ₹{customerStats.totalOutstanding.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              INVOICES ({filteredBills.length})
            </h4>
            <button
              className="mobile-btn mobile-btn-primary"
              onClick={() => navigate('/mobile/create-bill')}
              style={{ minHeight: '34px', padding: '0 12px', fontSize: '0.75rem' }}
            >
              <Plus size={14} /> + New Invoice
            </button>
          </div>

          {filteredBills.length === 0 ? (
            <div className="mobile-card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ opacity: 0.5, color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No bills found for this client.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredBills.map(bill => {
                const isPaid = bill.status === 'paid'
                const isPartial = bill.status === 'partial'
                const paidAmt = Number(bill.amountPaid || bill.amount_paid || 0)
                const balAmt = Number(bill.balance || 0)
                const invNo = bill.invoiceNumber || bill.invoice_number || bill.id

                return (
                  <div key={bill.id} className="mobile-card" style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div onClick={() => navigate(`/mobile/bill/${bill.id}`)} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>
                          #{invNo}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Date: {bill.date} • Due: {bill.dueDate || bill.due_date || 'On Receipt'}
                        </div>
                      </div>
                      <span className={`mobile-badge ${isPaid ? 'mobile-badge-success' : isPartial ? 'mobile-badge-warning' : 'mobile-badge-error'}`}>
                        {(bill.status || 'unpaid').toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-md)', marginBottom: '10px', fontSize: '0.75rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Total</span>
                        <strong className="currency-num">₹{Number(bill.total || 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Paid</span>
                        <strong className="currency-num" style={{ color: 'var(--success)' }}>₹{paidAmt.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Balance</span>
                        <strong className="currency-num" style={{ color: balAmt > 0 ? 'var(--error)' : 'var(--success)' }}>₹{balAmt.toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Action Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: '6px' }}>
                      <button
                        className="mobile-btn mobile-btn-secondary"
                        onClick={() => openEditSheet(bill)}
                        style={{ minHeight: '34px', padding: '0 4px', fontSize: '0.72rem', color: 'var(--accent-secondary)' }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      {selectedCustomer?.phone && (
                        <button
                          type="button"
                          className="mobile-btn mobile-btn-secondary"
                          onClick={() => {
                            const text = ReminderService.buildInvoiceMessage(bill, business, settings)
                            const url = ReminderService.getWhatsAppUrl(selectedCustomer.phone, text)
                            window.open(url, '_blank')
                          }}
                          style={{ minHeight: '34px', padding: '0 4px', fontSize: '0.72rem', color: '#25D366' }}
                          title="WhatsApp Receipt"
                        >
                          <MessageCircle size={12} /> WhatsApp
                        </button>
                      )}
                      {balAmt > 0 && business?.upiId && (
                        <button
                          type="button"
                          className="mobile-btn mobile-btn-secondary"
                          onClick={() => {
                            setUpiModalAmount(balAmt)
                            setUpiModalNotes(`Invoice #${invNo} payment`)
                            setShowUpiSheet(true)
                          }}
                          style={{ minHeight: '34px', padding: '0 4px', fontSize: '0.72rem', color: 'var(--accent)' }}
                        >
                          <Smartphone size={12} /> Pay QR
                        </button>
                      )}
                      {paidAmt > 0 && (
                        <button
                          className="mobile-btn mobile-btn-secondary"
                          onClick={() => openRefundSheet(bill)}
                          style={{ minHeight: '34px', padding: '0 4px', fontSize: '0.72rem', color: 'var(--warning)' }}
                        >
                          <RotateCcw size={12} /> Refund
                        </button>
                      )}
                      <button
                        className="mobile-btn mobile-btn-secondary"
                        onClick={() => handleDeleteBill(bill)}
                        style={{ minHeight: '34px', padding: '0 4px', fontSize: '0.72rem', color: 'var(--error)' }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                      <button
                        className="mobile-btn mobile-btn-primary"
                        onClick={() => navigate(`/mobile/bill/${bill.id}`)}
                        style={{ minHeight: '34px', padding: '0 6px', fontSize: '0.72rem' }}
                      >
                        View <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Edit Bill BottomSheet ── */}
      <BottomSheet
        isOpen={showEditSheet}
        onClose={() => setShowEditSheet(false)}
        title={editingBill ? `Edit Invoice #${editingBill.invoiceNumber || editingBill.invoice_number}` : 'Edit Invoice'}
      >
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>INVOICE DATE</label>
              <input type="date" className="mobile-input" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>DUE DATE</label>
              <input type="date" className="mobile-input" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
          </div>

          {/* Line Items List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PRINT ITEMS ({itemRows.length})</label>
              <button
                type="button"
                className="mobile-btn mobile-btn-secondary"
                onClick={handleAddItemRow}
                style={{ minHeight: '28px', padding: '0 8px', fontSize: '0.7rem' }}
              >
                + Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {itemRows.map((row) => (
                <div key={row.id} style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input
                      type="text"
                      className="mobile-input"
                      style={{ fontSize: '0.78rem', padding: '6px 8px' }}
                      value={row.name}
                      placeholder="Item name"
                      onChange={(e) => handleItemRowChange(row.id, 'name', e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(row.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>QTY</span>
                      <input
                        type="number"
                        min="1"
                        className="mobile-input currency-num"
                        style={{ fontSize: '0.78rem', padding: '4px 6px' }}
                        value={row.qty}
                        onChange={(e) => handleItemRowChange(row.id, 'qty', e.target.value)}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>PRICE (₹)</span>
                      <input
                        type="number"
                        step="0.1"
                        className="mobile-input currency-num"
                        style={{ fontSize: '0.78rem', padding: '4px 6px' }}
                        value={row.unitPrice}
                        onChange={(e) => handleItemRowChange(row.id, 'unitPrice', e.target.value)}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TOTAL</span>
                      <div className="currency-num" style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-primary)', paddingTop: '6px' }}>
                        ₹{Number(row.amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount Field */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>DISCOUNT TYPE</label>
              <select className="mobile-input" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="flat">Flat (₹)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>DISCOUNT VALUE</label>
              <input type="number" step="0.1" className="mobile-input currency-num" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Total Summary */}
          <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal:</span>
              <span className="currency-num">₹{editSubtotal.toFixed(2)}</span>
            </div>
            {editDiscountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
                <span>Discount:</span>
                <span className="currency-num">-₹{editDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}>
              <span>NEW TOTAL:</span>
              <span className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{editGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isUpdatingBill}
          >
            {isUpdatingBill ? 'Saving Changes...' : 'Update Invoice'}
          </button>
        </form>
      </BottomSheet>

      {/* ── Refund BottomSheet ── */}
      <BottomSheet
        isOpen={showRefundSheet}
        onClose={() => setShowRefundSheet(false)}
        title="Issue Bill Refund"
      >
        <form onSubmit={handleProcessRefund} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(255, 184, 0, 0.1)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--warning)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', marginBottom: '2px' }}>REFUND INVOICE #{refundingBill?.invoiceNumber || refundingBill?.invoice_number}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Max refundable paid amount: ₹{Number(refundingBill?.amountPaid || refundingBill?.amount_paid || 0).toFixed(2)}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>REFUND AMOUNT (₹)</label>
            <input
              type="number"
              step="0.01"
              max={Number(refundingBill?.amountPaid || refundingBill?.amount_paid || 0)}
              className="mobile-input currency-num"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>PAYOUT METHOD</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${refundMethod === 'cash' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setRefundMethod('cash')}
                style={{ minHeight: '38px', fontSize: '0.8rem' }}
              >
                Cash Refund
              </button>
              <button
                type="button"
                className={`mobile-btn ${refundMethod === 'upi' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setRefundMethod('upi')}
                style={{ minHeight: '38px', fontSize: '0.8rem' }}
              >
                UPI Payout
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>REASON / NOTES</label>
            <input
              type="text"
              className="mobile-input"
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mobile-btn mobile-btn-primary"
            disabled={isCreatingPayment || isUpdatingBill}
            style={{ background: 'var(--warning)', color: '#000000', fontWeight: 800 }}
          >
            {isCreatingPayment || isUpdatingBill ? 'Processing Refund...' : 'Confirm & Reverse Payment'}
          </button>
        </form>
      </BottomSheet>

      {/* ── UPI QR Payment BottomSheet ── */}
      <BottomSheet
        isOpen={showUpiSheet}
        onClose={() => setShowUpiSheet(false)}
        title="UPI Payment QR"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Scan using any UPI App (GPay, PhonePe, Paytm)
          </div>
          {business?.upiId && upiModalAmount > 0 ? (
            <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', display: 'inline-block', border: '3px solid var(--accent)' }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(getUpiLink(upiModalAmount, upiModalNotes))}`}
                alt="UPI QR Code"
                width={160}
                height={160}
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Set UPI ID in business profile to generate QR.</div>
          )}

          <div style={{ background: 'var(--bg-input)', width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
              <strong className="currency-num" style={{ color: 'var(--accent)' }}>₹{Number(upiModalAmount).toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>UPI ID:</span>
              <strong style={{ fontFamily: 'monospace' }}>{business?.upiId || 'N/A'}</strong>
            </div>
          </div>

          <button
            type="button"
            className="mobile-btn mobile-btn-primary"
            onClick={() => {
              if (business?.upiId) {
                navigator.clipboard.writeText(getUpiLink(upiModalAmount, upiModalNotes))
                showToast('UPI payment link copied!', 'success')
              }
            }}
            style={{ width: '100%', minHeight: '38px', fontSize: '0.8rem' }}
          >
            <Copy size={14} /> Copy UPI Payment Link
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}

