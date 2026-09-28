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
import Receipt from './pages/Receipt'
import Auth from './pages/Auth'
import AuthCallback from './pages/AuthCallback'
import GroupBilling from './pages/GroupBilling'
import ErrorBoundary from './components/common/ErrorBoundary'

// Mobile Page Imports
import MobileAuth from './pages/mobile/MobileAuth'
import MobileDashboard from './pages/mobile/MobileDashboard'
import MobileBillingList from './pages/mobile/MobileBillingList'
import MobileBillDetail from './pages/mobile/MobileBillDetail'
import MobileCreateBill from './pages/mobile/MobileCreateBill'
import MobileSettings from './pages/mobile/MobileSettings'
import MobileCustomers from './pages/mobile/MobileCustomers'
import MobileInventory from './pages/mobile/MobileInventory'
import MobileAccounting from './pages/mobile/MobileAccounting'
import MobileGroupBilling from './pages/mobile/MobileGroupBilling'
import MobileReceipt from './pages/mobile/MobileReceipt'

import { useMobileDetect } from './hooks/useMobileDetect'

const desktopToMobilePathMap: Record<string, string> = {
  '/': '/mobile/dashboard',
  '/dashboard': '/mobile/dashboard',
  '/billing': '/mobile/billing',
  '/customers': '/mobile/customers',
  '/accounting': '/mobile/accounting',
  '/inventory': '/mobile/inventory',
  '/notifications': '/mobile/dashboard?action=notifications',
  '/deleted-bills': '/mobile/settings?tab=recycle-bin',
  '/settings': '/mobile/settings',
  '/data-management': '/mobile/settings?tab=backup',
  '/search': '/mobile/dashboard?action=search',
  '/receipt': '/mobile/receipt',
  '/auth': '/mobile/auth',
  '/analytics': '/mobile/accounting?tab=analytics',
  '/item-sales-report': '/mobile/accounting?tab=items',
  '/customer-ledger': '/mobile/customers',
  '/customer-bills': '/mobile/customers',
  '/advance-payments': '/mobile/customers',
  '/group-billing': '/mobile/group-billing',
  '/refunds': '/mobile/accounting?tab=refunds',
}

function LegacyCustomerRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/customers?${params.toString()}`} replace />
}

function LegacyMobileCustomerRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/mobile/customers?${params.toString()}`} replace />
}

function LegacyAccountingRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/accounting?${params.toString()}`} replace />
}

function LegacyMobileAccountingRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/mobile/accounting?${params.toString()}`} replace />
}

function LegacySettingsRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/settings?${params.toString()}`} replace />
}

function LegacyMobileSettingsRedirect({ defaultTab }: { defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`/mobile/settings?${params.toString()}`} replace />
}

function LegacySearchRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'))
  }, [])
  return <Navigate to="/dashboard" replace />
}

function LegacyMobileSearchRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'))
  }, [])
  return <Navigate to="/mobile/dashboard" replace />
}

function LegacyNotificationsRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-notification-drawer'))
  }, [])
  return <Navigate to="/dashboard" replace />
}

function LegacyMobileNotificationsRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-notification-drawer'))
  }, [])
  return <Navigate to="/mobile/dashboard" replace />
}

function App() {
  const { currentUser, isInitialLoading } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, userPref, setUserPref, effectiveMode } = useMobileDetect()

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

  // 3. Auto-redirect any desktop route to mobile equivalent if on mobile device (respecting explicit userPref === 'desktop')
  if (!isMobileRoute && effectiveMode === 'mobile' && userPref !== 'desktop') {
    const targetMobilePath = desktopToMobilePathMap[location.pathname] || '/mobile/dashboard'
    return <Navigate to={`${targetMobilePath}${location.search}`} replace />
  }

  // Render Mobile App Routes in standalone mobile layout wrapped in ErrorBoundary
  if (isMobileRoute) {
    return (
      <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
        <Routes>
          <Route path="/mobile/auth" element={<MobileAuth />} />
          <Route path="/mobile/dashboard" element={<MobileDashboard />} />
          <Route path="/mobile/billing" element={<MobileBillingList />} />
          <Route path="/mobile/bill/:id" element={<MobileBillDetail />} />
          <Route path="/mobile/create-bill" element={<MobileCreateBill />} />
          <Route path="/mobile/settings" element={<MobileSettings />} />
          <Route path="/mobile/refunds" element={<LegacyMobileAccountingRedirect defaultTab="refunds" />} />
          <Route path="/mobile/customers" element={<MobileCustomers />} />
          <Route path="/mobile/customer-ledger" element={<LegacyMobileCustomerRedirect defaultTab="ledger" />} />
          <Route path="/mobile/inventory" element={<MobileInventory />} />
          <Route path="/mobile/advance-payments" element={<LegacyMobileCustomerRedirect defaultTab="advances" />} />
          <Route path="/mobile/accounting" element={<MobileAccounting />} />
          <Route path="/mobile/analytics" element={<LegacyMobileAccountingRedirect defaultTab="analytics" />} />
          <Route path="/mobile/group-billing" element={<MobileGroupBilling />} />
          <Route path="/mobile/customer-bills" element={<LegacyMobileCustomerRedirect defaultTab="bills" />} />
          <Route path="/mobile/receipt" element={<MobileReceipt />} />
          <Route path="/mobile/item-sales-report" element={<LegacyMobileAccountingRedirect defaultTab="items" />} />
          <Route path="/mobile/data-management" element={<LegacyMobileSettingsRedirect defaultTab="backup" />} />
          <Route path="/mobile/notifications" element={<LegacyMobileNotificationsRedirect />} />
          <Route path="/mobile/deleted-bills" element={<LegacyMobileSettingsRedirect defaultTab="recycle-bin" />} />
          <Route path="/mobile/search" element={<LegacyMobileSearchRedirect />} />
          <Route path="*" element={<Navigate to="/mobile/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    )
  }

  return (
    <div className="app-layout aurora-canvas">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="main-content">
          <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/notifications" element={<LegacyNotificationsRedirect />} />
              <Route path="/deleted-bills" element={<LegacySettingsRedirect defaultTab="recycle-bin" />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/data-management" element={<LegacySettingsRedirect defaultTab="backup" />} />
              <Route path="/search" element={<LegacySearchRedirect />} />
              <Route path="/receipt" element={<Receipt />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/analytics" element={<LegacyAccountingRedirect defaultTab="analytics" />} />
              <Route path="/item-sales-report" element={<LegacyAccountingRedirect defaultTab="items" />} />
              <Route path="/customer-ledger" element={<LegacyCustomerRedirect defaultTab="ledger" />} />
              <Route path="/customer-bills" element={<LegacyCustomerRedirect defaultTab="bills" />} />
              <Route path="/advance-payments" element={<LegacyCustomerRedirect defaultTab="advances" />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/group-billing" element={<GroupBilling />} />
              <Route path="/refunds" element={<LegacyAccountingRedirect defaultTab="refunds" />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default App
