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

// Mobile Page Imports
import MobileAuth from './pages/mobile/MobileAuth'
import MobileDashboard from './pages/mobile/MobileDashboard'
import MobileBillingList from './pages/mobile/MobileBillingList'
import MobileBillDetail from './pages/mobile/MobileBillDetail'
import MobileCreateBill from './pages/mobile/MobileCreateBill'
import MobileSettings from './pages/mobile/MobileSettings'
import MobileRecurringBills from './pages/mobile/MobileRecurringBills'
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

import ViewportBanner from './components/mobile/ViewportBanner'
import { useMobileDetect } from './hooks/useMobileDetect'

function App() {
  const { currentUser } = useAppContext()
  const location = useLocation()
  const navigate = useNavigate()
  const { isMobile, isTablet, userPref, setUserPref } = useMobileDetect()

  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const isMobileRoute = location.pathname.startsWith('/mobile')
  const isAuthCallback = location.pathname === '/auth/callback'

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
        <Route path="/mobile/recurring-bills" element={<MobileRecurringBills />} />
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
        <Route path="*" element={<Navigate to="/mobile/dashboard" replace />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
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
