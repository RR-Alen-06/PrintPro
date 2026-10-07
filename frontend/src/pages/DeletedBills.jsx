import React from 'react'
import { useAppContext } from '../context/AppContext'
import { RotateCcw, Trash2 } from 'lucide-react'
import EmptyState from '../components/common/EmptyState'

const DeletedBills = () => {
  const { bills, restoreBill } = useAppContext()
  const deletedBills = bills.filter((bill) => bill.deleted)

  return (
    <div>
      <div className="page-header">
        <h1>Deleted Bills</h1>
        <p>Restore soft-deleted bills or review deleted invoices for audit history.</p>
      </div>

      <div className="card">
        {deletedBills.length === 0 ? (
          <EmptyState
            Icon={Trash2}
            title="No deleted bills"
            description="All created bills are currently active. Deleted bills will appear here with an option to restore them."
          />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {deletedBills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="font-mono text-muted">{bill.id}</td>
                    <td style={{ fontWeight: 600 }}>{bill.customerName || 'Walk-in Customer'}</td>
                    <td>{bill.date}</td>
                    <td className="font-mono tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{Number(bill.total || 0).toFixed(2)}
                    </td>
                    <td>
                      <span className={`badge badge-${bill.status || 'unpaid'}`}>
                        {(bill.status || 'unpaid').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => restoreBill(bill.id)}>
                        <RotateCcw size={14} /> Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeletedBills
