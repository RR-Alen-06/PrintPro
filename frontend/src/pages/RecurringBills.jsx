import React, { useState } from 'react'
import { Plus, Trash2, Edit2, CheckCircle } from 'lucide-react'
import { useAppContext } from '../context/AppContext'

const RecurringBills = () => {
  const { customers, recurringBills, addRecurringBill, deleteRecurringBill } = useAppContext()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    customerId: customers[0]?.id || '',
    amount: '',
    frequency: 'monthly',
    description: '',
    dayOfMonth: '1',
    startDate: new Date().toISOString().slice(0, 10),
    active: true,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (editingId) {
      // TODO: Add update functionality
      setEditingId(null)
    } else {
      addRecurringBill({
        ...formData,
        amount: Number(formData.amount),
        dayOfMonth: Number(formData.dayOfMonth),
        active: formData.active === 'true' || formData.active === true,
        createdAt: new Date().toISOString(),
      })
    }

    setFormData({
      customerId: customers[0]?.id || '',
      amount: '',
      frequency: 'monthly',
      description: '',
      dayOfMonth: '1',
      startDate: new Date().toISOString().slice(0, 10),
      active: true,
    })
    setShowForm(false)
  }

  const getCustomerName = (id) => customers.find((c) => c.id === id)?.name || 'Unknown'

  const getNextBillDate = (bill) => {
    const today = new Date()
    const dayOfMonth = parseInt(bill.dayOfMonth, 10)

    if (bill.frequency === 'monthly') {
      let nextDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
      if (nextDate < today) {
        nextDate = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
      }
      return nextDate.toLocaleDateString()
    } else if (bill.frequency === 'weekly') {
      const daysUntilDay = (dayOfMonth - today.getDay() + 7) % 7 || 7
      const nextDate = new Date(today)
      nextDate.setDate(nextDate.getDate() + daysUntilDay)
      return nextDate.toLocaleDateString()
    }

    return 'N/A'
  }

  return (
    <div>
      <div className="page-header">
        <h1>Recurring Bills</h1>
        <p>Set up automatic recurring bills for regular and walk-in customers.</p>
      </div>

      {/* Add New Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2>Add Recurring Bill</h2>

          <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
            <div className="grid-2" style={{ gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Customer</label>
                <select
                  className="form-select"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  required
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.type === 'regular' ? 'Regular' : 'Walk-in'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Bill amount"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-select" value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{formData.frequency === 'monthly' ? 'Day of Month' : 'Day of Week'}</label>
                {formData.frequency === 'monthly' ? (
                  <input className="form-input" type="number" min="1" max="31" value={formData.dayOfMonth} onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })} />
                ) : (
                  <select className="form-select" value={formData.dayOfMonth} onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}>
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Active</label>
                <select
                  className="form-select"
                  value={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Bill description or notes"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary">
                <Plus size={16} /> Save Recurring Bill
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Button */}
      {!showForm && (
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ marginBottom: '24px' }}>
          <Plus size={16} /> Add Recurring Bill
        </button>
      )}

      {/* Recurring Bills List */}
      <div className="card">
        <h2>Recurring Bills ({recurringBills.filter((b) => b.active).length} Active)</h2>

        {recurringBills.length === 0 ? (
          <p className="text-muted" style={{ marginTop: '16px' }}>
            No recurring bills set up yet. Create one to get started.
          </p>
        ) : (
          <div className="table-container" style={{ marginTop: '16px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Next Bill</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringBills.map((bill) => (
                  <tr key={bill.id} style={{ opacity: bill.active ? 1 : 0.6 }}>
                    <td>{getCustomerName(bill.customerId)}</td>
                    <td>₹{bill.amount.toFixed(2)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{bill.frequency}</td>
                    <td>{getNextBillDate(bill)}</td>
                    <td>
                      <span className={`badge ${bill.active ? 'badge-success' : 'badge-warning'}`}>{bill.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(bill.id)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteRecurringBill(bill.id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="card" style={{ marginTop: '24px' }}>
        <h2>About Recurring Bills</h2>
        <div style={{ marginTop: '16px', display: 'grid', gap: '16px' }}>
          <div>
            <h4>Weekly Recurring</h4>
            <p className="text-muted">Bills repeat every week on the selected day. Useful for regular weekly orders.</p>
          </div>
          <div>
            <h4>Monthly Recurring</h4>
            <p className="text-muted">Bills repeat every month on the selected date. Useful for regular monthly contracts.</p>
          </div>
          <div>
            <h4>Auto-Generation</h4>
            <p className="text-muted">Currently, you need to manually create bills from recurring bill templates. Future versions will include automatic bill generation.</p>
          </div>
          <div>
            <h4>Flexibility</h4>
            <p className="text-muted">You can activate/deactivate recurring bills anytime, or delete them if no longer needed.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecurringBills
