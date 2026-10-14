import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Wallet, Plus, Users, Menu } from 'lucide-react'

const MobileNavDock = ({ onOpenMenu }) => {
  const navigate = useNavigate()

  return (
    <div className="mobile-dock-wrapper">
      <nav className="mobile-tactile-dock" aria-label="Mobile Navigation">
        {/* Destination 1: Dashboard */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `mobile-dock-item${isActive ? ' active' : ''}`}
        >
          <Home size={20} />
          <span>Home</span>
        </NavLink>

        {/* Destination 2: Payment Received */}
        <NavLink
          to="/payments"
          className={({ isActive }) => `mobile-dock-item${isActive ? ' active' : ''}`}
        >
          <Wallet size={20} />
          <span>Payments</span>
        </NavLink>

        {/* Raised Central Quick-Sale Action Button */}
        <button
          type="button"
          className="mobile-dock-fab"
          onClick={() => navigate('/billing')}
          aria-label="New POS Sale"
          title="New POS Sale"
        >
          <Plus size={24} strokeWidth={2.8} />
        </button>

        {/* Destination 3: Customers */}
        <NavLink
          to="/customers"
          className={({ isActive }) => `mobile-dock-item${isActive ? ' active' : ''}`}
        >
          <Users size={20} />
          <span>Customers</span>
        </NavLink>

        {/* Destination 4: More Menu Drawer Trigger */}
        <button
          type="button"
          className="mobile-dock-item"
          onClick={onOpenMenu}
          aria-label="Open Navigation Drawer"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}

export default MobileNavDock
