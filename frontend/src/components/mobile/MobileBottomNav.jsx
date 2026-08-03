import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, PlusCircle, Settings } from 'lucide-react'

export default function MobileBottomNav() {
  const navItems = [
    { to: '/mobile/dashboard', label: 'Home', icon: LayoutDashboard },
    { to: '/mobile/billing', label: 'Bills', icon: Receipt },
    { to: '/mobile/create-bill', label: 'New Bill', icon: PlusCircle },
    { to: '/mobile/settings', label: 'Settings', icon: Settings },
  ]

  return (
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
    </nav>
  )
}
