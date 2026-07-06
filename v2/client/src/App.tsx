import { useState, useEffect } from 'react';
import { useAuthStore } from './hooks/useAuthStore';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import GroupBilling from './pages/GroupBilling';
import RecurringBills from './pages/RecurringBills';
import Customers from './pages/Customers';
import DeletedBills from './pages/DeletedBills';
import Receipt from './pages/Receipt';
import CustomerBills from './pages/CustomerBills';
import CustomerLedger from './pages/CustomerLedger';
import AdvancePayments from './pages/AdvancePayments';
import Expenses from './pages/Expenses';
import Refunds from './pages/Refunds';
import Accounting from './pages/Accounting';
import Search from './pages/Search';
import Analytics from './pages/Analytics';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import DataManagement from './pages/DataManagement';
import Estimates from './pages/Estimates';
import JobBoard from './pages/JobBoard';
import Vendors from './pages/Vendors';
import Sidebar from './components/Sidebar';
import Notifications from './components/Notifications';

function App() {
  const { token, initialize } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!token) {
    return <Auth />;
  }

  const handleViewLedger = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('ledger');
  };

  const handleClearLedgerSelection = () => {
    setSelectedCustomerId(undefined);
  };

  return (
    <div className="flex bg-[#07060a] min-h-screen text-gray-100 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto relative">
        <Notifications />
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'search' && <Search />}
        {activeTab === 'jobs' && <JobBoard />}
        {activeTab === 'receipts' && <Receipt />}
        {activeTab === 'customer-bills' && <CustomerBills />}
        {activeTab === 'billing' && <Billing />}
        {activeTab === 'estimates' && <Estimates />}
        {activeTab === 'deleted-bills' && <DeletedBills />}
        {activeTab === 'group-billing' && <GroupBilling />}
        {activeTab === 'recurring' && <RecurringBills />}
        {activeTab === 'customers' && <Customers onViewLedger={handleViewLedger} />}
        {activeTab === 'advance' && <AdvancePayments />}
        {activeTab === 'expenses' && <Expenses />}
        {activeTab === 'vendors' && <Vendors />}
        {activeTab === 'refunds' && <Refunds />}
        {activeTab === 'accounting' && <Accounting />}
        {activeTab === 'analytics' && <Analytics />}
        {activeTab === 'ledger' && (
          <CustomerLedger
            selectedCustomerId={selectedCustomerId}
            onClearSelection={handleClearLedgerSelection}
          />
        )}
        {activeTab === 'inventory' && <Inventory />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'data-management' && <DataManagement />}
      </main>
    </div>
  );
}

export default App;
