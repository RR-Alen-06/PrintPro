import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import MobileNavDock from './components/layout/MobileNavDock'
import FullPageSkeleton from './components/common/FullPageSkeleton'
import OfflineBanner from './components/common/OfflineBanner'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import Customers from './pages/Customers'
import Accounting from './pages/Accounting'
import Inventory from './pages/Inventory'
import NotificationsPage from './pages/Notifications'
import DeletedBills from './pages/DeletedBills'
import Settings from './pages/Settings'
import DataManagement from './pages/DataManagement'
import Search from './pages/Search'
import Receipt from './pages/Receipt'
import Auth from './pages/Auth'
import Analytics from './pages/Analytics'
import PaymentReceived from './pages/PaymentReceived'
import AuthCallback from './pages/AuthCallback'
import Refunds from './pages/Refunds'
import CashRegister from './pages/CashRegister'
import PromosAndLoyalty from './pages/PromosAndLoyalty'

function App() {
  const { currentUser, hydrated, isOnline } = useAppContext()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  React.useEffect(() => {
    localStorage.removeItem('printpro-sidebar-collapsed')
    const handleWheel = (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.preventDefault()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Reactively check if we are handling OAuth redirect callback
  const isAuthCallback = location.pathname === '/auth/callback'

  // Show login page if not authenticated
  if (!currentUser && !isAuthCallback) {
    return <Auth />
  }

  // Render AuthCallback in full screen layout
  if (isAuthCallback) {
    return <AuthCallback />
  }

  // Show full-page skeleton while hydrating initial cloud state
  if (currentUser && hydrated === false) {
    return <FullPageSkeleton />
  }

  return (
    <div className="app-layout">
      {!isOnline && <OfflineBanner />}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <MobileNavDock onOpenMenu={() => setSidebarOpen(true)} />
      <div className="main-wrapper">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/payments" element={<PaymentReceived />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/deleted-bills" element={<DeletedBills />} />
            <Route path="/promos-and-loyalty" element={<PromosAndLoyalty />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/data-management" element={<DataManagement />} />
            <Route path="/search" element={<Search />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/customer-ledger" element={<Navigate to="/customers?tab=ledger" replace />} />
            <Route path="/customer-bills" element={<Navigate to="/customers?tab=bills" replace />} />
            <Route path="/advance-payments" element={<Navigate to="/payments" replace />} />
            <Route path="/cash-register" element={<CashRegister />} />
            <Route path="/upi-reconciliation" element={<Navigate to="/cash-register?tab=upi" replace />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/group-billing" element={<Navigate to="/billing?mode=group" replace />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
