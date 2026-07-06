import { Printer, Home, Users, BookOpen, Settings, LogOut, FileText, Layers, Wallet, DollarSign, RotateCcw, BarChart3, TrendingUp, Clock, Search, Receipt, Download } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuthStore';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { logout, business, user } = useAuthStore();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'jobs', label: 'Jobs', icon: Layers },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'estimates', label: 'Estimates', icon: FileText },
    { id: 'receipts', label: 'Receipts', icon: Printer },
    { id: 'group-billing', label: 'Group Billing', icon: Users },
    { id: 'customer-bills', label: 'Customer Bills', icon: FileText },
    { id: 'recurring', label: 'Recurring Bills', icon: Clock },
    { id: 'deleted-bills', label: 'Deleted Bills', icon: RotateCcw },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'advance', label: 'Advance Payments', icon: Wallet },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'vendors', label: 'Vendors', icon: Users },
    { id: 'refunds', label: 'Refunds', icon: RotateCcw },
    { id: 'accounting', label: 'Accounting', icon: BarChart3 },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'ledger', label: 'Customer Ledger', icon: BookOpen },
    { id: 'inventory', label: 'Inventory', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'data-management', label: 'Data', icon: Download },
  ];

  return (
    <aside className="w-64 bg-[#0a0a0f] border-r border-gray-800/80 flex flex-col h-screen shrink-0 relative z-25">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/15" >
          <Printer size={20} />
        </div>
        <div>
          <span className="font-black text-white text-lg tracking-tight block">PrintPro</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Workspace</span>
        </div>
      </div>

      {/* Nav Link List */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/15'
                  : 'text-gray-400 hover:bg-gray-900/60 hover:text-white'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile / Logout Footer */}
      <div className="p-4 border-t border-gray-800/80 bg-gray-950/20">
        <div className="flex items-center justify-between gap-2 bg-[#0c0b11] border border-gray-800/50 rounded-xl p-3.5">
          <div className="min-w-0">
            <span className="font-bold text-white text-xs block truncate">{business?.shopName || 'Store'}</span>
            <span className="text-[10px] text-gray-500 block truncate">{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
