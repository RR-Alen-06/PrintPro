import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { useAuthStore } from '../hooks/useAuthStore';
import { TrendingUp, CreditCard, Clock, Wallet, CheckCircle, XCircle, LogOut } from 'lucide-react';

interface RecentBill {
  id: string;
  customerName: string;
  date: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: 'paid' | 'partial' | 'unpaid';
}

interface DashboardData {
  revenue: number;
  cashInflow: number;
  pendingDues: number;
  refunds: number;
  totalCustomerAdvance: number;
  netProfit: number;
  netCashFlow: number;
  overdueBillsCount: number;
  recentBills: RecentBill[];
  totalCustomers: number;
  paidBillsCount: number;
  partialBillsCount: number;
  unpaidBillsCount: number;
}

export default function Dashboard() {
  const { logout, user, business } = useAuthStore();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboardSummary'],
    queryFn: () => apiRequest<DashboardData>('/dashboard/summary'),
    refetchInterval: 10000, // Auto refetch every 10 seconds for real-time dashboard parity
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07060a] text-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#07060a] text-red-400 flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold mb-2">Failed to load dashboard data</h2>
          <p className="text-sm opacity-80 mb-4">{error?.toString() || 'Unknown error occurred'}</p>
          <button onClick={logout} className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl hover:bg-red-500/30 text-red-200 transition-all cursor-pointer">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07060a] text-gray-100 p-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] -top-40 -left-40 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[120px] -bottom-40 -right-40 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-10 pb-6 border-b border-gray-800/80 relative z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{business?.shopName || 'PrintPro Store'}</h1>
          <p className="text-gray-400 mt-1">Hello, {business?.ownerName || user?.email} · Merchant Workspace</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer text-sm font-semibold"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
        {/* Total Revenue */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-purple-600/20 text-purple-400 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-semibold uppercase text-purple-400 tracking-wider">Revenue</span>
          </div>
          <h3 className="text-3xl font-black text-white">₹{data.revenue.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-2">{data.paidBillsCount} invoices fully settled</p>
        </div>

        {/* Cash Inflow */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-xl flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
            <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">Cash Inflow</span>
          </div>
          <h3 className="text-3xl font-black text-emerald-400">₹{data.cashInflow.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-2">Active cash collections</p>
        </div>

        {/* Pending Dues */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-amber-600/20 text-amber-400 rounded-xl flex items-center justify-center">
              <CreditCard size={24} />
            </div>
            <span className="text-xs font-semibold uppercase text-amber-400 tracking-wider">Pending Dues</span>
          </div>
          <h3 className="text-3xl font-black text-amber-400">₹{data.pendingDues.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-2">{data.partialBillsCount + data.unpaidBillsCount} invoices outstanding</p>
        </div>

        {/* Refunds */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-red-600/20 text-red-400 rounded-xl flex items-center justify-center">
              <XCircle size={24} />
            </div>
            <span className="text-xs font-semibold uppercase text-red-400 tracking-wider">Refunds</span>
          </div>
          <h3 className="text-3xl font-black text-red-400">₹{data.refunds.toFixed(2)}</h3>
          <p className="text-xs text-gray-500 mt-2">Returned payment credits</p>
        </div>
      </div>

      {/* Second Row: Advance Balance + Profit + Cash Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
        {/* Advance Balance */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">Customer Advances</span>
            <span className="text-2xl font-black text-white">₹{data.totalCustomerAdvance.toFixed(2)}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${data.netProfit >= 0 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}`}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">Net Profit (Revenue - Expense)</span>
            <span className={`text-2xl font-black ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{data.netProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 shadow-lg flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${data.netCashFlow >= 0 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400'}`}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-400 block uppercase tracking-wider font-semibold">Net Cash Flow</span>
            <span className={`text-2xl font-black ${data.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>₹{data.netCashFlow.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Third Row: Recent Activity Table */}
      <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-8 shadow-lg relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Recent Print Invoices</h2>
            <p className="text-sm text-gray-500">Track latest customer print jobs and balances</p>
          </div>
          <div className="flex gap-4 text-sm font-semibold text-gray-400">
            <span className="flex items-center gap-1.5"><Clock size={16} className="text-red-400" /> {data.overdueBillsCount} Overdue</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={16} className="text-emerald-400" /> {data.totalCustomers} Active Customers</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead>
              <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                <th className="py-4">Invoice No</th>
                <th className="py-4">Customer</th>
                <th className="py-4">Date</th>
                <th className="py-4">Amount</th>
                <th className="py-4">Paid</th>
                <th className="py-4">Pending</th>
                <th className="py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {data.recentBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-900/35 transition-all">
                  <td className="py-4 font-mono text-purple-400 font-semibold">{bill.id}</td>
                  <td className="py-4 font-bold text-white">{bill.customerName}</td>
                  <td className="py-4 text-gray-400">{bill.date}</td>
                  <td className="py-4">₹{bill.total.toFixed(2)}</td>
                  <td className="py-4 text-emerald-400 font-medium">₹{bill.amountPaid.toFixed(2)}</td>
                  <td className={`py-4 font-bold ${bill.balance > 0 ? 'text-amber-400' : 'text-gray-500'}`}>₹{bill.balance.toFixed(2)}</td>
                  <td className="py-4">
                    <span className={`inline-flex px-2.5 py-1 text-xs font-semibold uppercase rounded-full tracking-wide ${
                      bill.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      bill.status === 'partial' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                </tr>
              ))}

              {data.recentBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-medium">
                    No invoice transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
