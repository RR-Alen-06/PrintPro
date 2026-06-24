import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
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
import CustomerLedger from './pages/CustomerLedger'
import RecurringBills from './pages/RecurringBills'
import Analytics from './pages/Analytics'
import AdvancePayments from './pages/AdvancePayments'
import CustomerBills from './pages/CustomerBills'
import AuthCallback from './pages/AuthCallback'
import GroupBilling from './pages/GroupBilling'
import Refunds from './pages/Refunds'

function App() {
  const { currentUser } = useAppContext()

  React.useEffect(() => {
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

  // Check if we are handling OAuth redirect callback
  const isAuthCallback = window.location.pathname === '/auth/callback'

  // Show login page if not authenticated
  if (!currentUser && !isAuthCallback) {
    return <Auth />
  }

  // Render AuthCallback in full screen layout
  if (isAuthCallback) {
    return <AuthCallback />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/deleted-bills" element={<DeletedBills />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/data-management" element={<DataManagement />} />
            <Route path="/search" element={<Search />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/customer-ledger" element={<CustomerLedger />} />
            <Route path="/customer-bills" element={<CustomerBills />} />
            <Route path="/recurring-bills" element={<RecurringBills />} />
            <Route path="/advance-payments" element={<AdvancePayments />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/group-billing" element={<GroupBilling />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
