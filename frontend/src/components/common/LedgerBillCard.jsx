import React from 'react'
import { LoyaltyService } from '../../services/loyaltyService'

export default function LedgerBillCard({
  bill,
  business = {},
  settings = {},
  customers = [],
  bills = [],
  payments = []
}) {
  if (!bill) return null

  // 1. Find Customer Info
  const customerId = bill.customerId || bill.customer_id
  const customer = customers.find(c => String(c.id) === String(customerId) || (c.customerCode && String(c.customerCode) === String(customerId)))
  const customerDisplay = bill.customerName || bill.customer_name || customer?.name || 'Walk-in Customer'
  const customerCode = customer?.customerCode || customer?.code || ''
  const customerSuffix = customerCode ? ` (${customerCode})` : ''

  // 2. Previous Outstanding Calculation
  const currentBillDate = bill.date ? new Date(bill.date) : new Date()
  const pastBills = bills.filter(b =>
    !b.deleted &&
    String(b.customerId || b.customer_id) === String(customerId) &&
    String(b.id) !== String(bill.id) &&
    (b.date ? new Date(b.date) < currentBillDate : true)
  )
  const previousOutstanding = pastBills.reduce((sum, b) => sum + Number(b.balance !== undefined ? b.balance : Math.max(0, Number(b.total || 0) - Number(b.amountPaid || b.amount_paid || 0))), 0)

  // 3. Current Bill Totals
  const currentBill = Number(bill.total || 0)
  const totalAmountDue = previousOutstanding + currentBill

  // 4. Payments for this Bill
  const billPayments = payments.filter(p => !p.deleted && String(p.billId || p.bill_id) === String(bill.id))
  const cashPaid = billPayments.reduce((sum, p) => sum + Number(p.cashAmount || p.cash_amount || 0), 0)
  const upiPaid = billPayments.reduce((sum, p) => sum + Number(p.upiAmount || p.upi_amount || 0), 0)
  const advanceUsed = Number(bill.advanceDeducted || bill.advance_deducted || bill.advanceUsed || 0)
  const paidNow = cashPaid + upiPaid + advanceUsed

  // 5. Remaining Balance
  const remainingBalance = Math.max(0, totalAmountDue - paidNow)
  const customerAdvanceBal = Number(customer?.advanceBalance || customer?.credit_balance || 0)

  // 6. Loyalty Earned
  const isRegular = (customer?.type || 'regular') === 'regular'
  const pointsEarned = bill.loyaltyPointsEarned || LoyaltyService.calculatePointsEarned(bill.subtotal || bill.total, isRegular, settings)
  const isFullyPaid = bill.status === 'paid' || (bill.balance !== undefined && Number(bill.balance) <= 0)

  // Format date cleanly
  let formattedDate = bill.date || ''
  if (bill.date) {
    try {
      const dObj = new Date(bill.date)
      formattedDate = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch (_) {
      formattedDate = bill.date
    }
  }

  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

  return (
    <div
      className="ledger-bill-card"
      style={{
        background: 'var(--bg-card, #120924)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '20px',
        color: 'var(--text-primary, #ffffff)',
        boxShadow: 'var(--shadow-md, 0 4px 20px rgba(0,0,0,0.3))',
        fontFamily: 'JetBrains Mono, Courier New, monospace',
        fontSize: '0.85rem',
        lineHeight: '1.5'
      }}
    >
      {/* Shop Header */}
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {(business?.shopName || 'PRINTPRO STATION').toUpperCase()}
        </h3>
        {business?.address && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {business.address}
          </div>
        )}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '2px' }}>
          {business?.phone && <span>Tel: {business.phone}</span>}
          {business?.gstin && <span>GSTIN: {business.gstin}</span>}
          {business?.upiId && <span>UPI: {business.upiId}</span>}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />

      {/* Bill Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
        <div><strong>Bill No :</strong> #{bill.invoiceNumber || bill.invoice_number || bill.id}</div>
        <div><strong>Date :</strong> {formattedDate}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div><strong>Customer :</strong> {customerDisplay}{customerSuffix}</div>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 'var(--radius-full, 9999px)',
            background: isFullyPaid ? 'rgba(0, 255, 171, 0.15)' : 'rgba(255, 56, 96, 0.15)',
            border: isFullyPaid ? '1px solid var(--success)' : '1px solid var(--error)',
            color: isFullyPaid ? 'var(--success)' : 'var(--error)',
            textTransform: 'uppercase'
          }}
        >
          {bill.status || (isFullyPaid ? 'PAID' : 'UNPAID')}
        </span>
      </div>

      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />

      {/* Line Items Table */}
      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '8px' }}>
        PRINT ITEMS & SERVICES
      </div>

      {(!bill.items || bill.items.length === 0) ? (
        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>No items recorded</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          {bill.items.map((item, idx) => {
            const printType = item.printType || item.print_type ? ` [${(item.printType || item.print_type).toUpperCase()}]` : ''
            const sides = item.sides ? ` [${item.sides.toUpperCase()}]` : ''
            const unitPrice = Number(item.unitPrice || item.unit_price || 0).toFixed(2)
            const amount = Number(item.amount || 0).toFixed(2)

            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, paddingRight: '8px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {idx + 1}. {item.name || item.itemName || item.item_name || 'Print Item'}{printType}{sides}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Qty: {item.qty || 1} × ₹{unitPrice}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  ₹{amount}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Subtotal, Discounts, Tax Breakdown */}
      <div style={{ borderTop: '1px solid var(--border-light, rgba(255,255,255,0.1))', paddingTop: '8px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal</span>
          <span>₹{Number(bill.subtotal || bill.total || 0).toFixed(2)}</span>
        </div>

        {Number(bill.discountValue || bill.discount_value || bill.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-primary)' }}>
            <span>Discount Applied</span>
            <span>-₹{Number(bill.discountValue || bill.discount_value || bill.discount).toFixed(2)}</span>
          </div>
        )}

        {Number(bill.loyaltyDiscount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-tertiary)' }}>
            <span>Loyalty Discount</span>
            <span>-₹{Number(bill.loyaltyDiscount).toFixed(2)}</span>
          </div>
        )}

        {Number(bill.gstAmount || bill.gst_amount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-secondary)' }}>
            <span>GST Tax</span>
            <span>+₹{Number(bill.gstAmount || bill.gst_amount).toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-primary)', paddingTop: '4px', borderTop: '1px dashed var(--border-light, rgba(255,255,255,0.1))' }}>
          <span>Current Bill Total</span>
          <span>₹{currentBill.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />

      {/* LEDGER SUMMARY */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '6px' }}>
          LEDGER SUMMARY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Previous Outstanding</span>
            <span>₹{previousOutstanding.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Current Bill</span>
            <span>₹{currentBill.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--text-primary)', paddingTop: '3px', borderTop: '1px dashed var(--border-light, rgba(255,255,255,0.1))' }}>
            <span>Total Amount Due</span>
            <span>₹{totalAmountDue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />

      {/* PAYMENT SUMMARY */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--success)', marginBottom: '6px' }}>
          PAYMENT RECEIVED
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cash Paid</span>
            <span>₹{cashPaid.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>UPI Paid</span>
            <span>₹{upiPaid.toFixed(2)}</span>
          </div>
          {advanceUsed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Advance Used</span>
              <span>₹{advanceUsed.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--success)', paddingTop: '3px', borderTop: '1px dashed var(--border-light, rgba(255,255,255,0.1))' }}>
            <span>Paid Now</span>
            <span>₹{paidNow.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />

      {/* BALANCE SUMMARY */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--accent-secondary)', marginBottom: '6px' }}>
          BALANCE SUMMARY
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 800, color: remainingBalance > 0 ? 'var(--error)' : 'var(--success)' }}>
            <span>Remaining to Pay (Balance Due)</span>
            <span>₹{remainingBalance.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Customer Advance Balance</span>
            <span>₹{customerAdvanceBal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* LOYALTY SUMMARY */}
      {pointsEarned > 0 && (
        <>
          <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />
          <div style={{ fontSize: '0.78rem' }}>
            {isFullyPaid ? (
              <div style={{ color: 'var(--success)', fontWeight: 700 }}>
                🎁 <strong>Loyalty Earned :</strong> +{pointsEarned} Points Credited
              </div>
            ) : (
              <div style={{ color: 'var(--warning, #f59e0b)', fontWeight: 600 }}>
                ⏳ <strong>Loyalty Points :</strong> +{pointsEarned} pts (credited after fully paid)
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer Notes */}
      <div style={{ borderTop: '1px dashed var(--border, rgba(255,255,255,0.2))', margin: '12px 0' }} />
      <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {settings?.footerNotes && <div style={{ marginBottom: '4px' }}>{settings.footerNotes}</div>}
        <div style={{ fontWeight: 700 }}>*** THANK YOU FOR YOUR BUSINESS ***</div>
        <div style={{ fontSize: '0.65rem', marginTop: '2px', opacity: 0.8 }}>Powered by PrintPro ERP</div>
      </div>
    </div>
  )
}
