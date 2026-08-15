import React from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Home, FileText, Users, DollarSign, Layers, Bell, Trash2, Settings, Download, Search as SearchIcon, Receipt, TrendingUp, Wallet, BookOpen, RefreshCw, GitMerge, X, LogOut, User, ShieldCheck } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

// permKey = key in staffPermissions; undefined means always show
const navItems = [
  { label: 'Dashboard',        path: '/dashboard',         icon: Home,         permKey: undefined },
  { label: 'Billing',          path: '/billing',           icon: FileText,     permKey: 'billing' },
  { label: 'Group Billing',    path: '/group-billing',     icon: GitMerge,     permKey: 'billing' },
  { label: 'Customers',        path: '/customers',         icon: Users,        permKey: 'customers' },
  { label: 'Advance Payments', path: '/advance-payments',  icon: Wallet,       permKey: 'advancePayments' },
  { label: 'Accounting',       path: '/accounting',        icon: DollarSign,   permKey: 'accounting' },
  { label: 'Refunds',          path: '/refunds',           icon: RefreshCw,    permKey: 'accounting' },
  { label: 'Analytics',        path: '/analytics',         icon: TrendingUp,   permKey: 'accounting' },
  { label: 'Item Sales Report',path: '/item-sales-report', icon: Layers,       permKey: 'accounting' },
  { label: 'Inventory',        path: '/inventory',         icon: Layers,       permKey: 'inventory' },
  { label: 'Customer Ledger',  path: '/customer-ledger',   icon: BookOpen,     permKey: 'ledger' },
  { label: 'Customer Bills',   path: '/customer-bills',    icon: FileText,     permKey: 'customers' },
  { label: 'Receipt',          path: '/receipt',           icon: Receipt,      permKey: 'receipt' },
  { label: 'Search',           path: '/search',            icon: SearchIcon,   permKey: 'search' },
  { label: 'Notifications',    path: '/notifications',     icon: Bell,         permKey: undefined },
  { label: 'Data Management',  path: '/data-management',   icon: Download,     permKey: 'dataManagement' },
  { label: 'Deleted Bills',    path: '/deleted-bills',     icon: Trash2,       permKey: 'deletedBills' },
  { label: 'Settings',         path: '/settings',          icon: Settings,     permKey: 'settings' },
]

const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser, settings, logout } = useAppContext()
  const isMerchant = !!currentUser

  const visibleItems = navItems.filter((item) => {
    if (item.path === '/refunds' && settings?.refundsEnabled === false) {
      return false
    }
    if (isMerchant) return true
    return item.permKey === undefined
  })

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside
        className={`sidebar ${isOpen ? 'open' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, rgba(14, 8, 28, 0.88) 0%, rgba(5, 1, 15, 0.96) 100%)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderRight: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
          boxShadow: '10px 0 30px rgba(0, 0, 0, 0.6)'
        }}
      >
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>

        {/* Brand Header */}
        <div
          className="sidebar-logo"
          style={{
            padding: '20px 20px',
            borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(112, 0, 255, 0.3) 100%)',
              border: '1px solid var(--aurora-cyan, #00f0ff)',
              boxShadow: '0 0 16px rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--aurora-cyan, #00f0ff)',
              flexShrink: 0
            }}
          >
            <Printer size={20} />
          </div>
          <div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #00f0ff 0%, #ff2fb0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2
              }}
            >
              PrintPro ERP
            </div>
            <div
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono, JetBrains Mono)',
                letterSpacing: '0.08em',
                color: 'var(--text-muted, #849495)',
                fontWeight: 600
              }}
            >
              AURORA POS • 2026
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                onClick={onClose}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                  background: isActive ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 16px rgba(0, 240, 255, 0.15)' : 'none',
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 500,
                  marginBottom: '3px',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none'
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={18}
                      style={{
                        color: isActive ? 'var(--aurora-cyan, #00f0ff)' : 'inherit',
                        filter: isActive ? 'drop-shadow(0 0 6px rgba(0,240,255,0.6))' : 'none',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--aurora-cyan, #00f0ff)',
                          boxShadow: '0 0 8px var(--aurora-cyan, #00f0ff)'
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer Account Badge */}
        {currentUser && (
          <div
            style={{
              padding: '14px 16px',
              borderTop: '1px solid var(--border-glass, rgba(255, 255, 255, 0.08))',
              background: 'rgba(10, 5, 20, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#05010f',
                  fontWeight: 'bold',
                  boxShadow: '0 0 10px rgba(0, 240, 255, 0.3)'
                }}
              >
                <User size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text-primary, #f8fafc)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={currentUser.email}
                >
                  {currentUser.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono, JetBrains Mono)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0, 255, 171, 0.15)',
                      border: '1px solid rgba(0, 255, 171, 0.3)',
                      color: 'var(--aurora-green, #00ffab)',
                      fontWeight: 600
                    }}
                  >
                    MERCHANT ADMIN
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (onClose) onClose()
                logout()
              }}
              className="aurora-btn-glass"
              style={{
                width: '100%',
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: '8px'
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

export default Sidebar
