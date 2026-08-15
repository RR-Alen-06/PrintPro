import React, { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills, useBillMutations } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePayments, usePaymentMutations } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import BottomSheet from '../../components/mobile/BottomSheet'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  FileText, Download, CreditCard, QrCode, ArrowLeft, CheckCircle2,
  Clock, AlertTriangle, Phone, Mail, User, ShieldCheck, Share2, Wallet, DollarSign,
  Pencil, Tag, RotateCcw, Percent, Check, Loader2
} from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileBillDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    business, settings, showToast, applyPostDiscount, createCreditNote, recordPayment: contextRecordPayment
  } = useAppContext()

  // TanStack Queries & Mutations
  const { data: serverBills = [], isLoading: isLoadingBills } = useBills()
  const { data: serverCustomers = [], isLoading: isLoadingCustomers } = useCustomers()
  const { data: serverPayments = [], isLoading: isLoadingPayments } = usePayments()
  const { updateBill: updateBillMutation, isUpdatingBill } = useBillMutations()
  const { createPayment, isCreatingPayment } = usePaymentMutations()

  const invoiceRef = useRef(null)

  // Find target bill
  const bill = useMemo(() => {
    return (serverBills || []).find(b => String(b.id) === String(id) || String(b.invoiceNumber || b.invoice_number) === String(id))
  }, [serverBills, id])

  // Customer info
  const customer = useMemo(() => {
    if (!bill) return null
    return (serverCustomers || []).find(c => String(c.id) === String(bill.customerId || bill.customer_id))
  }, [serverCustomers, bill])

  // Related payments for this bill
  const billPayments = useMemo(() => {
    if (!bill) return []
    return (serverPayments || []).filter(p => String(p.billId || p.bill_id) === String(bill.id))
  }, [serverPayments, bill])

  // Payment Bottom Sheet state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payCashAmount, setPayCashAmount] = useState('')
  const [payUpiAmount, setPayUpiAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')

  // UPI QR Bottom Sheet state
  const [showUpiModal, setShowUpiModal] = useState(false)

  // Post-Bill Discount Modal state
  const [showPostDiscountModal, setShowPostDiscountModal] = useState(false)
  const [postDiscountType, setPostDiscountType] = useState('flat') // 'flat' | 'percent'
  const [postDiscountValue, setPostDiscountValue] = useState('')

  // Item Return / Credit Note Modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnQtys, setReturnQtys] = useState({})
  const [returnSettlement, setReturnSettlement] = useState('advance') // 'advance' | 'cash'

  // PDF Exporting state
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  if (isLoadingBills) {
    return (
      <MobileLayout title="Loading Invoice..." onSwitchToDesktop={() => navigate('/billing')}>
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', marginTop: '20px' }}>
          <Loader2 size={36} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 12px auto' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading invoice details from cloud...</p>
        </div>
      </MobileLayout>
    )
  }

  if (!bill) {
    return (
      <MobileLayout title="Bill Not Found" onSwitchToDesktop={() => navigate('/billing')}>
        <div className="mobile-card" style={{ textAlign: 'center', padding: '40px 16px', marginTop: '20px' }}>
          <AlertTriangle size={48} style={{ color: 'var(--error)', marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            INVOICE NOT FOUND
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            The requested bill record #{id} does not exist or was deleted.
          </p>
          <button className="mobile-btn mobile-btn-primary" onClick={() => navigate('/mobile/billing')}>
            Return to Bills Terminal
          </button>
        </div>
      </MobileLayout>
    )
  }

  const isPaid = bill.status === 'paid'
  const isPartial = bill.status === 'partial'
  const balanceDue = Number(bill.balance || 0)
  const totalAmount = Number(bill.total || 0)

  // Execute PDF Export
  const handleExportPDF = async () => {
    setIsExportingPdf(true)
    showToast('Generating HD Invoice PDF...', 'info')

    try {
      if (!invoiceRef.current) throw new Error('Invoice DOM target not rendered')

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#05040a',
        logging: false
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`Invoice_${bill.invoiceNumber || bill.invoice_number || bill.id}.pdf`)
      showToast('PDF Export Downloaded Successfully!', 'success')
    } catch (err) {
      console.error('PDF export error', err)
      showToast('PDF Export failed: falling back to print view', 'error')
      window.print()
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Record Payment Submission via TanStack Mutation
  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault()
    const cash = Number(payCashAmount || 0)
    const upi = Number(payUpiAmount || 0)
    const totalNewPaid = cash + upi

    if (totalNewPaid <= 0) {
      showToast('Please enter a valid cash or UPI amount', 'error')
      return
    }

    if (totalNewPaid > balanceDue + 0.01) {
      showToast(`Payment amount cannot exceed balance due (₹${balanceDue.toFixed(2)})`, 'error')
      return
    }

    try {
      await createPayment({
        bill_id: bill.id,
        customer_id: bill.customerId || bill.customer_id,
        date: new Date().toISOString().slice(0, 10),
        cash_amount: cash,
        upi_amount: upi,
        total_paid: totalNewPaid,
        payment_type: totalNewPaid >= balanceDue ? 'full' : 'partial',
        notes: payNotes || 'Mobile Terminal Payment Record'
      })

      if (contextRecordPayment) {
        contextRecordPayment({
          id: `PAY-${Date.now()}`,
          billId: bill.id,
          date: new Date().toISOString().slice(0, 10),
          cashAmount: cash,
          upiAmount: upi,
          totalPaid: totalNewPaid,
          notes: payNotes || 'Mobile Terminal Payment Record'
        })
      }

      showToast(`Recorded ₹${totalNewPaid.toFixed(2)} payment successfully!`, 'success')
      setPayCashAmount('')
      setPayUpiAmount('')
      setPayNotes('')
      setShowPaymentModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error')
    }
  }

  // Handle Post-Bill Discount Application
  const handleApplyPostDiscountSubmit = async (e) => {
    e.preventDefault()
    const val = Number(postDiscountValue || 0)
    if (val <= 0) {
      showToast('Please enter a discount value', 'error')
      return
    }

    try {
      if (applyPostDiscount) {
        await applyPostDiscount(bill.id, postDiscountType, val)
      } else {
        const discountAmt = postDiscountType === 'percent' ? (Number(bill.subtotal || bill.total || 0) * val) / 100 : val
        const newTotal = Math.max(0, Number(bill.subtotal || bill.total || 0) - discountAmt)
        const newBal = Math.max(0, newTotal - Number(bill.amountPaid || bill.amount_paid || 0))
        await updateBillMutation({
          id: bill.id,
          data: {
            discount_type: postDiscountType,
            discount_value: val,
            total: newTotal,
            balance: newBal,
            status: newBal <= 0 ? 'paid' : (newTotal > newBal ? 'partial' : 'unpaid')
          }
        })
      }
      showToast(`Applied post-bill discount successfully!`, 'success')
      setShowPostDiscountModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to apply discount', 'error')
    }
  }

  // Handle Credit Note / Item Return Submission
  const handleCreateCreditNoteSubmit = async (e) => {
    e.preventDefault()
    const returnedItems = []
    Object.entries(returnQtys).forEach(([itemId, qty]) => {
      const q = Number(qty)
      if (q > 0) {
        const itemObj = (bill.items || []).find(i => String(i.id) === String(itemId) || String(i.itemId) === String(itemId))
        if (itemObj) {
          returnedItems.push({ ...itemObj, returnQty: q })
        }
      }
    })

    if (returnedItems.length === 0) {
      showToast('Please select quantity to return for at least one item', 'error')
      return
    }

    try {
      if (createCreditNote) {
        await createCreditNote(bill.id, returnedItems, returnSettlement)
      }
      showToast('Credit Note created and inventory restocked!', 'success')
      setShowReturnModal(false)
    } catch (err) {
      showToast(err.message || 'Failed to create credit note', 'error')
    }
  }

  // Quick Full Pay Pre-fill
  const handleQuickFullPayPrefill = () => {
    setPayCashAmount(balanceDue.toFixed(2))
    setPayUpiAmount('0')
  }

  // Generate UPI URI
  const upiId = business?.upiId || 'merchant@upi'
  const shopName = business?.shopName || 'PrintPro'
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${balanceDue.toFixed(2)}&cu=INR&tn=Invoice%20${encodeURIComponent(bill.invoiceNumber || bill.invoice_number || bill.id)}`

  return (
    <MobileLayout
      title={`Bill #${bill.invoiceNumber || bill.invoice_number || bill.id}`}
      onSwitchToDesktop={() => navigate('/billing')}
    >
      {/* Target printable element for PDF generation */}
      <div ref={invoiceRef} style={{ background: '#05040a', padding: '4px' }}>
        {/* Invoice Header Card */}
        <div className="mobile-card mobile-card-glow" style={{ borderColor: 'var(--accent-primary)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-secondary)', letterSpacing: '0.08em' }}>
                INVOICE TERMINAL RECORD
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '2px 0 0 0', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono' }}>
                #{bill.invoiceNumber || bill.invoice_number || bill.id}
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Created: {bill.date} • Due: {bill.dueDate || 'On Receipt'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <span className={`mobile-badge ${isPaid ? 'mobile-badge-success' : isPartial ? 'mobile-badge-warning' : 'mobile-badge-error'}`}>
                {(bill.status || 'unpaid').toUpperCase()}
              </span>
              <button
                className="mobile-btn mobile-btn-secondary"
                onClick={() => navigate(`/mobile/create-bill?edit=${bill.id}`)}
                style={{ minHeight: '30px', padding: '0 8px', fontSize: '0.72rem', color: 'var(--accent-secondary)' }}
              >
                <Pencil size={12} /> Edit Bill
              </button>
            </div>
          </div>

          {/* Amount Overview Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL INVOICE</div>
              <div className="currency-num" style={{ fontSize: '1.3rem', color: '#ffffff', textShadow: '0 0 8px rgba(255, 47, 176, 0.4)' }}>
                ₹{totalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>BALANCE DUE</div>
              <div className="currency-num" style={{ fontSize: '1.3rem', color: balanceDue > 0 ? 'var(--error)' : 'var(--success)', textShadow: balanceDue > 0 ? '0 0 8px rgba(255, 56, 96, 0.4)' : 'none' }}>
                ₹{balanceDue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information Card */}
        <div className="mobile-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-secondary)', margin: '0 0 10px 0', letterSpacing: '0.05em' }}>
            CLIENT INFORMATION
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '10px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <User size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {bill.customerName || bill.customer_name || customer?.name || 'Walk-in Customer'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Phone: {bill.customerPhone || customer?.phone || 'N/A'}
              </div>
              {customer?.email && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {customer.email}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Print Line Items Table */}
        <div className="mobile-card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.05em' }}>
              PRINT SPECIFICATIONS & LINE ITEMS
            </h3>
            <button
              onClick={() => setShowReturnModal(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={14} /> Item Return
            </button>
          </div>

          {(bill.items || []).map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '10px 0',
                borderBottom: idx < (bill.items || []).length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {item.itemName || item.name || item.item_name || item.description || 'Print Item'}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span className="mobile-badge mobile-badge-info" style={{ fontSize: '0.65rem' }}>
                    {(item.printType || item.print_type || 'Color').toUpperCase()}
                  </span>
                  <span className="mobile-badge mobile-badge-warning" style={{ fontSize: '0.65rem' }}>
                    {(item.sides || 'Single').toUpperCase()}
                  </span>
                  {Number(item.gstRate || item.gst_percent || 0) > 0 && (
                    <span className="mobile-badge" style={{ fontSize: '0.65rem', background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-tertiary)' }}>
                      GST {item.gstRate || item.gst_percent}%
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>
                    Qty: {item.qty || 1} × ₹{Number(item.unitPrice || item.unit_price || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="currency-num" style={{ fontSize: '1rem', color: '#ffffff' }}>
                ₹{Number(item.amount || 0).toLocaleString('en-IN')}
              </div>
            </div>
          ))}

          {/* Pricing Breakdown Summary */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span>
              <span className="currency-num">₹{Number(bill.subtotal || bill.total || 0).toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Discount Applied</span>
                <button
                  onClick={() => setShowPostDiscountModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                >
                  (+ Edit Discount)
                </button>
              </div>
              <span className="currency-num">-₹{Number(bill.discountValue || bill.discount_value || bill.discount || 0).toFixed(2)}</span>
            </div>

            {Number(bill.gstAmount || bill.gst_amount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--accent-secondary)' }}>
                <span>GST Tax</span>
                <span className="currency-num">+₹{Number(bill.gstAmount || bill.gst_amount).toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', paddingTop: '6px', borderTop: '1px dashed var(--border)' }}>
              <span>Grand Total</span>
              <span className="currency-num" style={{ color: 'var(--accent-primary)' }}>₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment History & Timeline */}
        <div className="mobile-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--success)', margin: '0 0 12px 0', letterSpacing: '0.05em' }}>
            PAYMENT SETTLEMENT TIMELINE
          </h3>

          {billPayments.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              No payments recorded yet for this invoice.
            </p>
          ) : (
            billPayments.map((p, pIdx) => (
              <div
                key={p.id || pIdx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: pIdx < billPayments.length - 1 ? '1px solid var(--border)' : 'none'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.notes || 'Payment Received'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Date: {p.date} • Cash: ₹{Number(p.cashAmount || p.cash_amount || 0).toFixed(2)} | UPI: ₹{Number(p.upiAmount || p.upi_amount || 0).toFixed(2)}
                  </div>
                </div>
                <div className="currency-num" style={{ fontSize: '0.95rem', color: 'var(--success)' }}>
                  +₹{Number(p.totalPaid || p.total_paid || 0).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 'calc(var(--bottom-nav-height) + 10px)',
          display: 'grid',
          gridTemplateColumns: balanceDue > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
          gap: '8px',
          background: 'rgba(12, 6, 24, 0.95)',
          backdropFilter: 'blur(16px)',
          padding: '10px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* PDF Export Button */}
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={handleExportPDF}
          disabled={isExportingPdf}
          style={{ minHeight: '44px', fontSize: '0.8rem', padding: '0 8px' }}
        >
          <Download size={16} /> PDF
        </button>

        {/* Record Payment Button */}
        {balanceDue > 0 && (
          <button
            className="mobile-btn mobile-btn-secondary"
            onClick={() => setShowPaymentModal(true)}
            style={{ minHeight: '44px', fontSize: '0.8rem', padding: '0 8px', borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' }}
          >
            <Wallet size={16} /> PAY
          </button>
        )}

        {/* Share UPI QR Button */}
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => setShowUpiModal(true)}
          style={{ minHeight: '44px', fontSize: '0.8rem', padding: '0 8px' }}
        >
          <QrCode size={16} /> UPI QR
        </button>
      </div>

      {/* Record Payment Bottom Sheet Drawer */}
      <BottomSheet
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={`Record Payment — Bill #${bill.invoiceNumber || bill.invoice_number || bill.id}`}
      >
        <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OUTSTANDING BALANCE</span>
            <span className="currency-num" style={{ fontSize: '1.2rem', color: 'var(--error)' }}>
              ₹{balanceDue.toFixed(2)}
            </span>
          </div>

          <button
            type="button"
            className="mobile-btn mobile-btn-secondary"
            onClick={handleQuickFullPayPrefill}
            style={{ fontSize: '0.82rem', minHeight: '38px', color: 'var(--accent-secondary)' }}
          >
            Auto Fill Full Balance (₹{balanceDue.toFixed(2)})
          </button>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CASH PAYMENT AMOUNT (INR)
            </label>
            <input
              type="number"
              step="0.01"
              className="mobile-input currency-num"
              placeholder="0.00"
              value={payCashAmount}
              onChange={(e) => setPayCashAmount(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              UPI DIGITAL AMOUNT (INR)
            </label>
            <input
              type="number"
              step="0.01"
              className="mobile-input currency-num"
              placeholder="0.00"
              value={payUpiAmount}
              onChange={(e) => setPayUpiAmount(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PAYMENT NOTES / REFERENCE
            </label>
            <input
              type="text"
              className="mobile-input"
              placeholder="e.g. Cash received at counter"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" style={{ marginTop: '8px' }} disabled={isCreatingPayment}>
            {isCreatingPayment ? 'Saving Payment...' : 'Confirm & Save Payment Record'}
          </button>
        </form>
      </BottomSheet>

      {/* Post-Bill Discount Bottom Sheet */}
      <BottomSheet
        isOpen={showPostDiscountModal}
        onClose={() => setShowPostDiscountModal(false)}
        title="Apply Post-Bill Discount"
      >
        <form onSubmit={handleApplyPostDiscountSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DISCOUNT TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${postDiscountType === 'flat' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPostDiscountType('flat')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Flat Amount (₹)
              </button>
              <button
                type="button"
                className={`mobile-btn ${postDiscountType === 'percent' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setPostDiscountType('percent')}
                style={{ minHeight: '38px', fontSize: '0.82rem' }}
              >
                Percentage (%)
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              DISCOUNT VALUE
            </label>
            <input
              type="number"
              step="0.01"
              className="mobile-input currency-num"
              placeholder={postDiscountType === 'flat' ? '50.00' : '10%'}
              value={postDiscountValue}
              onChange={(e) => setPostDiscountValue(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary" disabled={isUpdatingBill}>
            {isUpdatingBill ? 'Applying...' : 'Apply Discount to Invoice'}
          </button>
        </form>
      </BottomSheet>

      {/* Item Return / Credit Note Bottom Sheet */}
      <BottomSheet
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Create Credit Note / Item Return"
      >
        <form onSubmit={handleCreateCreditNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            Select return quantity for line items:
          </p>

          {(bill.items || []).map(item => (
            <div key={item.id || item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.itemName || item.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ordered Qty: {item.qty}</div>
              </div>
              <input
                type="number"
                min="0"
                max={item.qty}
                className="mobile-input currency-num"
                style={{ width: '70px', padding: '4px 8px' }}
                value={returnQtys[item.id || item.itemId] || 0}
                onChange={(e) => setReturnQtys({ ...returnQtys, [item.id || item.itemId]: e.target.value })}
              />
            </div>
          ))}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SETTLEMENT MODE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`mobile-btn ${returnSettlement === 'advance' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setReturnSettlement('advance')}
                style={{ minHeight: '38px', fontSize: '0.8rem' }}
              >
                Add Customer Credit
              </button>
              <button
                type="button"
                className={`mobile-btn ${returnSettlement === 'cash' ? 'mobile-btn-primary' : 'mobile-btn-secondary'}`}
                onClick={() => setReturnSettlement('cash')}
                style={{ minHeight: '38px', fontSize: '0.8rem' }}
              >
                Direct Cash Refund
              </button>
            </div>
          </div>

          <button type="submit" className="mobile-btn mobile-btn-primary">
            Confirm Item Return & Issue Credit
          </button>
        </form>
      </BottomSheet>

      {/* Share UPI QR Modal */}
      <BottomSheet
        isOpen={showUpiModal}
        onClose={() => setShowUpiModal(false)}
        title="Scan UPI QR Code to Pay"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-lg)', display: 'inline-block', marginBottom: '16px' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`}
              alt="UPI Payment QR Code"
              style={{ width: '180px', height: '180px', display: 'block' }}
            />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Payee UPI ID: <strong className="currency-num" style={{ color: 'var(--accent-secondary)' }}>{upiId}</strong>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '16px' }} className="currency-num">
            Amount Due: ₹{balanceDue.toFixed(2)}
          </div>

          <button
            className="mobile-btn mobile-btn-primary"
            onClick={() => {
              window.open(upiUri, '_self')
            }}
          >
            Open UPI App (GPay / PhonePe / Paytm)
          </button>
        </div>
      </BottomSheet>
    </MobileLayout>
  )
}
