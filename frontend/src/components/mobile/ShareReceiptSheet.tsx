import React, { useState, useMemo } from 'react'
import BottomSheet from './BottomSheet'
import {
  MessageCircle, Share2, Copy, Check, QrCode,
  FileText, SlidersHorizontal, ChevronDown, ChevronUp,
  Receipt, AlertTriangle, Layers
} from 'lucide-react'
import { formatWhatsAppReceipt, getUpiQrCodeUrl, getUpiPaymentLink, ReceiptFormatOptions } from '../../utils/receiptFormatter'
import { useAppContext } from '../../context/AppContext'

export interface ShareReceiptSheetProps {
  bill: Record<string, unknown>
  isOpen: boolean
  onClose: () => void
  business?: Record<string, unknown>
  settings?: Record<string, unknown>
  customers?: Array<Record<string, unknown>>
  payments?: Array<Record<string, unknown>>
  bills?: Array<Record<string, unknown>>
}

export default function ShareReceiptSheet({
  bill,
  isOpen,
  onClose,
  business = {},
  settings = {},
  customers = [],
  payments = [],
  bills = []
}: ShareReceiptSheetProps) {
  const { showToast } = useAppContext()
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  // Template State
  const [template, setTemplate] = useState<'itemized' | 'concise' | 'due_reminder' | 'formal_statement'>('itemized')
  
  // Advance Options Toggles
  const [showAdvanceOptions, setShowAdvanceOptions] = useState(false)
  const [includePreviousDues, setIncludePreviousDues] = useState(true)
  const [includeAdvanceBalance, setIncludeAdvanceBalance] = useState(true)
  const [includeUpiPayLink, setIncludeUpiPayLink] = useState(true)
  const [includeItemSpecs, setIncludeItemSpecs] = useState(true)
  const [showQrCode, setShowQrCode] = useState(false)

  const custId = bill ? (bill.customerId || bill.customer_id) : null
  const customer = customers.find(c => String(c.id) === String(custId) || (c.customerCode && String(c.customerCode) === String(custId)))
  const rawPhone = ((customer?.phone || (bill && (bill.customerPhone || bill.customer_phone))) || '') as string
  const cleanPhone = rawPhone.replace(/[^0-9]/g, '')
  const shopName = (business?.shopName || settings?.shopName || 'PRINTPRO') as string
  const upiId = (business?.upiId || settings?.upiId || '') as string
  const billTotal = Number(bill ? bill.total : 0)
  const amountPaid = Number(bill ? (bill.amountPaid !== undefined ? bill.amountPaid : (bill.amount_paid !== undefined ? bill.amount_paid : 0)) : 0)
  const remainingDue = Math.max(0, billTotal - amountPaid)
  const billNumber = (bill ? (bill.invoiceNumber || bill.invoice_number || bill.id || '') : '') as string

  // Dynamic receipt options
  const receiptOptions: ReceiptFormatOptions = useMemo(() => ({
    template,
    includePreviousDues,
    includeAdvanceBalance,
    includeUpiPayLink,
    includeItemSpecs,
  }), [template, includePreviousDues, includeAdvanceBalance, includeUpiPayLink, includeItemSpecs])

  // Build live receipt text
  const liveReceiptText = useMemo(() => {
    if (!bill) return ''
    return formatWhatsAppReceipt(bill, settings, business, '', {
      bills,
      payments,
      customers
    }, receiptOptions)
  }, [bill, settings, business, bills, payments, customers, receiptOptions])

  // QR Code URL
  const qrCodeUrl = useMemo(() => {
    if (!upiId || remainingDue <= 0) return ''
    return getUpiQrCodeUrl(upiId, shopName, remainingDue, billNumber)
  }, [upiId, shopName, remainingDue, billNumber])

  if (!bill) return null

  const handleShareWhatsApp = () => {
    setIsSharing(true)
    try {
      const encodedText = encodeURIComponent(liveReceiptText)
      const whatsappUrl = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`

      window.open(whatsappUrl, '_blank')
      showToast('Opening WhatsApp...', 'info')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open WhatsApp'
      showToast(msg, 'error')
    } finally {
      setIsSharing(false)
    }
  }

  const handleNativeShare = async () => {
    setIsSharing(true)
    try {
      const title = `Invoice #${billNumber}`
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title,
            text: liveReceiptText,
          })
          showToast('Shared successfully!', 'success')
          onClose()
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name !== 'AbortError') {
            await copyFallback(liveReceiptText)
          }
        }
      } else {
        await copyFallback(liveReceiptText)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not share receipt'
      showToast(msg, 'error')
    } finally {
      setIsSharing(false)
    }
  }

  const copyFallback = async (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast('Receipt copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Share Invoice #${billNumber}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
        {/* Template Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
          {[
            { id: 'itemized', label: '🧾 Full POS', desc: 'Itemized' },
            { id: 'concise', label: '⚡ Concise', desc: 'Compact' },
            { id: 'due_reminder', label: '⚠️ Due Remind', desc: 'Balance Due' },
            { id: 'formal_statement', label: '📋 Statement', desc: 'Accounting' },
          ].map((t) => {
            const isSelected = template === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplate(t.id as 'itemized' | 'concise' | 'due_reminder' | 'formal_statement')}
                style={{
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: isSelected ? 'linear-gradient(135deg, rgba(255, 47, 176, 0.25) 0%, rgba(0, 240, 255, 0.25) 100%)' : 'var(--bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Advance Options Accordion Toggle */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setShowAdvanceOptions(!showAdvanceOptions)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <SlidersHorizontal size={14} style={{ color: 'var(--accent-secondary)' }} />
              Advance Options & Dues Customization
            </span>
            {showAdvanceOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanceOptions && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includePreviousDues}
                  onChange={(e) => setIncludePreviousDues(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
                />
                <span>Include Past Ledger Outstanding Balance</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeAdvanceBalance}
                  onChange={(e) => setIncludeAdvanceBalance(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
                />
                <span>Include Customer Advance Wallet Balance</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeUpiPayLink}
                  onChange={(e) => setIncludeUpiPayLink(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
                />
                <span>Include Direct UPI Intent Link (GPay/PhonePe)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeItemSpecs}
                  onChange={(e) => setIncludeItemSpecs(e.target.checked)}
                  style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
                />
                <span>Include Item Specifications (Print Type & Sides)</span>
              </label>

              {upiId && remainingDue > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--accent-secondary)', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    style={{ accentColor: 'var(--accent-secondary)', width: '15px', height: '15px' }}
                  />
                  <span>Show On-Screen UPI Payment QR Code</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* UPI QR Code Preview Box */}
        {showQrCode && qrCodeUrl && (
          <div style={{ background: '#ffffff', color: '#000000', padding: '12px', borderRadius: 'var(--radius-md)', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: '4px' }}>Scan with GPay / PhonePe / Paytm</div>
            <img
              src={qrCodeUrl}
              alt="UPI QR Code"
              style={{ width: '160px', height: '160px', margin: '0 auto', display: 'block', borderRadius: '8px' }}
            />
            <div style={{ fontSize: '0.72rem', color: '#666666', marginTop: '4px' }}>UPI ID: {upiId} • Due: ₹{remainingDue.toFixed(2)}</div>
          </div>
        )}

        {/* Live Formatted Text Preview */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>MESSAGE PREVIEW</span>
            <button
              type="button"
              onClick={() => copyFallback(liveReceiptText)}
              style={{
                background: 'none',
                border: 'none',
                color: copied ? 'var(--success)' : 'var(--accent-secondary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre
            style={{
              maxHeight: '140px',
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px',
              fontSize: '0.72rem',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'pre-wrap',
              margin: 0
            }}
          >
            {liveReceiptText}
          </pre>
        </div>

        {/* Main Action: Send on WhatsApp */}
        <button
          onClick={handleShareWhatsApp}
          disabled={isSharing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid rgba(37, 211, 102, 0.5)',
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.25) 0%, rgba(37, 211, 102, 0.1) 100%)',
            color: '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            boxShadow: '0 0 20px rgba(37, 211, 102, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0
            }}
          >
            <MessageCircle size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#25D366' }}>
              Send on WhatsApp {cleanPhone ? `(${cleanPhone})` : ''}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              1-Tap instant dispatch to customer phone
            </div>
          </div>
        </button>

        {/* Secondary Actions: Native Share & Copy */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={handleNativeShare}
            disabled={isSharing}
            className="mobile-btn mobile-btn-secondary"
            style={{ minHeight: '38px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Share2 size={15} /> Native Share
          </button>
          <button
            onClick={() => copyFallback(liveReceiptText)}
            disabled={isSharing}
            className="mobile-btn mobile-btn-secondary"
            style={{ minHeight: '38px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {copied ? <Check size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
