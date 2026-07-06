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

      {/* Third Row: Analytics SVG Chart */}
      <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-8 shadow-lg mb-8 relative z-10">
        <h2 className="text-xl font-bold text-white mb-1">Weekly Invoice Sales Trend</h2>
        <p className="text-sm text-gray-500 mb-6">Aggregated gross revenue of recent prints over calendar days.</p>

        {(() => {
          // Group recent bills by date
          const dateMap: Record<string, number> = {};
          data.recentBills.forEach(b => {
            const date = b.date;
            dateMap[date] = (dateMap[date] || 0) + b.total;
          });

          const sortedDates = Object.keys(dateMap).sort();
          if (sortedDates.length < 2) {
            return (
              <div className="h-48 flex items-center justify-center text-xs text-gray-600 border border-dashed border-gray-800 rounded-xl">
                Not enough date intervals to plot trend line. Create more invoices to view charts.
              </div>
            );
          }

          const values = sortedDates.map(d => dateMap[d]);
          const maxValue = Math.max(...values, 1000);
          
          // Chart dimensions
          const width = 800;
          const height = 200;
          const paddingLeft = 50;
          const paddingBottom = 30;
          const paddingTop = 10;
          const paddingRight = 20;

          const chartWidth = width - paddingLeft - paddingRight;
          const chartHeight = height - paddingTop - paddingBottom;

          // Map points
          const points = sortedDates.map((date, idx) => {
            const x = paddingLeft + (idx / (sortedDates.length - 1)) * chartWidth;
            const y = height - paddingBottom - (dateMap[date] / maxValue) * chartHeight;
            return { x, y, date, val: dateMap[date] };
          });

          // SVG paths
          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

          return (
            <div className="w-full overflow-x-auto">
              <div className="min-w-[600px] relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-xs">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = paddingTop + ratio * chartHeight;
                    const val = maxValue * (1 - ratio);
                    return (
                      <g key={idx}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={width - paddingRight}
                          y2={y}
                          stroke="#1f2937"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                        <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="#4b5563" className="font-mono text-[9px]">
                          ₹{Math.round(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Gradient Area */}
                  <path d={areaPath} fill="url(#chartGrad)" />

                  {/* Trend Line */}
                  <path d={linePath} fill="none" stroke="rgb(168, 85, 247)" strokeWidth={2.5} />

                  {/* Grid Date Points & Labels */}
                  {points.map((p, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="rgb(168, 85, 247)"
                        stroke="#07060a"
                        strokeWidth={1.5}
                      />
                      {/* Tooltip trigger hover circle */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={12}
                        fill="transparent"
                        className="peer"
                      />
                      {/* Tooltip box */}
                      <g className="opacity-0 peer-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <rect
                          x={p.x - 45}
                          y={p.y - 32}
                          width={90}
                          height={24}
                          rx={6}
                          fill="#0c0b11"
                          stroke="#374151"
                          strokeWidth={1}
                        />
                        <text x={p.x} y={p.y - 16} textAnchor="middle" fill="#fff" className="font-bold text-[9px]">
                          ₹{p.val.toFixed(0)}
                        </text>
                      </g>
                      <text x={p.x} y={height - 10} textAnchor="middle" fill="#4b5563" className="text-[9px]">
                        {p.date.substring(5)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Fourth Row: Recent Activity Table */}
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
