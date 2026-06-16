import React from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Home, FileText, Users, DollarSign, Layers, Bell, Trash2, Settings, Download, Search as SearchIcon, Receipt, Lock, TrendingUp, Wallet } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: Home },
  { label: 'Billing', path: '/billing', icon: FileText },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Advance Payments', path: '/advance-payments', icon: Wallet },
  { label: 'Accounting', path: '/accounting', icon: DollarSign },
  { label: 'Analytics', path: '/analytics', icon: TrendingUp },
  { label: 'Inventory', path: '/inventory', icon: Layers },
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Customer Ledger', path: '/customer-ledger', icon: TrendingUp },
  { label: 'Recurring Bills', path: '/recurring-bills', icon: FileText },
  { label: 'Receipt', path: '/receipt', icon: Receipt },
  { label: 'Search', path: '/search', icon: SearchIcon },
  { label: 'Data Management', path: '/data-management', icon: Download },
  { label: 'Deleted Bills', path: '/deleted-bills', icon: Trash2 },
  { label: 'Authentication', path: '/auth', icon: Lock },
  { label: 'Settings', path: '/settings', icon: Settings },
]

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Printer size={20} />
        </div>
        <div className="sidebar-logo-text">PrintPro</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}

export default Sidebar
