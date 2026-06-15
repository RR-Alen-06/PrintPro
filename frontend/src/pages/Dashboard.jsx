import React from 'react'
import { useAppContext } from '../context/AppContext'
import { TrendingUp, CreditCard, Clock, Package } from 'lucide-react'

const Dashboard = () => {
  const { bills, inventory, customers } = useAppContext()
  const activeBills = bills.filter((bill) => !bill.deleted)
  const paidBills = activeBills.filter((bill) => bill.status === 'paid')
  const partialBills = activeBills.filter((bill) => bill.status === 'partial')
  const unpaidBills = activeBills.filter((bill) => bill.status === 'unpaid')
  const pendingAmount = activeBills.reduce((sum, bill) => sum + Number(bill.balance || 0), 0)
  const revenue = activeBills.reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0)
  const lowStock = inventory.filter((item) => item.stock < 50)

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Manage billing, customers, inventory and accounting from one place.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo">
              <TrendingUp />
            </div>
            <div>
              <div className="stat-card-label">Total Revenue</div>
              <div className="stat-card-value">₹{revenue.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">{paidBills.length} bills collected</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon warning">
              <CreditCard />
            </div>
            <div>
              <div className="stat-card-label">Pending Balance</div>
              <div className="stat-card-value">₹{pendingAmount.toFixed(2)}</div>
            </div>
          </div>
          <div className="stat-card-sub">{partialBills.length + unpaidBills.length} open bills</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon error">
              <Clock />
            </div>
            <div>
              <div className="stat-card-label">Overdue Bills</div>
              <div className="stat-card-value">{activeBills.filter((bill) => bill.balance > 0 && new Date(bill.dueDate) < new Date()).length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Track unpaid due dates</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon success">
              <Package />
            </div>
            <div>
              <div className="stat-card-label">Low Stock Alerts</div>
              <div className="stat-card-value">{lowStock.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Items below threshold</div>
        </div>
      </div>

      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Recent Bills</h2>
            <p className="text-muted">Latest transactions and payment details</p>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBills.slice(0, 6).map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.id}</td>
                  <td>{bill.customerName}</td>
                  <td>{bill.date}</td>
                  <td>₹{bill.total.toFixed(2)}</td>
                  <td>₹{bill.amountPaid.toFixed(2)}</td>
                  <td>₹{bill.balance.toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${bill.status === 'paid' ? 'paid' : bill.status === 'partial' ? 'partial' : 'unpaid'}`}>
                      {bill.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '24px' }}>
        <div className="card">
          <h3>Customer Summary</h3>
          <p>{customers.length} customers registered</p>
          <ul>
            <li>Regular customers: {customers.filter((customer) => customer.type === 'regular').length}</li>
            <li>Random customers: {customers.filter((customer) => customer.type === 'random').length}</li>
          </ul>
        </div>

        <div className="card">
          <h3>Inventory Status</h3>
          <p>{inventory.length} item types available</p>
          <ul>
            {inventory.slice(0, 4).map((item) => (
              <li key={item.id}>{item.name} — stock {item.stock}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
