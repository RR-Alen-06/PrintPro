import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useNotifications, useNotificationMutations } from '../hooks/useNotificationsQuery'
import { Bell } from 'lucide-react'

const NotificationsPage = () => {
  const { notifications: contextNotifications } = useAppContext()
  const { notifications: serverNotifications, isLoading } = useNotifications()
  const { markRead, markAllRead } = useNotificationMutations()

  const notifications = serverNotifications?.length > 0 ? serverNotifications : (contextNotifications || [])

  return (
    <div>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Review alerts for pending payments, overdue bills, and inventory updates.</p>
      </div>

      <div className="card">
        <div className="bill-view-header">
          <div>
            <h2>Notification Center</h2>
          </div>
          {notifications.some((note) => !note.read) && (
            <button className="btn btn-secondary btn-sm" onClick={() => markAllRead()}>
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
              {notifications.map((note) => (
                <tr key={note.id}>
                  <td>{note.type}</td>
                  <td>{note.title}</td>
                  <td>{note.message}</td>
                  <td>{note.date}</td>
                  <td>
                    {!note.read && (
                      <button className="btn btn-sm btn-secondary" onClick={() => markRead(note.id)}>
                        Mark read
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {notifications.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}>
                    No active notifications
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

export default NotificationsPage
