import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Bell, PlusSquare, LogOut, User, Menu, Receipt, Users, Inbox, ArrowUpRight, DollarSign, Wallet, X } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import { useNavigate } from 'react-router-dom'
import SyncStatusPill from '../common/SyncStatusPill'
import { useBills } from '../../hooks/useBillsQuery'
import { useCustomers } from '../../hooks/useCustomersQuery'
import { useInventory, useAdvancePayments } from '../../hooks/useEntitiesQuery'
import { useExpenses } from '../../hooks/useExpensesQuery'
import { globalOmniSearch } from '../../utils/search'


const Header = ({ onMenuClick }) => {
  const { currentUser, logout, notifications = [], markNotificationRead, markAllNotificationsRead, deleteNotification, clearAllNotifications } = useAppContext()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchContainerRef = useRef(null)

  const { data: bills = [] } = useBills()
  const { data: customers = [] } = useCustomers()
  const { data: inventory = [] } = useInventory()
  const { data: expenses = [] } = useExpenses()
  const { data: advances = [] } = useAdvancePayments()

  const omniResults = useMemo(() => {
    return globalOmniSearch({
      bills,
      customers,
      inventory,
      expenses,
      advances,
      query: searchQuery,
      limitPerCategory: 3,
    })
  }, [bills, customers, inventory, expenses, advances, searchQuery])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadNotifications = notifications.filter(n => !n.read)

  const handleSearch = (e) => {
    e.preventDefault()
    setShowSearchDropdown(false)
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/search')
    }
  }

  const navigateToResult = (url) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    navigate(url)
  }


  return (
    <header className="header" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', background: 'rgba(9, 4, 23, 0.82)', borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))' }}>
      <div className="header-left">
        <button className="header-menu-btn" type="button" aria-label="Toggle menu" onClick={onMenuClick}>
          <Menu size={18} />
        </button>
        <div className="header-title" style={{ fontWeight: 800, letterSpacing: '-0.01em', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          PrintPro Business Manager
        </div>
      </div>
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <SyncStatusPill />
        <div ref={searchContainerRef} style={{ position: 'relative' }}>
          <form className="header-search" onSubmit={handleSearch} autoComplete="off" style={{ display: 'flex', alignItems: 'center', background: 'rgba(18, 10, 35, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px' }}>
            <Search size={16} style={{ flexShrink: 0, color: 'var(--aurora-cyan, #00f0ff)' }} />
            <input
              type="search"
              placeholder="Search bills, clients, inventory, expenses…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearchDropdown(true)
              }}
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearchDropdown(false)
                }
              }}
              autoComplete="off"
              style={{ background: 'none', border: 'none', outline: 'none', flex: 1, color: 'inherit', fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setShowSearchDropdown(false)
                }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '0 4px', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Instant Live Dropdown */}
          {showSearchDropdown && searchQuery.trim().length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: '420px',
                maxWidth: '90vw',
                backgroundColor: '#120b22',
                border: '1px solid var(--border-accent, rgba(255, 47, 176, 0.3))',
                borderRadius: '12px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(0, 240, 255, 0.12)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                zIndex: 2000,
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--accent-secondary, #00f0ff)', textTransform: 'uppercase' }}>
                  Live Omni-Search ({omniResults.totalMatches} matches)
                </span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                  Press Enter for full results
                </span>
              </div>

              <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}>
                {omniResults.totalMatches === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                    No matching records found for "{searchQuery}"
                  </div>
                ) : (
                  <>
                    {/* Bills Matches */}
                    {omniResults.bills.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Receipt size={12} color="var(--accent-primary, #ff2fb0)" /> INVOICES ({omniResults.bills.length})
                        </div>
                        {omniResults.bills.map((bill) => {
                          const billNum = bill.billSequence || bill.bill_sequence || bill.billNumber || bill.invoiceNumber || bill.id
                          const total = Number(bill.total !== undefined ? bill.total : (bill.total_amount || 0))
                          return (
                            <div
                              key={bill.id}
                              onClick={() => navigateToResult(`/receipt?id=${bill.id}`)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background 0.15s ease',
                                background: 'transparent',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 47, 176, 0.12)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace' }}>
                                  #{billNum}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                  {bill.customerName || bill.customer_name || 'Walk-in'} • {bill.date || 'Today'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--aurora-green, #10b981)' }}>
                                  ₹{total.toFixed(2)}
                                </div>
                                <span style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 5px', borderRadius: '4px', background: bill.status === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: bill.status === 'paid' ? '#10b981' : '#ef4444' }}>
                                  {bill.status || 'UNPAID'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Customers Matches */}
                    {omniResults.customers.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={12} color="var(--accent-secondary, #00f0ff)" /> CUSTOMERS ({omniResults.customers.length})
                        </div>
                        {omniResults.customers.map((c) => {
                          const bal = Number(c.creditBalance || c.credit_balance || c.balanceDue || c.balance_due || 0)
                          return (
                            <div
                              key={c.id}
                              onClick={() => navigateToResult(`/customer-ledger?customerId=${c.id}`)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 240, 255, 0.12)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                                  {c.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                  {c.phone ? `📞 ${c.phone}` : 'No phone'} • Code: {c.code || c.customerCode || 'N/A'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: bal > 0 ? '#ef4444' : '#10b981' }}>
                                  {bal > 0 ? `Due ₹${bal.toFixed(2)}` : 'Cleared'}
                                </div>
                                <span style={{ fontSize: '9px', color: 'var(--accent-secondary, #00f0ff)' }}>
                                  Open Ledger →
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Inventory Matches */}
                    {omniResults.inventory.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Inbox size={12} color="#a855f7" /> INVENTORY & RATES ({omniResults.inventory.length})
                        </div>
                        {omniResults.inventory.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => navigateToResult('/inventory')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                                {item.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                HSN: {item.hsnCode || item.hsn_code || 'N/A'} • Code: {item.code || item.itemCode || 'N/A'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--aurora-cyan, #00f0ff)' }}>
                              Color 1S ₹{Number(item.colorSingle !== undefined ? item.colorSingle : (item.color_single || 10)).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expenses Matches */}
                    {omniResults.expenses.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <DollarSign size={12} color="#f59e0b" /> EXPENSES ({omniResults.expenses.length})
                        </div>
                        {omniResults.expenses.map((exp) => (
                          <div
                            key={exp.id}
                            onClick={() => navigateToResult('/accounting')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                                {exp.category} • {exp.description || 'Expense'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                Voucher: #{exp.voucherNumber || exp.voucher_number || exp.id} • {exp.date}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#f59e0b' }}>
                              ₹{Number(exp.amount || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Advances Matches */}
                    {omniResults.advances.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(255,255,255,0.5)', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Wallet size={12} color="#38bdf8" /> ADVANCE RECEIPTS ({omniResults.advances.length})
                        </div>
                        {omniResults.advances.map((adv) => (
                          <div
                            key={adv.id}
                            onClick={() => navigateToResult('/advance-payments')}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                                {adv.customerName || adv.customer_name || 'Customer'}
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>
                                Receipt: #{adv.receiptNumber || adv.receipt_number || adv.id} • {adv.date}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 800, color: '#38bdf8' }}>
                              ₹{Number(adv.amount || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', background: '#0a0514', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleSearch}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-secondary, #00f0ff)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View full search results in Omni Dashboard <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowUserMenu(false)
            }}
          >
            <Bell />
            {unreadNotifications.length > 0 && <span className="notification-badge-count">{unreadNotifications.length}</span>}
          </button>
          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: '#15152a',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-xl)',
                width: '340px',
                maxWidth: 'calc(100vw - 32px)',
                zIndex: 1000,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e0e1c' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Notifications</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadNotifications.length > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead()}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                    >
                      Mark all read
                    </button>
                  )}
                  {unreadNotifications.length > 0 && notifications.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>•</span>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => clearAllNotifications()}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px 0' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((note) => {
                    const handleNotificationClick = () => {
                      if (!note.read) {
                        markNotificationRead(note.id)
                      }
                      setShowNotifications(false)

                      if (note.link || note.path) {
                        navigate(note.link || note.path)
                        return
                      }
                      if (note.entityType === 'bill' && note.entityId) {
                        navigate(`/receipt?id=${note.entityId}`)
                        return
                      }
                      if (note.entityType === 'customer' && note.entityId) {
                        navigate(`/customer-ledger?customerId=${note.entityId}`)
                        return
                      }
                      if (note.entityType === 'expense') {
                        navigate('/accounting')
                        return
                      }
                      if (note.entityType === 'advance') {
                        navigate('/advance-payments')
                        return
                      }
                    }

                    return (
                      <div
                        key={note.id}
                        onClick={handleNotificationClick}
                        style={{
                          padding: '14px 20px',
                          borderBottom: '1px solid var(--border)',
                          backgroundColor: note.read ? 'transparent' : 'rgba(99, 102, 241, 0.08)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = note.read ? 'transparent' : 'rgba(99, 102, 241, 0.08)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontWeight: note.read ? 500 : 700, fontSize: '13px', color: note.read ? 'var(--text-secondary)' : '#ffffff', wordBreak: 'break-word', paddingRight: '12px' }}>
                            {note.title}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            {!note.read && (
                              <button
                                onClick={() => markNotificationRead(note.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent)',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  padding: '2px 6px',
                                  borderRadius: '2px',
                                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                }}
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(note.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '10px',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '2px',
                              }}
                              title="Dismiss"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                          {note.message}
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.8 }}>
                          {note.date} {note.time ? `• ${note.time}` : ''}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', textAlign: 'center', background: '#0e0e1c' }}>
                <button
                  onClick={() => {
                    navigate('/notifications')
                    setShowNotifications(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="header-icon-btn"
            type="button"
            aria-label="User menu"
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowNotifications(false)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt="User avatar"
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <User size={18} />
            )}
            <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.username}</span>
          </button>
          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                backgroundColor: '#15152a',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-xl)',
                minWidth: '220px',
                zIndex: 1000,
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), 0 8px 32px rgba(0,0,0,0.6)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', background: '#0e0e1c' }}>
                {currentUser?.avatarUrl && (
                  <img
                    src={currentUser.avatarUrl}
                    alt="User avatar"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                  />
                )}
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>Logged in as</div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', wordBreak: 'break-all' }}>{currentUser?.username}</div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>Role: {currentUser?.role}</div>
                </div>
              </div>
              <button
                onClick={async () => {
                  setShowUserMenu(false)
                  await logout()
                  navigate('/auth', { replace: true })
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  fontSize: '14px',
                }}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
