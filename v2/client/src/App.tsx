import { useState, useEffect } from 'react';
import { useAuthStore } from './hooks/useAuthStore';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import GroupBilling from './pages/GroupBilling';
import RecurringBills from './pages/RecurringBills';
import Customers from './pages/Customers';
import CustomerLedger from './pages/CustomerLedger';
import AdvancePayments from './pages/AdvancePayments';
import Expenses from './pages/Expenses';
import Refunds from './pages/Refunds';
import Accounting from './pages/Accounting';
import Analytics from './pages/Analytics';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';

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
      
      <main className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'billing' && <Billing />}
        {activeTab === 'group-billing' && <GroupBilling />}
        {activeTab === 'recurring' && <RecurringBills />}
        {activeTab === 'customers' && <Customers onViewLedger={handleViewLedger} />}
        {activeTab === 'advance' && <AdvancePayments />}
        {activeTab === 'expenses' && <Expenses />}
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
      </main>
    </div>
  );
}

export default App;
