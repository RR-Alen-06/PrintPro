import React from 'react'
import { X, Printer, MessageSquare, CheckCircle, FileText, ArrowDownLeft, ArrowUpRight } from 'lucide-react'

interface ZReportModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  business: any
  summary: {
    billsCount: number
    grossSales: number
    discounts: number
    netSales: number
    cashCollected: number
    upiCollected: number
    advanceCollected: number
    totalExpenses: number
    cashExpenses: number
    upiExpenses: number
    totalRefunds: number
    openingCash: number
    closingCash: number
  }
  showToast: (msg: string, type?: string) => void
}

export const ZReportModal: React.FC<ZReportModalProps> = ({
  isOpen,
  onClose,
  date,
  business,
  summary,
  showToast,
}) => {
  if (!isOpen) return null

  const handleShareWhatsApp = () => {
    let msg = `*DAILY FINANCIAL Z-REPORT - ${business?.shopName || 'PrintPro'}*\n`
    msg += `*Date:* ${date}\n`
    msg += `*Generated:* ${new Date().toLocaleTimeString()}\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*SALES SUMMARY:*\n`
    msg += `• Total Invoices: ${summary.billsCount}\n`
    msg += `• Gross Billed: ₹${summary.grossSales.toFixed(2)}\n`
    if (summary.discounts > 0) {
      msg += `• Discounts: -₹${summary.discounts.toFixed(2)}\n`
    }
    msg += `• Net Sales: ₹${summary.netSales.toFixed(2)}\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*COLLECTIONS:*\n`
    msg += `• Cash Inflow: ₹${summary.cashCollected.toFixed(2)}\n`
    msg += `• Digital UPI: ₹${summary.upiCollected.toFixed(2)}\n`
    if (summary.advanceCollected > 0) {
      msg += `• Advances Received: ₹${summary.advanceCollected.toFixed(2)}\n`
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*PAYOUTS & OUTFLOWS:*\n`
    msg += `• Expenses: ₹${summary.totalExpenses.toFixed(2)} (Cash: ₹${summary.cashExpenses.toFixed(2)}, UPI: ₹${summary.upiExpenses.toFixed(2)})\n`
    if (summary.totalRefunds > 0) {
      msg += `• Customer Refunds: ₹${summary.totalRefunds.toFixed(2)}\n`
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*CASH DRAWER RECONCILIATION:*\n`
    msg += `• Opening Balance: ₹${summary.openingCash.toFixed(2)}\n`
    msg += `• *Net Closing Cash in Drawer: ₹${summary.closingCash.toFixed(2)}*\n`
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`

    const encoded = encodeURIComponent(msg)
    const phone = business?.phone || ''
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`, '_blank')
    showToast('Z-Report dispatched to WhatsApp!', 'success')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--aurora-cyan, #00f0ff)" />
            <h3 style={{ margin: 0 }}>Daily Financial Z-Report</h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Printable Report Paper Layout */}
          <div
            id="z-report-printable"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '18px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              marginBottom: '16px',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
                {business?.shopName || 'PRINTPRO ERP'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DAILY CLOSING Z-REPORT</div>
              <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>Date: {date}</div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Invoices Generated:</span>
                <strong>{summary.billsCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Gross Billed:</span>
                <strong>₹{summary.grossSales.toFixed(2)}</strong>
              </div>
              {summary.discounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--text-muted)' }}>
                  <span>Discounts Given:</span>
                  <span>-₹{summary.discounts.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '4px', fontWeight: 700 }}>
                <span>Net Sales Revenue:</span>
                <span style={{ color: 'var(--aurora-cyan, #00f0ff)' }}>₹{summary.netSales.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>COLLECTIONS BREAKDOWN:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Pure Cash In:</span>
                <span>₹{summary.cashCollected.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Digital UPI In:</span>
                <span>₹{summary.upiCollected.toFixed(2)}</span>
              </div>
              {summary.advanceCollected > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Advances Deposited:</span>
                  <span>₹{summary.advanceCollected.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>PAYOUTS & OUTFLOWS:</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Expenses (Cash: ₹{summary.cashExpenses.toFixed(2)}):</span>
                <span style={{ color: 'var(--aurora-amber, #f59e0b)' }}>₹{summary.totalExpenses.toFixed(2)}</span>
              </div>
              {summary.totalRefunds > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Customer Refunds:</span>
                  <span style={{ color: 'var(--aurora-pink, #ff2fb0)' }}>₹{summary.totalRefunds.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: 'var(--text-muted)' }}>
                <span>Opening Cash Drawer:</span>
                <span>₹{summary.openingCash.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: '#10b981', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                <span>CLOSING CASH IN DRAWER:</span>
                <span>₹{summary.closingCash.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={14} /> Print Report
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleShareWhatsApp}
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#ffffff' }}
              >
                <MessageSquare size={14} /> WhatsApp Owner
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
