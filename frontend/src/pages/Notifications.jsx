import React, { useState, useEffect, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { Bell, AlertTriangle, MessageCircle, Send, CheckCircle, Clock, ShieldAlert, Phone, Copy } from 'lucide-react'
import { getOverdueNotifications } from '../api/notifications'

const NotificationsPage = () => {
  const { business, notifications, markNotificationRead, markAllNotificationsRead, showToast } = useAppContext()
  const [overdueBills, setOverdueBills] = useState([])
  const [loadingOverdue, setLoadingOverdue] = useState(false)
  const [sendingBulk, setSendingBulk] = useState(false)

  const fetchOverdue = async () => {
    setLoadingOverdue(true)
    try {
      const res = await getOverdueNotifications()
      if (res.data?.success) {
        setOverdueBills(res.data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch overdue bills:', err)
    } finally {
      setLoadingOverdue(false)
    }
  }

  useEffect(() => {
    fetchOverdue()
  }, [])

  const generateUpiPayLink = (amount, billId) => {
    if (!business?.upiId || amount <= 0) return ''
    const params = new URLSearchParams({
      pa: business.upiId,
      pn: business.shopName || 'PrintPro',
      am: Number(amount).toFixed(2),
      cu: 'INR',
      tn: `Bill payment ${billId}`,
    })
    return `upi://pay?${params.toString()}`
  }

  const createWhatsAppText = (bill) => {
    const shopName = business?.shopName || 'PrintPro'
    const upiLink = generateUpiPayLink(bill.balance, bill.id)
    const upiLine = upiLink ? `%0A*Pay via UPI:* ${encodeURIComponent(upiLink)}%0A` : ''

    const text = `*Payment Reminder from ${shopName}*%0A` +
      `------------------------%0A` +
      `Dear *${bill.customer_name || 'Customer'}*,%0A` +
      `This is a gentle reminder that your invoice *#${bill.id}* for *₹${Number(bill.balance || 0).toFixed(2)}* is overdue by *${bill.days_overdue || 1} day(s)* (Due Date: ${bill.due_date}).%0A` +
      upiLine +
      `------------------------%0A` +
      `Please clear the balance at your earliest convenience. Thank you!`

    return text
  }

  const handleSendReminder = (bill) => {
    const phone = (bill.customer_phone || '').replace(/[^0-9]/g, '')
    if (!phone) {
      showToast(`No phone number available for ${bill.customer_name}`, 'warning')
      return
    }

    const text = createWhatsAppText(bill)
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`
    window.open(url, '_blank')
    showToast(`Opening WhatsApp reminder for ${bill.customer_name}`, 'info')
  }

  const handleSendAll = async () => {
    const validBills = overdueBills.filter(b => (b.customer_phone || '').replace(/[^0-9]/g, '').length >= 10)
    if (validBills.length === 0) {
      showToast('No overdue bills with valid customer phone numbers found.', 'warning')
      return
    }

    const confirmSend = window.confirm(`Send WhatsApp payment reminders to ${validBills.length} overdue customer(s)?`)
    if (!confirmSend) return

    setSendingBulk(true)
    for (let i = 0; i < validBills.length; i++) {
      const bill = validBills[i]
      const phone = bill.customer_phone.replace(/[^0-9]/g, '')
      const text = createWhatsAppText(bill)
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`
      window.open(url, '_blank')
      // Small pause between opens so the browser doesn't block popups
      await new Promise(r => setTimeout(r, 600))
    }
    setSendingBulk(false)
    showToast(`Dispatched reminders for ${validBills.length} customer(s)!`, 'success')
  }

  const totalOverdueAmount = useMemo(() => {
    return overdueBills.reduce((sum, b) => sum + Number(b.balance || 0), 0)
  }, [overdueBills])

  return (
    <div>
      <div className="page-header">
        <h1>Notifications & Reminders</h1>
        <p>Review alerts for overdue bills, WhatsApp payment reminders, and inventory updates.</p>
      </div>

      {/* ── Section 1: WhatsApp Due Date Reminders ── */}
      <div className="card" style={{ marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              <ShieldAlert size={20} /> Overdue Bills & Due Date Reminders ({overdueBills.length})
            </h2>
            <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Total Overdue Outstanding: <strong style={{ color: '#ef4444' }}>₹{totalOverdueAmount.toFixed(2)}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchOverdue}
              disabled={loadingOverdue}
            >
              Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSendAll}
              disabled={sendingBulk || overdueBills.length === 0}
              style={{
                background: '#25D366', borderColor: '#25D366', color: '#fff',
                display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600
              }}
            >
              <MessageCircle size={15} /> Send All via WhatsApp
            </button>
          </div>
        </div>

        {overdueBills.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No overdue bills!</div>
            <div style={{ fontSize: '0.85rem' }}>All customer bills are current and within their due dates.</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill ID</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th style={{ textAlign: 'right' }}>Amount Due (₹)</th>
                  <th style={{ textAlign: 'center' }}>WhatsApp Reminder</th>
                </tr>
              </thead>
              <tbody>
                {overdueBills.map((bill) => (
                  <tr key={bill.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{bill.id}</td>
                    <td>{bill.customer_name || 'Walk-in'}</td>
                    <td>
                      {bill.customer_phone ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} className="text-muted" /> {bill.customer_phone}
                        </span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>No Phone</span>
                      )}
                    </td>
                    <td>{bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className="badge badge-danger" style={{ fontSize: '0.75rem' }}>
                        {bill.days_overdue} days
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                      ₹{Number(bill.balance || 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleSendReminder(bill)}
                        disabled={!bill.customer_phone}
                        style={{
                          background: 'rgba(37, 211, 102, 0.15)',
                          color: '#25D366',
                          border: '1px solid rgba(37, 211, 102, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          padding: '4px 10px'
                        }}
                      >
                        <MessageCircle size={13} /> Send Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: General System Alerts ── */}
      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>System Notifications</h2>
          </div>
          {notifications.some((note) => !note.read) && (
            <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>
              Mark all as read
            </button>
          )}
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Message</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    No pending system notifications.
                  </td>
                </tr>
              ) : (
                notifications.map((note) => (
                  <tr key={note.id}>
                    <td>
                      <span className={`badge ${note.type === 'warning' ? 'badge-warning' : note.type === 'danger' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                        {note.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{note.title}</td>
                    <td>{note.message}</td>
                    <td>{note.date}</td>
                    <td>
                      {!note.read && (
                        <button className="btn btn-sm btn-secondary" onClick={() => markNotificationRead(note.id)}>
                          Mark read
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
