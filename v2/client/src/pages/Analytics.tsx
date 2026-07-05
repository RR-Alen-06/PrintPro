import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { TrendingUp, FileText, Gift, Award, Smartphone, Landmark } from 'lucide-react';

interface SalesSummary {
  revenue: number;
  count: number;
  avgInvoice: number;
  discounts: number;
}

interface CustomerContribution {
  name: string;
  total: number;
}

interface PaymentSplits {
  cash: number;
  upi: number;
}

interface ItemSold {
  name: string;
  qty: number;
}

interface AnalyticsData {
  salesSummary: SalesSummary;
  customerContribution: CustomerContribution[];
  paymentSplits: PaymentSplits;
  itemsSold: ItemSold[];
}

export default function Analytics() {
  const [period, setPeriod] = useState('month'); // today, yesterday, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getDateRange = () => {
    if (period === 'custom') {
      return { startDate, endDate };
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (period === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (period === 'yesterday') {
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    }
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDate: weekAgo.toISOString().slice(0, 10), endDate: todayStr };
    }
    // month by default
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return { startDate: monthAgo.toISOString().slice(0, 10), endDate: todayStr };
  };

  const dates = getDateRange();

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analyticsSummary', dates.startDate, dates.endDate],
    queryFn: () =>
      apiRequest<AnalyticsData>(
        `/analytics/summary?startDate=${dates.startDate || ''}&endDate=${dates.endDate || ''}`
      ),
  });

  const totalPayments = data ? data.paymentSplits.cash + data.paymentSplits.upi : 0;
  const cashPct = totalPayments > 0 ? (data!.paymentSplits.cash / totalPayments) * 100 : 0;
  const upiPct = totalPayments > 0 ? (data!.paymentSplits.upi / totalPayments) * 100 : 0;

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-8">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header & period controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-800/80 gap-4 relative z-10">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Analytics & Trends</h1>
          <p className="text-gray-400 mt-1">Deep-dive into volume prints, top customers, and payment ratios.</p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-3 bg-[#0c0b11] border border-gray-800 rounded-xl p-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-xs font-semibold text-white focus:outline-none cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Past 7 Days</option>
            <option value="month">Past 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-xs text-white"
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-40">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="space-y-8 relative z-10">
          {/* Key sales summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Gross Sales</span>
                  <h3 className="text-2xl font-black text-white mt-1">₹{data.salesSummary.revenue.toFixed(2)}</h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/25 text-purple-400">
                  <TrendingUp size={18} />
                </div>
              </div>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Invoice Count</span>
                  <h3 className="text-2xl font-black text-white mt-1">{data.salesSummary.count}</h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/25 text-purple-400">
                  <FileText size={18} />
                </div>
              </div>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Avg Order Value</span>
                  <h3 className="text-2xl font-black text-white mt-1">₹{data.salesSummary.avgInvoice.toFixed(2)}</h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/25 text-purple-400">
                  <Award size={18} />
                </div>
              </div>
            </div>

            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Discounts Settled</span>
                  <h3 className="text-2xl font-black text-white mt-1">₹{data.salesSummary.discounts.toFixed(2)}</h3>
                </div>
                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/25 text-purple-400">
                  <Gift size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Customer Contribution Leaderboard */}
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-white text-base">Top Contributing Customers</h3>
                <p className="text-xs text-gray-500 mt-1">Key clients by invoice values inside period.</p>
              </div>

              <div className="space-y-4">
                {data.customerContribution.map((c, i) => {
                  const maxVal = data.customerContribution[0]?.total || 1;
                  const pct = (c.total / maxVal) * 100;
                  return (
                    <div key={c.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-300">
                          {i + 1}. {c.name}
                        </span>
                        <span className="text-purple-400">₹{c.total.toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {data.customerContribution.length === 0 && (
                  <p className="text-sm text-gray-500 py-10 text-center">No customer contribution found.</p>
                )}
              </div>
            </div>

            {/* Payment Method Splits */}
            <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-white text-base">Payment Ratio Splits</h3>
                <p className="text-xs text-gray-500 mt-1">Comparison of collections via Cash vs UPI.</p>
              </div>

              <div className="flex-1 flex flex-col justify-center gap-6">
                <div className="flex gap-4">
                  {/* Cash Card */}
                  <div className="flex-1 bg-[#13121a] border border-gray-800/50 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <Landmark size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block uppercase">Cash Received</span>
                      <span className="font-extrabold text-white text-lg">₹{data.paymentSplits.cash.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* UPI Card */}
                  <div className="flex-1 bg-[#13121a] border border-gray-800/50 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block uppercase">UPI Payments</span>
                      <span className="font-extrabold text-white text-lg">₹{data.paymentSplits.upi.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Cash Ratio: {cashPct.toFixed(1)}%</span>
                    <span>UPI Ratio: {upiPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-900 h-3 rounded-full flex overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${cashPct}%` }} />
                    <div className="bg-blue-500 h-full" style={{ width: `${upiPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Paper / Print Volumes sold list */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-bold text-white text-base">Print Volume Analytics</h3>
              <p className="text-xs text-gray-500 mt-1">Itemized breakups of total prints sold.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Paper/Item Name</th>
                    <th className="p-6 text-right">Quantity Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {data.itemsSold.map((item) => (
                    <tr key={item.name} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 font-bold text-white">{item.name}</td>
                      <td className="p-6 text-right font-black text-purple-400 font-mono text-base">{item.qty} prints</td>
                    </tr>
                  ))}

                  {data.itemsSold.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-12 text-center text-gray-500">
                        No print volume records inside this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
