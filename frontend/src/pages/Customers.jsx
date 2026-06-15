import React from 'react'
import { useAppContext } from '../context/AppContext'
import { Users, UserCheck, UserPlus } from 'lucide-react'

const Customers = () => {
  const { customers } = useAppContext()
  const regular = customers.filter((customer) => customer.type === 'regular')
  const random = customers.filter((customer) => customer.type === 'random')

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <p>View regular and random customers, credit balances, and payment status.</p>
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo">
              <Users />
            </div>
            <div>
              <div className="stat-card-label">Regular Customers</div>
              <div className="stat-card-value">{regular.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Assigned IDs and payment tracking.</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon cyan">
              <UserPlus />
            </div>
            <div>
              <div className="stat-card-label">Random Customers</div>
              <div className="stat-card-value">{random.length}</div>
            </div>
          </div>
          <div className="stat-card-sub">Separate records for walk-ins and one-time buyers.</div>
        </div>
      </div>

      <div className="card">
        <div className="bill-view-header">
          <h2>Customer List</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Credit Balance</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.id}</td>
                  <td>{customer.name}</td>
                  <td>{customer.type}</td>
                  <td>{customer.phone || '-'}</td>
                  <td>₹{Number(customer.creditBalance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Customers
