import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useDeletedBills, useBillMutations } from '../hooks/useBillsQuery'
import { RotateCcw } from 'lucide-react'

const DeletedBills = () => {
  const { bills: contextBills, restoreBill: contextRestoreBill, showToast } = useAppContext()
  const { data: serverDeletedBills = [], isLoading } = useDeletedBills()
  const { restoreBill, isRestoringBill } = useBillMutations()

  const contextDeleted = (contextBills || []).filter((bill) => bill.deleted)
  const deletedBills = serverDeletedBills.length > 0 ? serverDeletedBills : contextDeleted

  const handleRestore = async (billId) => {
    try {
      await restoreBill(billId)
      showToast?.('Bill restored successfully!', 'success')
    } catch {
      contextRestoreBill?.(billId)
    }
  }

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
                    <td>{bill.invoiceNumber || bill.invoice_number || bill.id}</td>
                    <td>{bill.customerName || bill.customer_name || 'Walk-in Customer'}</td>
                    <td>{bill.date}</td>
                    <td>₹{Number(bill.total || 0).toFixed(2)}</td>
                    <td>{bill.status}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary" 
                        disabled={isRestoringBill}
                        onClick={() => handleRestore(bill.id)}
                      >
                        <RotateCcw size={16} /> Restore
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    {isLoading ? 'Loading deleted bills...' : 'No deleted bills found.'}
                  </td>
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
