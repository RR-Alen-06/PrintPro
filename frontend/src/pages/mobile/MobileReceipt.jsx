import React, { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../context/AppContext'
import { useBills } from '../../hooks/useBillsQuery'
import MobileLayout from '../../components/mobile/MobileLayout'
import { Printer, Share2, Download, ArrowLeft, Loader2 } from 'lucide-react'
import '../../styles/mobile.css'

export default function MobileReceipt() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const billId = searchParams.get('id')

  const { business, settings } = useAppContext()
  const { data: bills = [], isLoading: isLoadingBills } = useBills()

  const bill = useMemo(() => {
    return (bills || []).find(b => String(b.id) === String(billId) || String(b.invoiceNumber || b.invoice_number) === String(billId)) || bills[0]
  }, [bills, billId])

  if (isLoadingBills) {
    return (
      <MobileLayout title="Thermal Receipt" onSwitchToDesktop={() => navigate('/receipt')}>
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent-secondary)', margin: '0 auto 8px auto' }} />
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading receipt data...</p>
        </div>
      </MobileLayout>
    )
  }

  if (!bill) {
    return (
      <MobileLayout title="Thermal Receipt" onSwitchToDesktop={() => navigate('/receipt')}>
        <div className="mobile-card" style={{ textAlign: 'center', padding: '36px' }}>
          No bill found for receipt preview.
        </div>
      </MobileLayout>
    )
  }

  return (
    <MobileLayout title={`Receipt #${bill.invoiceNumber || bill.invoice_number || bill.id}`} onSwitchToDesktop={() => navigate(`/receipt?id=${bill.id}`)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button className="mobile-btn mobile-btn-secondary" onClick={() => navigate(-1)} style={{ width: 'auto', padding: '0 12px', minHeight: '34px', fontSize: '0.78rem' }}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className="mobile-btn mobile-btn-primary" onClick={() => window.print()} style={{ width: 'auto', padding: '0 12px', minHeight: '34px', fontSize: '0.78rem' }}>
          <Printer size={16} /> Thermal Print
        </button>
      </div>

      {/* Monospaced Thermal Slip Card */}
      <div
        className="mobile-card"
        style={{
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: '1.4',
          borderRadius: 'var(--radius-md)',
          padding: '20px 14px',
          boxShadow: '0 0 20px rgba(0,240,255,0.2)'
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>
          {business?.shopName || 'PRINTPRO NEO STATION'}
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '8px' }}>
          {business?.address || 'City Center Mall, Main St'} • Tel: {business?.phone || '+91 9876543210'}
        </div>
        {business?.gstin && (
          <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '8px' }}>
            GSTIN: {business.gstin}
          </div>
        )}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Inv: #{bill.invoiceNumber || bill.invoice_number || bill.id}</span>
          <span>Date: {bill.date}</span>
        </div>
        <div>Client: {bill.customerName || bill.customer_name || 'Walk-in Client'}</div>
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {(bill.items || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div>
              {item.itemName || item.name || item.item_name} x{item.qty || 1}
            </div>
            <div>₹{Number(item.amount || 0).toFixed(2)}</div>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>₹{Number(bill.subtotal || bill.total || 0).toFixed(2)}</span>
        </div>
        {Number(bill.discountValue || bill.discount_value || bill.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount:</span>
            <span>-₹{Number(bill.discountValue || bill.discount_value || bill.discount).toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', marginTop: '4px' }}>
          <span>TOTAL:</span>
          <span>₹{Number(bill.total || 0).toFixed(2)}</span>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        <div style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '12px' }}>
          *** THANK YOU FOR YOUR BUSINESS ***
        </div>
      </div>
    </MobileLayout>
  )
}
