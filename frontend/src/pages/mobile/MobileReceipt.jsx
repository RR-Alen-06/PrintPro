import React, { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { usePayments } from '../../hooks/useEntitiesQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import ShareReceiptSheet from '../../components/mobile/ShareReceiptSheet'
import LedgerBillCard from '../../components/common/LedgerBillCard'
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
    if (billId) {
      return (bills || []).find(b => String(b.id) === String(billId) || String(b.invoiceNumber || b.invoice_number) === String(billId)) || null
    }
    return bills[0] || null
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
          <p style={{ margin: '0 0 14px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {billId ? `Invoice #${billId} not found.` : 'No invoice selected for receipt preview.'}
          </p>
          <button className="mobile-btn mobile-btn-secondary" onClick={() => navigate('/mobile/billing')}>
            Browse Invoices
          </button>
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

      {/* Ledger-Style Bill Card */}
      <div style={{ marginBottom: '24px' }}>
        <LedgerBillCard
          bill={bill}
          business={business}
          settings={settings}
          customers={customers}
          bills={bills}
          payments={payments}
        />
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

