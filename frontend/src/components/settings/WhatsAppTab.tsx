import React from 'react'
import { MessageSquare, CheckCircle, Save } from 'lucide-react'
import { ReminderService } from '../../services/reminderService'

export interface WhatsAppTemplateData {
  whatsappGreeting: string
  whatsappFooter: string
  includeUpiInWhatsApp: boolean
}

interface WhatsAppTabProps {
  waTemplates: WhatsAppTemplateData
  setWaTemplates: React.Dispatch<React.SetStateAction<WhatsAppTemplateData>>
  handleWaSave: (e: React.FormEvent) => Promise<void>
  waSaved: boolean
  waPreviewTab: 'invoice' | 'reminder'
  setWaPreviewTab: React.Dispatch<React.SetStateAction<'invoice' | 'reminder'>>
  invPrefix?: string
  business: {
    shopName?: string
    ownerName?: string
    phone?: string
    upiId?: string
    [key: string]: any
  }
}

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
  waTemplates,
  setWaTemplates,
  handleWaSave,
  waSaved,
  waPreviewTab,
  setWaPreviewTab,
  invPrefix = 'INV',
  business,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(37, 211, 102, 0.15)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#25D366',
          }}
        >
          <MessageSquare size={18} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>WhatsApp &amp; Reminder Templates</h2>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Customize automated invoice receipts, overdue payment reminders, and UPI collection links.
          </p>
        </div>
      </div>

      <form onSubmit={handleWaSave} autoComplete="off">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '16px' }}>
          <div>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Greeting Header Template</label>
              <input
                className="form-input"
                type="text"
                value={waTemplates.whatsappGreeting}
                onChange={(e) => setWaTemplates((c) => ({ ...c, whatsappGreeting: e.target.value }))}
                placeholder="Dear *{customer_name}*,"
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Tag <code>{'{customer_name}'}</code> will be auto-replaced with the customer's name.
              </p>
            </div>

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label">Closing Footer Template</label>
              <textarea
                className="form-input"
                rows={3}
                value={waTemplates.whatsappFooter}
                onChange={(e) => setWaTemplates((c) => ({ ...c, whatsappFooter: e.target.value }))}
                placeholder="Thank you for choosing *{shop_name}*! For queries, contact us at {phone}."
                style={{ resize: 'vertical' }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Tag <code>{'{shop_name}'}</code> will be auto-replaced with your shop name.
              </p>
            </div>

            <div className="form-group">
              <label className="checkbox-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={waTemplates.includeUpiInWhatsApp}
                  onChange={(e) => setWaTemplates((c) => ({ ...c, includeUpiInWhatsApp: e.target.checked }))}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: 600 }}>Include 1-Click UPI Pay Link for Balances</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', marginLeft: '26px' }}>
                Automatically attaches your UPI VPA (<code>{business.upiId || 'Not configured'}</code>) to messages when an invoice or ledger balance is due.
              </p>
            </div>
          </div>

          {/* Live Preview Box */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#25D366', letterSpacing: '0.05em' }}>
                LIVE WHATSAPP PREVIEW
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setWaPreviewTab('invoice')}
                  style={{
                    background: waPreviewTab === 'invoice' ? '#25D366' : 'transparent',
                    color: waPreviewTab === 'invoice' ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Invoice Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setWaPreviewTab('reminder')}
                  style={{
                    background: waPreviewTab === 'reminder' ? '#25D366' : 'transparent',
                    color: waPreviewTab === 'reminder' ? '#000' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Ledger Reminder
                </button>
              </div>
            </div>

            <div
              style={{
                background: '#0b141a',
                border: '1px solid #1f2c34',
                borderRadius: '8px',
                padding: '12px 14px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: '1.45',
                color: '#e9edef',
                whiteSpace: 'pre-wrap',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {waPreviewTab === 'invoice'
                ? ReminderService.buildInvoiceMessage(
                    {
                      invoiceNumber: `${invPrefix}-000042`,
                      date: new Date().toISOString(),
                      customerName: 'Rahul Sharma',
                      items: [
                        { name: 'A4 Color Print', qty: 10, rate: 10, amount: 100 },
                        { name: 'Spiral Binding', qty: 1, rate: 40, amount: 40 },
                      ],
                      total: 140,
                      paidTotal: 40,
                      balance: 100,
                    },
                    business,
                    waTemplates
                  )
                : ReminderService.buildLedgerReminderMessage(
                    { name: 'Rahul Sharma', phone: '9876543210' },
                    -350,
                    business,
                    waTemplates
                  )}
            </div>
          </div>
        </div>

        {waSaved && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              marginTop: '12px',
              background: 'var(--success-bg)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--success)',
              fontSize: '0.875rem',
            }}
          >
            <CheckCircle size={16} /> WhatsApp reminder templates saved!
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
          <Save size={16} /> Save WhatsApp Templates
        </button>
      </form>
    </div>
  )
}
export default WhatsAppTab
