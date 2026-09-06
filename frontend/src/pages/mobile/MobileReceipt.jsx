import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePayments } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import ShareReceiptSheet from '../../components/mobile/ShareReceiptSheet'
import { Printer, Share2, ArrowLeft, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileReceipt() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const billId = searchParams.get('id')

  const { business, settings } = useAppContext()
  const { data: bills = [], isLoading: isLoadingBills } = useBills()
  const { data: customers = [] } = useCustomers()
  const { data: payments = [] } = usePayments()

  const [showShareModal, setShowShareModal] = useState(false)

  const bill = useMemo(() => {
    return (bills || []).find(b => String(b.id) === String(billId) || String(b.invoiceNumber || b.invoice_number) === String(billId)) || bills[0]
  }, [bills, billId])

  if (isLoadingBills) {
    return (
      <MobileLayout title="Thermal Receipt">
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading receipt data...</p>
        </div>
      </MobileLayout>
    )
  }

  if (!bill) {
    return (
      <MobileLayout title="Thermal Receipt">
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px' }}>
          No bill found for receipt preview.
        </div>
      </MobileLayout>
    )
  }

  const discountAmount = Number(bill.discountValue || bill.discount_value || bill.discount || 0)
  const gstAmount = Number(bill.gstAmount || bill.gst_amount || 0)
  const advanceUsed = Number(bill.advanceDeducted || bill.advance_deducted || bill.advanceUsed || 0)
  const amountPaid = Number(bill.amountPaid || bill.amount_paid || 0)
  const balanceDue = Number(bill.balance !== undefined ? bill.balance : Math.max(0, Number(bill.total || 0) - amountPaid))

  return (
    <MobileLayout title={`Receipt #${bill.invoiceNumber || bill.invoice_number || bill.id}`}>
      {/* Top Action Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => navigate(-1)}
          style={{ width: 'auto', padding: '0 12px', minHeight: '36px', fontSize: '0.78rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <button
          className="mobile-btn mobile-btn-secondary"
          onClick={() => setShowShareModal(true)}
          style={{ minHeight: '36px', fontSize: '0.78rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
        >
          <Share2 size={16} /> Share
        </button>
        <button
          className="mobile-btn mobile-btn-primary"
          onClick={() => window.print()}
          style={{ minHeight: '36px', fontSize: '0.78rem' }}
        >
          <Printer size={16} /> Print Slip
        </button>
      </div>

      {/* Monospaced Thermal Slip Card */}
      <div
        className="mobile-card"
        style={{
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'Courier Prime, Courier New, monospace',
          fontSize: '0.85rem',
          lineHeight: '1.4',
          borderRadius: 'var(--radius-md)',
          padding: '20px 14px',
          boxShadow: '0 0 20px rgba(0,240,255,0.15)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px', letterSpacing: '0.05em' }}>
          {business?.shopName || 'PRINTPRO STATION'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '4px' }}>
          {business?.address || 'Main Road Center'}
        </div>
        {business?.phone && (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '4px' }}>
            Tel: {business.phone}
          </div>
        )}
        {business?.gstin && (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '4px' }}>
            GSTIN: {business.gstin}
          </div>
        )}
        {business?.upiId && (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '6px' }}>
            UPI ID: {business.upiId}
          </div>
        )}

        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
          <span><strong>Inv:</strong> #{bill.invoiceNumber || bill.invoice_number || bill.id}</span>
          <span><strong>Date:</strong> {bill.date}</span>
        </div>
        <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
          <strong>Client:</strong> {bill.customerName || bill.customer_name || 'Walk-in Client'}
        </div>

        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* Itemized Specifications */}
        <div style={{ fontWeight: 'bold', fontSize: '0.78rem', marginBottom: '6px' }}>
          ITEM SPECIFICATIONS
        </div>

        {(bill.items || []).map((item, idx) => {
          const pType = (item.printType || item.print_type || 'Color').toUpperCase()
          const pSides = (item.sides || 'Single').toUpperCase()
          const uPrice = Number(item.unitPrice || item.unit_price || 0).toFixed(2)
          const amt = Number(item.amount || 0).toFixed(2)

          return (
            <div key={idx} style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>{idx + 1}. {item.itemName || item.name || item.item_name || 'Print Item'}</span>
                <span>₹{amt}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#444444', paddingLeft: '14px' }}>
                [{pType}] [{pSides}] • Qty: {item.qty || 1} × ₹{uPrice}
              </div>
            </div>
          )
        })}

        <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

        {/* Financial Breakdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
          <span>Subtotal:</span>
          <span>₹{Number(bill.subtotal || bill.total || 0).toFixed(2)}</span>
        </div>

        {discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
            <span>Discount:</span>
            <span>-₹{discountAmount.toFixed(2)}</span>
          </div>
        )}

        {advanceUsed > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
            <span>Advance Deducted:</span>
            <span>-₹{advanceUsed.toFixed(2)}</span>
          </div>
        )}

        {gstAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
            <span>GST Tax:</span>
            <span>+₹{gstAmount.toFixed(2)}</span>
          </div>
        )}

        <div style={{ borderTop: '1px solid #000000', margin: '6px 0 4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem' }}>
          <span>TOTAL:</span>
          <span>₹{Number(bill.total || 0).toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '4px' }}>
          <span>Amount Paid:</span>
          <span>₹{amountPaid.toFixed(2)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: balanceDue > 0 ? 'bold' : 'normal', color: balanceDue > 0 ? '#b91c1c' : '#000000', marginTop: '2px' }}>
          <span>Balance Due:</span>
          <span>₹{balanceDue.toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000000', margin: '10px 0' }} />

        {settings?.footerNotes && (
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#555555', marginBottom: '6px' }}>
            {settings.footerNotes}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
          *** THANK YOU FOR YOUR BUSINESS ***
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#666666', marginTop: '2px' }}>
          Powered by PrintPro ERP
        </div>
      </div>

      {/* Share Drawer */}
      <ShareReceiptSheet
        bill={bill}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        business={business}
        settings={settings}
        customers={customers}
        payments={payments}
        bills={bills}
      />
    </MobileLayout>
  )
}

