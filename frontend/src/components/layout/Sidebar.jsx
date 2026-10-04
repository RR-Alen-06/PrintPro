import React from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Home, FileText, Users, DollarSign, Layers, Bell, Trash2, Settings, Download, Search as SearchIcon, Receipt, Lock, TrendingUp, Wallet, BookOpen, RefreshCw, GitMerge, X } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

// permKey = key in staffPermissions; undefined means always show (e.g. Dashboard, Notifications)
const navItems = [
  { label: 'Dashboard',        path: '/dashboard',         icon: Home,         permKey: undefined },
  { label: 'Billing',          path: '/billing',           icon: FileText,     permKey: 'billing' },
  { label: 'Group Billing',    path: '/group-billing',     icon: GitMerge,     permKey: 'billing' },
  { label: 'Customers',        path: '/customers',         icon: Users,        permKey: 'customers' },
  { label: 'Advance Payments', path: '/advance-payments',  icon: Wallet,       permKey: 'advancePayments' },
  { label: 'Accounting',       path: '/accounting',        icon: DollarSign,   permKey: 'accounting' },
  { label: 'Refunds',          path: '/refunds',           icon: RefreshCw,    permKey: 'accounting' },
  { label: 'Analytics',        path: '/analytics',         icon: TrendingUp,   permKey: 'accounting' },
  { label: 'Inventory',        path: '/inventory',         icon: Layers,       permKey: 'inventory' },
  { label: 'Customer Ledger',  path: '/customer-ledger',   icon: BookOpen,     permKey: 'ledger' },
  { label: 'Customer Bills',   path: '/customer-bills',    icon: FileText,     permKey: 'customers' },
  { label: 'Recurring Bills',  path: '/recurring-bills',   icon: RefreshCw,    permKey: 'recurringBills' },
  { label: 'Receipt',          path: '/receipt',           icon: Receipt,      permKey: 'receipt' },
  { label: 'Search',           path: '/search',            icon: SearchIcon,   permKey: 'search' },
  { label: 'Notifications',    path: '/notifications',     icon: Bell,         permKey: undefined },
  { label: 'Data Management',  path: '/data-management',   icon: Download,     permKey: 'dataManagement' },
  { label: 'Deleted Bills',    path: '/deleted-bills',     icon: Trash2,       permKey: 'deletedBills' },
  { label: 'Authentication',   path: '/auth',              icon: Lock,         permKey: 'settings' },
  { label: 'Settings',         path: '/settings',          icon: Settings,     permKey: 'settings' },
]

const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser, settings } = useAppContext()
  // Since there is only one merchant/owner role, any logged-in user gets full access
  const isMerchant = !!currentUser

  const visibleItems = navItems.filter((item) => {
    // Check if Refunds is disabled
    if (item.path === '/refunds' && settings?.refundsEnabled === false) {
      return false
    }
    
    if (isMerchant) return true                      // Merchant sees everything
    return item.permKey === undefined                // Non-logged-in sees only public
  })

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Printer size={20} />
          </div>
          <div className="sidebar-logo-text">PrintPro</div>
        </div>
        <nav className="sidebar-nav">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar
