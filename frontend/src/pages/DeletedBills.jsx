import React from 'react'
import { useAppContext } from '../context/AppContext'
import { RotateCcw } from 'lucide-react'

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
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {deletedBills.length > 0 ? (
                deletedBills.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.id}</td>
                    <td>{bill.customerName}</td>
                    <td>{bill.date}</td>
                    <td>₹{bill.total.toFixed(2)}</td>
                    <td>{bill.status}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => restoreBill(bill.id)}>
                        <RotateCcw size={16} /> Restore
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No deleted bills found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DeletedBills
