import React, { useState, useMemo } from 'react'
import { Download, FileText } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const CustomerLedger = () => {
  const { customers, bills, payments } = useAppContext()
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '')

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedCustomerId), [customers, selectedCustomerId])

  const customerBills = useMemo(
    () => bills.filter((bill) => bill.customerId === selectedCustomerId && !bill.deleted),
    [bills, selectedCustomerId]
  )

  const customerPayments = useMemo(
    () => payments.filter((payment) => payment.customerId === selectedCustomerId),
    [payments, selectedCustomerId]
  )

  const ledgerEntries = useMemo(() => {
    const entries = []

    customerBills.forEach((bill) => {
      entries.push({
        type: 'bill',
        date: bill.date,
        id: bill.id,
        description: `Bill #${bill.id}`,
        debit: bill.total,
        credit: 0,
        balance: 0,
      })
    })

    customerPayments.forEach((payment) => {
      entries.push({
        type: 'payment',
        date: payment.date,
        id: payment.id,
        description: `Payment against ${payment.billId}`,
        debit: 0,
        credit: payment.totalPaid,
        balance: 0,
      })
    })

    entries.sort((a, b) => new Date(a.date) - new Date(b.date))

    let runningBalance = 0
    return entries.map((entry) => ({
      ...entry,
      balance: (runningBalance += entry.debit - entry.credit),
    }))
  }, [customerBills, customerPayments])

  const totalDebit = ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0)
  const totalCredit = ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0)
  const outstandingBalance = totalDebit - totalCredit

  const downloadStatement = () => {
    const date = new Date()
    const csv = [
      ['Customer Ledger Statement'],
      ['Customer:', selectedCustomer?.name],
      ['Customer ID:', selectedCustomer?.id],
      ['Period:', `${date.toLocaleDateString()}`],
      [],
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ...ledgerEntries.map((entry) => [
        new Date(entry.date).toLocaleDateString(),
        entry.description,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.balance.toFixed(2),
      ]),
      [],
      ['Total', '', totalDebit.toFixed(2), totalCredit.toFixed(2), outstandingBalance.toFixed(2)],
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedCustomer?.name}-ledger-${date.toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customer Ledger</h1>
        <p>View detailed payment history and statements for each customer.</p>
      </div>

      <div className="grid-2" style={{ gap: '24px' }}>
        {/* Customer Selection */}
        <div className="card">
          <h2>Select Customer</h2>

          <select
            className="form-select"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            style={{ marginTop: '16px' }}
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.id})
              </option>
            ))}
          </select>

          {selectedCustomer && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
              <h4>Customer Info</h4>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px', fontSize: '14px' }}>
                <div>
                  <strong>ID:</strong> {selectedCustomer.id}
                </div>
                <div>
                  <strong>Type:</strong> {selectedCustomer.type === 'regular' ? 'Regular' : 'Random'}
                </div>
                <div>
                  <strong>Phone:</strong> {selectedCustomer.phone || 'N/A'}
                </div>
                <div>
                  <strong>Email:</strong> {selectedCustomer.email || 'N/A'}
                </div>
                <div>
                  <strong>Status:</strong> {selectedCustomer.status || 'active'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="card">
          <h2>Summary</h2>

          <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'rgba(244, 63, 94, 0.1)', borderRadius: '4px' }}>
              <div className="text-muted">Total Bills</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f43f5e' }}>₹{totalDebit.toFixed(2)}</div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
              <div className="text-muted">Total Payments</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>₹{totalCredit.toFixed(2)}</div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(251, 146, 60, 0.1)', borderRadius: '4px' }}>
              <div className="text-muted">Outstanding Balance</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fb923c' }}>₹{outstandingBalance.toFixed(2)}</div>
            </div>

            <div style={{ padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: '4px' }}>
              <div className="text-muted">Advance Credit</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>₹{selectedCustomer?.creditBalance?.toFixed(2) || '0.00'}</div>
            </div>
          </div>

          <button className="btn btn-secondary" onClick={downloadStatement} style={{ marginTop: '16px', width: '100%' }}>
            <Download size={16} /> Download Statement
          </button>
        </div>
      </div>

      {/* Ledger Entries */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>Transaction History</h2>

        {ledgerEntries.length === 0 ? (
          <p className="text-muted" style={{ marginTop: '16px' }}>
            No transactions found for this customer.
          </p>
        ) : (
          <div className="table-container" style={{ marginTop: '16px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry, idx) => (
                  <tr key={`${entry.id}-${idx}`}>
                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                    <td>
                      <div style={{ fontWeight: entry.type === 'bill' ? 'bold' : 'normal' }}>{entry.description}</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{entry.type === 'bill' ? 'Invoice' : 'Receipt'}</div>
                    </td>
                    <td style={{ textAlign: 'right', color: entry.debit > 0 ? '#ef4444' : 'inherit' }}>
                      {entry.debit > 0 ? `₹${entry.debit.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', color: entry.credit > 0 ? '#10b981' : 'inherit' }}>
                      {entry.credit > 0 ? `₹${entry.credit.toFixed(2)}` : '-'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 'bold',
                        color: entry.balance > 0 ? '#f59e0b' : '#10b981',
                      }}
                    >
                      ₹{entry.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
                  <td colSpan="2">TOTAL</td>
                  <td style={{ textAlign: 'right' }}>₹{totalDebit.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>₹{totalCredit.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', color: outstandingBalance > 0 ? '#f59e0b' : '#10b981' }}>
                    ₹{outstandingBalance.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerLedger
