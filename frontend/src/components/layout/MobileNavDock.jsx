import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, FileText, Plus, Users, BookOpen } from 'lucide-react'

const MobileNavDock = () => {
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

        {/* Destination 2: Bills */}
        <NavLink
          to="/customer-bills"
          className={({ isActive }) => `mobile-dock-item${isActive ? ' active' : ''}`}
        >
          <FileText size={20} />
          <span>Bills</span>
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

        {/* Destination 4: Ledger */}
        <NavLink
          to="/customer-ledger"
          className={({ isActive }) => `mobile-dock-item${isActive ? ' active' : ''}`}
        >
          <BookOpen size={20} />
          <span>Ledger</span>
        </NavLink>
      </nav>
    </div>
  )
}

export default MobileNavDock
