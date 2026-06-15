import React from 'react'
import { useAppContext } from '../context/AppContext'
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react'

const Accounting = () => {
  const { bills, inventory } = useAppContext()
  const totalRevenue = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0)
  const totalReceivable = bills.filter((bill) => !bill.deleted).reduce((sum, bill) => sum + Number(bill.balance || 0), 0)
  const totalInventoryValue = inventory.reduce((sum, item) => sum + Number(item.stock || 0) * ((item.colorSingle + item.bwSingle) / 2), 0)

  return (
    <div>
      <div className="page-header">
        <h1>Accounting</h1>
        <p>Track revenue, receivables, purchases, and your overall cash flow.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo">
              <DollarSign />
            </div>
            <div>
              <div className="stat-card-label">Revenue</div>
              <div className="stat-card-value">₹{totalRevenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Amount collected from customers.</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning">
              <TrendingUp />
            </div>
            <div>
              <div className="stat-card-label">Receivables</div>
              <div className="stat-card-value">₹{totalReceivable.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Amount still owed by customers.</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <BarChart3 />
            </div>
            <div>
              <div className="stat-card-label">Inventory Value</div>
              <div className="stat-card-value">₹{totalInventoryValue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">Stock asset estimate for accounting.</div>
        </div>
      </div>

      <div className="card">
        <h2>Payment Summary</h2>
        <div className="table-container" style={{ marginTop: '16px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Revenue</td>
                <td>₹{totalRevenue.toFixed(2)}</td>
                <td>Paid bills and partial payments</td>
              </tr>
              <tr>
                <td>Current Owed</td>
                <td>₹{totalReceivable.toFixed(2)}</td>
                <td>Receivables across open bills</td>
              </tr>
              <tr>
                <td>Stock Value</td>
                <td>₹{totalInventoryValue.toFixed(2)}</td>
                <td>Estimated inventory asset value</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Accounting
