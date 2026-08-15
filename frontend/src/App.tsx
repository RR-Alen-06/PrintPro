import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import Customers from './pages/Customers'
import Accounting from './pages/Accounting'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import DataManagement from './pages/DataManagement'
import Search from './pages/Search'
import Receipt from './pages/Receipt'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import Analytics from './pages/Analytics'
import ItemSalesReport from './pages/ItemSalesReport'
import CustomerLedger from './pages/CustomerLedger'
import CustomerBills from './pages/CustomerBills'
import AdvancePayments from './pages/AdvancePayments'
import GroupBilling from './pages/GroupBilling'
import Refunds from './pages/Refunds'
import CustomerPortal from './pages/CustomerPortal'
import NotificationsPage from './pages/Notifications'
import DeletedBills from './pages/DeletedBills'
import ErrorBoundary from './components/common/ErrorBoundary'

// Mobile Page Imports
import MobileAuth from './pages/mobile/MobileAuth'
import MobileDashboard from './pages/mobile/MobileDashboard'
import MobileBillingList from './pages/mobile/MobileBillingList'
import MobileBillDetail from './pages/mobile/MobileBillDetail'
import MobileCreateBill from './pages/mobile/MobileCreateBill'
import MobileSettings from './pages/mobile/MobileSettings'
import MobileRefunds from './pages/mobile/MobileRefunds'
import MobileCustomers from './pages/mobile/MobileCustomers'
import MobileCustomerLedger from './pages/mobile/MobileCustomerLedger'
import MobileInventory from './pages/mobile/MobileInventory'
import MobileAdvancePayments from './pages/mobile/MobileAdvancePayments'
import MobileAccounting from './pages/mobile/MobileAccounting'
import MobileAnalytics from './pages/mobile/MobileAnalytics'
import MobileGroupBilling from './pages/mobile/MobileGroupBilling'
import MobileCustomerBills from './pages/mobile/MobileCustomerBills'
import MobileCustomerPortal from './pages/mobile/MobileCustomerPortal'
import MobileReceipt from './pages/mobile/MobileReceipt'
import MobileItemSalesReport from './pages/mobile/MobileItemSalesReport'
import MobileDataManagement from './pages/mobile/MobileDataManagement'
import MobileNotifications from './pages/mobile/MobileNotifications'
import MobileDeletedBills from './pages/mobile/MobileDeletedBills'
import MobileSearch from './pages/mobile/MobileSearch'

import ViewportBanner from './components/mobile/ViewportBanner'
import { useMobileDetect } from './hooks/useMobileDetect'

function App() {
  const { currentUser, isInitialLoading } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, isTablet, userPref, setUserPref, effectiveMode } = useMobileDetect()

  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const isMobileRoute = location.pathname.startsWith('/mobile')
  const isAuthCallback = location.pathname === '/auth/callback'
  const isAuthPage = location.pathname === '/auth'
  const isMobileAuthPage = location.pathname === '/mobile/auth'

  // Render Auth Callback in full screen
  if (isAuthCallback) {
    return <AuthCallback />
  }

  // 1. Initial boot / session check in progress -> Show loading spinner
  if (isInitialLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>Loading secure user session...</p>
      </div>
    )
  }

  // Handle Mobile Auth Page directly (prevents infinite redirect loop when !currentUser on /mobile/auth)
  if (isMobileAuthPage) {
    if (currentUser) {
      return <Navigate to="/mobile/dashboard" replace />
    }
    return <MobileAuth />
  }

  // Handle Desktop Auth Page
  if (isAuthPage) {
    if (currentUser) {
      if (effectiveMode === 'mobile' && userPref !== 'desktop') {
        return <Navigate to="/mobile/dashboard" replace />
      }
      return <Navigate to="/dashboard" replace />
    }
    if (effectiveMode === 'mobile' && userPref !== 'desktop') {
      return <Navigate to="/mobile/auth" replace />
    }
    return <Auth />
  }

  // 2. Unauthenticated visitor trying to access protected routes -> Redirect to appropriate auth page
  if (!currentUser) {
    if (effectiveMode === 'mobile' && userPref !== 'desktop') {
      return <Navigate to="/mobile/auth" replace />
    }
    return <Navigate to="/auth" replace />
  }

  // 3. Auto-redirect on root "/" or direct "/dashboard" landing if on mobile device (respecting explicit userPref)
  if (!isMobileRoute && effectiveMode === 'mobile' && userPref !== 'desktop') {
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return <Navigate to="/mobile/dashboard" replace />
    }
  }

  // Render Mobile App Routes in standalone mobile layout wrapped in ErrorBoundary
  if (isMobileRoute) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/mobile/auth" element={<MobileAuth />} />
          <Route path="/mobile/dashboard" element={<MobileDashboard />} />
          <Route path="/mobile/billing" element={<MobileBillingList />} />
          <Route path="/mobile/bill/:id" element={<MobileBillDetail />} />
          <Route path="/mobile/create-bill" element={<MobileCreateBill />} />
          <Route path="/mobile/settings" element={<MobileSettings />} />
          <Route path="/mobile/refunds" element={<MobileRefunds />} />
          <Route path="/mobile/customers" element={<MobileCustomers />} />
          <Route path="/mobile/customer-ledger" element={<MobileCustomerLedger />} />
          <Route path="/mobile/inventory" element={<MobileInventory />} />
          <Route path="/mobile/advance-payments" element={<MobileAdvancePayments />} />
          <Route path="/mobile/accounting" element={<MobileAccounting />} />
          <Route path="/mobile/analytics" element={<MobileAnalytics />} />
          <Route path="/mobile/group-billing" element={<MobileGroupBilling />} />
          <Route path="/mobile/customer-bills" element={<MobileCustomerBills />} />
          <Route path="/mobile/portal" element={<MobileCustomerPortal />} />
          <Route path="/mobile/receipt" element={<MobileReceipt />} />
          <Route path="/mobile/item-sales-report" element={<MobileItemSalesReport />} />
          <Route path="/mobile/data-management" element={<MobileDataManagement />} />
          <Route path="/mobile/notifications" element={<MobileNotifications />} />
          <Route path="/mobile/deleted-bills" element={<MobileDeletedBills />} />
          <Route path="/mobile/search" element={<MobileSearch />} />
          <Route path="*" element={<Navigate to="/mobile/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  return (
    <div className="app-layout aurora-canvas">
      {isTablet && !userPref && !isMobileRoute && (
        <ViewportBanner
          onSwitchToMobile={() => {
            setUserPref('mobile')
            navigate('/mobile/dashboard')
          }}
          onDismiss={() => setUserPref('desktop')}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="main-content">
          <ErrorBoundary>
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
              <Route path="/item-sales-report" element={<ItemSalesReport />} />
              <Route path="/customer-ledger" element={<CustomerLedger />} />
              <Route path="/customer-bills" element={<CustomerBills />} />
              <Route path="/advance-payments" element={<AdvancePayments />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/group-billing" element={<GroupBilling />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/portal" element={<CustomerPortal />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default App
