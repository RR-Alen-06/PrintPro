import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Printer,
  Home,
  FileText,
  Users,
  DollarSign,
  Layers,
  Bell,
  Trash2,
  Settings,
  Download,
  Search as SearchIcon,
  Receipt,
  TrendingUp,
  Wallet,
  BookOpen,
  RefreshCw,
  GitMerge,
  QrCode,
  X
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

const navGroups = [
  {
    title: 'POS & Billing',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home, permKey: undefined },
      { label: 'Billing / POS', path: '/billing', icon: FileText, permKey: 'billing' },
      { label: 'Group Billing', path: '/group-billing', icon: GitMerge, permKey: 'billing' },
      { label: 'Cash Register', path: '/cash-register', icon: DollarSign, permKey: 'accounting' },
      { label: 'UPI Reconciliation', path: '/upi-reconciliation', icon: QrCode, permKey: 'accounting' },
      { label: 'Receipt Preview', path: '/receipt', icon: Receipt, permKey: 'receipt' },
    ]
  },
  {
    title: 'Customers & Ledgers',
    items: [
      { label: 'Customers', path: '/customers', icon: Users, permKey: 'customers' },
      { label: 'Customer Ledger', path: '/customer-ledger', icon: BookOpen, permKey: 'ledger' },
      { label: 'Customer Bills', path: '/customer-bills', icon: FileText, permKey: 'customers' },
      { label: 'Advance Payments', path: '/advance-payments', icon: Wallet, permKey: 'advancePayments' },
      { label: 'Refunds', path: '/refunds', icon: RefreshCw, permKey: 'accounting' },
    ]
  },
  {
    title: 'Stock & Finance',
    items: [
      { label: 'Inventory Items', path: '/inventory', icon: Layers, permKey: 'inventory' },
      { label: 'Accounting Book', path: '/accounting', icon: DollarSign, permKey: 'accounting' },
      { label: 'Analytics & Trends', path: '/analytics', icon: TrendingUp, permKey: 'accounting' },
    ]
  },
  {
    title: 'Tools & Settings',
    items: [
      { label: 'Global Search', path: '/search', icon: SearchIcon, permKey: 'search' },
      { label: 'Notifications', path: '/notifications', icon: Bell, permKey: undefined },
      { label: 'Data Management', path: '/data-management', icon: Download, permKey: 'dataManagement' },
      { label: 'Deleted Bills', path: '/deleted-bills', icon: Trash2, permKey: 'deletedBills' },
      { label: 'Settings', path: '/settings', icon: Settings, permKey: 'settings' },
    ]
  }
]

const Sidebar = ({ isOpen, onClose, isCollapsed, onToggleCollapse }) => {
  const { currentUser, settings, notifications = [] } = useAppContext()
  const isMerchant = !!currentUser
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>

        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" onClick={onToggleCollapse} style={{ cursor: 'pointer' }} title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}>
            <Printer size={18} />
          </div>
          <div className="sidebar-logo-text">
            <span>PrintPro</span>
            <span className="sidebar-logo-badge">Pro</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter((item) => {
              if (item.path === '/refunds' && settings?.refundsEnabled === false) {
                return false
              }
              if (isMerchant) return true
              return item.permKey === undefined
            })

            if (visibleItems.length === 0) return null

            return (
              <div key={groupIdx} style={{ marginBottom: '6px' }}>
                <div className="sidebar-section-label">{group.title}</div>
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const isNotifications = item.path === '/notifications'
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                      onClick={onClose}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {isNotifications && unreadCount > 0 && (
                        <span className="sidebar-link-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
