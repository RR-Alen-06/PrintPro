import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAppContext } from './context/AppContext'
import ErrorBoundary from './components/common/ErrorBoundary'

// Unified App Views (Cyberpunk Mobile-First Architecture)
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
import AuthCallback from './pages/AuthCallback'

import './styles/mobile.css'

// Backward-compatibility redirect helpers for sub-tab parameters
function TabRedirect({ targetPath, defaultTab }: { targetPath: string; defaultTab: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  if (!params.get('tab')) params.set('tab', defaultTab)
  return <Navigate to={`${targetPath}?${params.toString()}`} replace />
}

function SearchTriggerRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'))
  }, [])
  return <Navigate to="/dashboard" replace />
}

function NotificationsTriggerRedirect() {
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('open-notification-drawer'))
  }, [])
  return <Navigate to="/dashboard" replace />
}

function App() {
  const { currentUser, isInitialLoading } = useAppContext()
  const location = useLocation()

  // 1. Initial boot / session check in progress -> Show cyberpunk loading state
  if (isInitialLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#05040a', color: '#fff', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,47,176,0.15)', borderTopColor: '#00f0ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '14px', color: '#9d94c0', fontFamily: 'JetBrains Mono, monospace' }}>INITIALIZING SECURE SESSION...</p>
      </div>
    )
  }

  // 2. Auth Callback Route
  if (location.pathname === '/auth/callback') {
    return <AuthCallback />
  }

  // 3. Unauthenticated visitor handling
  if (!currentUser) {
    if (location.pathname === '/auth' || location.pathname === '/mobile/auth') {
      return <MobileAuth />
    }
    return <Navigate to="/auth" replace />
  }

  // 4. Authenticated visitor on auth pages -> redirect to home dashboard
  if (location.pathname === '/auth' || location.pathname === '/mobile/auth') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <ErrorBoundary key={location.pathname} resetKey={location.pathname}>
      <Routes>
        {/* Core Root Application Routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<MobileDashboard />} />
        <Route path="/billing" element={<MobileBillingList />} />
        <Route path="/create-bill" element={<MobileCreateBill />} />
        <Route path="/bill/:id" element={<MobileBillDetail />} />
        <Route path="/customers" element={<MobileCustomers />} />
        <Route path="/accounting" element={<MobileAccounting />} />
        <Route path="/inventory" element={<MobileInventory />} />
        <Route path="/group-billing" element={<MobileGroupBilling />} />
        <Route path="/receipt" element={<MobileReceipt />} />
        <Route path="/settings" element={<MobileSettings />} />
        <Route path="/auth" element={<MobileAuth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Legacy /mobile/* Compatibility Redirects */}
        <Route path="/mobile/dashboard" element={<Navigate to="/dashboard" replace />} />
        <Route path="/mobile/billing" element={<Navigate to="/billing" replace />} />
        <Route path="/mobile/create-bill" element={<Navigate to="/create-bill" replace />} />
        <Route path="/mobile/bill/:id" element={<MobileBillDetail />} />
        <Route path="/mobile/customers" element={<Navigate to="/customers" replace />} />
        <Route path="/mobile/accounting" element={<Navigate to="/accounting" replace />} />
        <Route path="/mobile/inventory" element={<Navigate to="/inventory" replace />} />
        <Route path="/mobile/group-billing" element={<Navigate to="/group-billing" replace />} />
        <Route path="/mobile/receipt" element={<Navigate to="/receipt" replace />} />
        <Route path="/mobile/settings" element={<Navigate to="/settings" replace />} />
        <Route path="/mobile/auth" element={<Navigate to="/auth" replace />} />

        {/* Legacy Desktop Sub-Module Route Redirects */}
        <Route path="/analytics" element={<TabRedirect targetPath="/accounting" defaultTab="analytics" />} />
        <Route path="/mobile/analytics" element={<TabRedirect targetPath="/accounting" defaultTab="analytics" />} />
        <Route path="/item-sales-report" element={<TabRedirect targetPath="/accounting" defaultTab="items" />} />
        <Route path="/mobile/item-sales-report" element={<TabRedirect targetPath="/accounting" defaultTab="items" />} />
        <Route path="/refunds" element={<TabRedirect targetPath="/accounting" defaultTab="refunds" />} />
        <Route path="/mobile/refunds" element={<TabRedirect targetPath="/accounting" defaultTab="refunds" />} />
        <Route path="/customer-ledger" element={<TabRedirect targetPath="/customers" defaultTab="ledger" />} />
        <Route path="/mobile/customer-ledger" element={<TabRedirect targetPath="/customers" defaultTab="ledger" />} />
        <Route path="/customer-bills" element={<TabRedirect targetPath="/customers" defaultTab="bills" />} />
        <Route path="/mobile/customer-bills" element={<TabRedirect targetPath="/customers" defaultTab="bills" />} />
        <Route path="/advance-payments" element={<TabRedirect targetPath="/customers" defaultTab="advances" />} />
        <Route path="/mobile/advance-payments" element={<TabRedirect targetPath="/customers" defaultTab="advances" />} />
        <Route path="/deleted-bills" element={<TabRedirect targetPath="/settings" defaultTab="recycle-bin" />} />
        <Route path="/mobile/deleted-bills" element={<TabRedirect targetPath="/settings" defaultTab="recycle-bin" />} />
        <Route path="/data-management" element={<TabRedirect targetPath="/settings" defaultTab="backup" />} />
        <Route path="/mobile/data-management" element={<TabRedirect targetPath="/settings" defaultTab="backup" />} />
        <Route path="/search" element={<SearchTriggerRedirect />} />
        <Route path="/mobile/search" element={<SearchTriggerRedirect />} />
        <Route path="/notifications" element={<NotificationsTriggerRedirect />} />
        <Route path="/mobile/notifications" element={<NotificationsTriggerRedirect />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
