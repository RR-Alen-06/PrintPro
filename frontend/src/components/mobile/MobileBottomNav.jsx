import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, PlusCircle, Settings, Grid,
  ArrowLeftRight, Users, BookOpen, Inbox, Wallet,
  DollarSign, BarChart3, Layers, FileText, Upload, Printer, Database,
  Search, Bell, Trash2, Tag
} from 'lucide-react'
import BottomSheet from './BottomSheet'

export default function MobileBottomNav() {
  const navigate = useNavigate()
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)

  const navItems = [
    { to: '/mobile/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/mobile/billing', label: 'Bills', icon: Receipt },
    { to: '/mobile/create-bill', label: 'New Bill', icon: PlusCircle },
    { to: '/mobile/settings', label: 'Settings', icon: Settings },
  ]

  const moreModules = [
    { to: '/mobile/search', label: 'Global Search', icon: Search },
    { to: '/mobile/notifications', label: 'Notifications', icon: Bell },
    { to: '/mobile/deleted-bills', label: 'Deleted Bills', icon: Trash2 },
    { to: '/mobile/refunds', label: 'Refund Logs', icon: ArrowLeftRight },
    { to: '/mobile/customers', label: 'Customers Directory', icon: Users },
    { to: '/mobile/customer-ledger', label: 'Customer Ledger', icon: BookOpen },
    { to: '/mobile/inventory', label: 'Inventory Rates', icon: Inbox },
    { to: '/mobile/advance-payments', label: 'Advance Deposits', icon: Wallet },
    { to: '/mobile/accounting', label: 'Accounting & Expenses', icon: DollarSign },
    { to: '/mobile/analytics', label: 'Store Analytics', icon: BarChart3 },
    { to: '/mobile/group-billing', label: 'Group Billing', icon: Layers },
    { to: '/mobile/customer-bills', label: 'Customer Invoices', icon: FileText },
    { to: '/mobile/portal', label: 'Upload Portal', icon: Upload },
    { to: '/mobile/receipt', label: 'Thermal Receipt', icon: Printer },
    { to: '/mobile/item-sales-report', label: 'Item Sales Report', icon: Tag },
    { to: '/mobile/data-management', label: 'Data & Backup', icon: Database },
  ]

  return (
    <>
      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `mobile-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <button
          className="mobile-nav-item"
          onClick={() => setShowMoreDrawer(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Grid size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* More Modules Bottom Sheet Drawer */}
      <BottomSheet isOpen={showMoreDrawer} onClose={() => setShowMoreDrawer(false)} title="System Navigation Terminal">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
          {moreModules.map(m => {
            const Icon = m.icon
            return (
              <div
                key={m.to}
                onClick={() => {
                  setShowMoreDrawer(false)
                  navigate(m.to)
                }}
                style={{
                  padding: '12px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Icon size={18} style={{ color: 'var(--accent-secondary)' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{m.label}</span>
              </div>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}

function TagIcon(props) {
  return <BarChart3 {...props} />
}
