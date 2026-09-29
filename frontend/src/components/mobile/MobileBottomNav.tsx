import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, PlusCircle, Settings, Grid,
  Users, Inbox, DollarSign, Layers, Printer
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
    { to: '/mobile/customers', label: 'Customer Hub', icon: Users },
    { to: '/mobile/accounting', label: 'Finance & Accounts', icon: DollarSign },
    { to: '/mobile/group-billing', label: 'Group Billing', icon: Layers },
    { to: '/mobile/inventory', label: 'Inventory Rates', icon: Inbox },
    { to: '/mobile/receipt', label: 'Thermal Receipt', icon: Printer },
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
