import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
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
import ItemSalesReport from './pages/ItemSalesReport'
import AdvancePayments from './pages/AdvancePayments'
import CustomerBills from './pages/CustomerBills'
import AuthCallback from './pages/AuthCallback'
import GroupBilling from './pages/GroupBilling'
import Refunds from './pages/Refunds'
import CustomerPortal from './pages/CustomerPortal'
import MobileAuth from './pages/mobile/MobileAuth'
import MobileDashboard from './pages/mobile/MobileDashboard'
import MobileBillingList from './pages/mobile/MobileBillingList'
import MobileBillDetail from './pages/mobile/MobileBillDetail'
import MobileCreateBill from './pages/mobile/MobileCreateBill'
import MobileSettings from './pages/mobile/MobileSettings'
import ViewportBanner from './components/mobile/ViewportBanner'
import { useMobileDetect } from './hooks/useMobileDetect'

function App() {
  const { currentUser } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [dismissBanner, setDismissBanner] = React.useState(false)

  const { isPhone, isTablet, userPref, setUserPref } = useMobileDetect()

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

  // Auto-redirect phones (<480px) to mobile view unless explicit desktop preference set
  React.useEffect(() => {
    if (isPhone && userPref !== 'desktop' && !location.pathname.startsWith('/mobile') && location.pathname !== '/portal' && location.pathname !== '/auth/callback') {
      navigate('/mobile/dashboard', { replace: true })
    }
  }, [isPhone, userPref, location.pathname, navigate])

  const isAuthCallback = location.pathname === '/auth/callback'
  const isCustomerPortal = location.pathname === '/portal'
  const isMobileRoute = location.pathname.startsWith('/mobile')

  // Render Customer Portal in full screen layout for public customers
  if (isCustomerPortal) {
    return <CustomerPortal />
  }

  // Handle Mobile Auth route or unauthenticated mobile users
  if (isMobileRoute && !currentUser && !isAuthCallback) {
    return <MobileAuth />
  }

  // Show login page if not authenticated
  if (!currentUser && !isAuthCallback) {
    return <Auth />
  }

  // Render AuthCallback in full screen layout
  if (isAuthCallback) {
    return <AuthCallback />
  }

  // Render Mobile App Routes in standalone mobile layout
  if (isMobileRoute) {
    return (
      <Routes>
        <Route path="/mobile/auth" element={<MobileAuth />} />
        <Route path="/mobile/dashboard" element={<MobileDashboard />} />
        <Route path="/mobile/billing" element={<MobileBillingList />} />
        <Route path="/mobile/bill/:id" element={<MobileBillDetail />} />
        <Route path="/mobile/create-bill" element={<MobileCreateBill />} />
        <Route path="/mobile/settings" element={<MobileSettings />} />
        <Route path="*" element={<Navigate to="/mobile/dashboard" replace />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      {isTablet && !dismissBanner && userPref === null && !isMobileRoute && (
        <ViewportBanner
          onSwitchToMobile={() => {
            setUserPref('mobile')
            navigate('/mobile/dashboard')
          }}
          onDismiss={() => setDismissBanner(true)}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header onMenuClick={() => setSidebarOpen(true)} />
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
            <Route path="/mobile/auth" element={<MobileAuth />} />
            <Route path="/mobile/dashboard" element={<MobileDashboard />} />
            <Route path="/mobile/billing" element={<MobileBillingList />} />
            <Route path="/mobile/bill/:id" element={<MobileBillDetail />} />
            <Route path="/mobile/create-bill" element={<MobileCreateBill />} />
            <Route path="/mobile/settings" element={<MobileSettings />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/item-sales-report" element={<ItemSalesReport />} />
            <Route path="/customer-ledger" element={<CustomerLedger />} />
            <Route path="/customer-bills" element={<CustomerBills />} />
            <Route path="/recurring-bills" element={<RecurringBills />} />
            <Route path="/advance-payments" element={<AdvancePayments />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/group-billing" element={<GroupBilling />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
