import React, { useState, useRef } from 'react'
import { Printer, X, Search as SearchIcon } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const Receipt = () => {
  const { bills, customers } = useAppContext()
  const [selectedBill, setSelectedBill] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const receiptRef = useRef(null)

  const filteredBills = bills
    .filter((bill) => !bill.deleted)
    .filter((bill) => bill.id.toLowerCase().includes(searchQuery.toLowerCase()) || bill.customerName.toLowerCase().includes(searchQuery.toLowerCase()))

  const handlePrint = () => {
    if (!selectedBill) return
    window.print()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Print Receipt</h1>
        <p>Generate and print receipts for your bills.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Bill Selection */}
        <div className="card">
          <h2>Select Bill</h2>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Search Bill</label>
            <input
              className="form-input"
              type="text"
              placeholder="Search by bill ID or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '16px', maxHeight: '400px', overflowY: 'auto' }}>
            {filteredBills.length === 0 ? (
              <p className="text-muted">No bills found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredBills.map((bill) => (
                  <button
                    key={bill.id}
                    className={`btn ${selectedBill?.id === bill.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedBill(bill)}
                    style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{bill.id}</div>
                      <div style={{ fontSize: '12px', opacity: 0.7 }}>{bill.customerName} • ₹{bill.total.toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Print Button */}
        <div className="card">
          <h2>Actions</h2>

          <button
            className="btn btn-primary"
            onClick={handlePrint}
            disabled={!selectedBill}
            style={{ marginTop: '16px', width: '100%' }}
          >
            <Printer size={16} /> Print Receipt
          </button>

          {selectedBill && (
            <button
              className="btn btn-secondary"
              onClick={() => setSelectedBill(null)}
              style={{ marginTop: '12px', width: '100%' }}
            >
              <X size={16} /> Clear Selection
            </button>
          )}

          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
            <h4>Print Tips</h4>
            <ul style={{ margin: '8px 0', paddingLeft: '20px', fontSize: '14px' }}>
              <li>Receipt will print in A5 format (half-page)</li>
              <li>Use Ctrl+P or the Print button to open print dialog</li>
              <li>Select "Print to PDF" to save as PDF</li>
              <li>Adjust margins to "None" for better formatting</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Receipt Preview & Print Area */}
      {selectedBill && (
        <div className="card" style={{ marginTop: '24px' }}>
          <h2 style={{ marginBottom: '24px' }}>Receipt Preview</h2>

          <div
            ref={receiptRef}
            className="receipt-print-area"
            style={{
              width: '210mm',
              height: '148mm',
              margin: '0 auto',
              padding: '20px',
              backgroundColor: '#fff',
              color: '#000',
              fontFamily: 'Arial, sans-serif',
              fontSize: '12px',
              lineHeight: '1.6',
              border: '1px solid #ddd',
            }}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>RECEIPT</h3>
              <p style={{ margin: '0', fontSize: '10px' }}>Bill #{selectedBill.id}</p>
            </div>

            {/* Business Info */}
            <div style={{ marginBottom: '12px', fontSize: '11px' }}>
              <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>PrintPro Shop</p>
              <p style={{ margin: '0' }}>Thank you for your business!</p>
            </div>

            {/* Customer & Date Info */}
            <div style={{ marginBottom: '12px', fontSize: '11px', borderBottom: '1px solid #999', paddingBottom: '8px' }}>
              <p style={{ margin: '0' }}>
                <strong>Customer:</strong> {selectedBill.customerName}
              </p>
              <p style={{ margin: '0' }}>
                <strong>Date:</strong> {new Date(selectedBill.date).toLocaleDateString()}
              </p>
              {selectedBill.notes && (
                <p style={{ margin: '4px 0 0 0' }}>
                  <strong>Notes:</strong> {selectedBill.notes}
                </p>
              )}
            </div>

            {/* Items Table */}
            <div style={{ marginBottom: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBill.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '4px 0' }}>{item.itemName}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{item.unitPrice.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{ marginBottom: '12px', fontSize: '11px', borderTop: '1px solid #000', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Subtotal:</span>
                <span>₹{selectedBill.subtotal.toFixed(2)}</span>
              </div>
              {selectedBill.discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Discount:</span>
                  <span>-₹{selectedBill.discountValue.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                <span>Total:</span>
                <span>₹{selectedBill.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div style={{ marginBottom: '12px', fontSize: '11px', borderTop: '1px solid #999', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Paid:</span>
                <span>₹{selectedBill.amountPaid.toFixed(2)}</span>
              </div>
              {selectedBill.balance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#d32f2f' }}>
                  <span>Balance Due:</span>
                  <span>₹{selectedBill.balance.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Status:</span>
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {selectedBill.status === 'paid' ? '✓ PAID' : selectedBill.status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #999', fontSize: '10px' }}>
              <p style={{ margin: '0' }}>Thank you for your business!</p>
              <p style={{ margin: '2px 0 0 0' }}>Date: {new Date().toLocaleString()}</p>
            </div>
          </div>

          {/* Print Styles */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .receipt-print-area,
              .receipt-print-area * {
                visibility: visible;
              }
              .receipt-print-area {
                position: fixed;
                top: 0;
                left: 0;
                margin: 0;
                border: none !important;
                box-shadow: none !important;
                page-break-after: avoid;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default Receipt
