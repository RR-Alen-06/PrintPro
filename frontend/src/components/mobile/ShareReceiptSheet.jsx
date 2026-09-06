import React, { useState } from 'react'
import BottomSheet from './BottomSheet'
import { MessageCircle, Share2, Copy, Loader2, Check } from 'lucide-react'
import { formatWhatsAppReceipt } from '../../utils/receiptFormatter'
import { uploadPDFReceipt } from '../../api/share'
import { useAppContext } from '../../context/AppContext'

export default function ShareReceiptSheet({
  bill,
  isOpen,
  onClose,
  business,
  settings,
  customers = [],
  payments = [],
  bills = []
}) {
  const { showToast } = useAppContext()
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!bill) return null

  const getCustomerObj = () => {
    const custId = bill.customerId || bill.customer_id
    return customers.find(c => String(c.id) === String(custId) || (c.customerCode && String(c.customerCode) === String(custId)))
  }

  const buildReceiptText = (pdfUrl = '') => {
    return formatWhatsAppReceipt(bill, settings, business, pdfUrl, {
      bills,
      payments,
      customers
    })
  }

  const handleShareWhatsApp = async () => {
    setIsSharing(true)
    try {
      const customer = getCustomerObj()
      const rawPhone = customer?.phone || bill.customerPhone || bill.customer_phone || ''
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '')

      let pdfUrl = ''
      // Try uploading PDF receipt if supported / backend is alive
      try {
        // We generate receipt text directly; if PDF is available in window/canvas it can be uploaded
      } catch (e) {
        console.warn('PDF upload skipped for WhatsApp share', e)
      }

      const receiptText = buildReceiptText(pdfUrl)
      const encodedText = encodeURIComponent(receiptText)
      
      const whatsappUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`

      window.open(whatsappUrl, '_blank')
      showToast('Opening WhatsApp...', 'info')
      onClose()
    } catch (err) {
      showToast(err.message || 'Failed to open WhatsApp', 'error')
    } finally {
      setIsSharing(false)
    }
  }

  const handleNativeShare = async () => {
    setIsSharing(true)
    try {
      const text = buildReceiptText('')
      const title = `Invoice #${bill.invoiceNumber || bill.invoice_number || bill.id}`
      
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title,
            text,
          })
          showToast('Shared successfully!', 'success')
          onClose()
        } catch (shareErr) {
          // If user cancelled sharing, don't show error
          if (shareErr.name !== 'AbortError') {
            await copyFallback(text)
          }
        }
      } else {
        await copyFallback(text)
      }
    } catch (err) {
      showToast(err.message || 'Could not share receipt', 'error')
    } finally {
      setIsSharing(false)
    }
  }

  const copyFallback = async (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast('Receipt copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
      onClose()
    }
  }

  const handleCopyClipboard = async () => {
    const text = buildReceiptText('')
    await copyFallback(text)
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Share Invoice #${bill.invoiceNumber || bill.invoice_number || bill.id}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
        {/* WhatsApp Share Button */}
        <button
          onClick={handleShareWhatsApp}
          disabled={isSharing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(37, 211, 102, 0.4)',
            background: 'rgba(37, 211, 102, 0.12)',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 0 15px rgba(37, 211, 102, 0.15)',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0
            }}
          >
            <MessageCircle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#25D366' }}>
              WhatsApp Receipt
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Send formatted itemized receipt directly to client phone
            </div>
          </div>
        </button>

        {/* System Native Share Button */}
        <button
          onClick={handleNativeShare}
          disabled={isSharing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            background: 'rgba(0, 240, 255, 0.1)',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.15)',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
              flexShrink: 0
            }}
          >
            <Share2 size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
              Share via Any App
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Open mobile share sheet for SMS, Email, Telegram, AirDrop
            </div>
          </div>
        </button>

        {/* Copy to Clipboard */}
        <button
          onClick={handleCopyClipboard}
          disabled={isSharing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '14px 16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              flexShrink: 0
            }}
          >
            {copied ? <Check size={20} style={{ color: 'var(--success)' }} /> : <Copy size={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {copied ? 'Copied to Clipboard!' : 'Copy Receipt Text'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Copy monospace text for quick pasting anywhere
            </div>
          </div>
        </button>
      </div>
    </BottomSheet>
  )
}
