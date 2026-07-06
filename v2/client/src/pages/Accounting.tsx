import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { DollarSign, TrendingUp, TrendingDown, Download } from 'lucide-react';

interface Transaction {
  _id: string;
  id: string;
  date: string;
  type: 'payment' | 'refund' | 'advance' | 'expense';
  title: string;
  amount: number;
  cashAmount: number;
  upiAmount: number;
  notes?: string;
}

interface AccountingSummary {
  revenue: number;
  cashInflow: number;
  upiInflow: number;
  totalRefunds: number;
  totalExpenses: number;
  netInflow: number;
  profit: number;
  splits: {
    cashInflow: number;
    upiInflow: number;
    refundsCash: number;
    refundsUpi: number;
    expensesCash: number;
    expensesUpi: number;
  };
}

interface GstReport {
  rates: {
    rate: number;
    taxableAmount: number;
    gstAmount: number;
    total: number;
  }[];
  totalTaxable: number;
  totalGst: number;
  grandTotal: number;
}

export default function Accounting() {
  const [period, setPeriod] = useState('month'); // today, yesterday, week, month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeSection, setActiveSection] = useState<'ledger' | 'gst'>('ledger');

  // Period helper calculations
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

  const { data: summary, isLoading: isSummaryLoading } = useQuery<AccountingSummary>({
    queryKey: ['accountingSummary', dates.startDate, dates.endDate],
    queryFn: () =>
      apiRequest<AccountingSummary>(
        `/accounting/summary?startDate=${dates.startDate || ''}&endDate=${dates.endDate || ''}`
      ),
  });

  const { data: transactions = [], isLoading: isTxLoading } = useQuery<Transaction[]>({
    queryKey: ['accountingTransactions', dates.startDate, dates.endDate],
    queryFn: () =>
      apiRequest<Transaction[]>(
        `/accounting/transactions?startDate=${dates.startDate || ''}&endDate=${dates.endDate || ''}`
      ),
  });

  const { data: gstReport, isLoading: isGstLoading } = useQuery<GstReport>({
    queryKey: ['gstReport', dates.startDate, dates.endDate],
    queryFn: () =>
      apiRequest<GstReport>(
        `/accounting/gst-report?startDate=${dates.startDate || ''}&endDate=${dates.endDate || ''}`
      ),
  });

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-gray-800/80 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Period Accounting</h1>
          <p className="text-gray-400 mt-1">Review revenue summaries, payment methods, and outlay statements.</p>
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

      {/* Summary Cards */}
      {isSummaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#0c0b11]/50 border border-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Revenue */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-purple-600 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold">Gross Revenue</span>
            <h3 className="text-2xl font-black text-white mt-2">₹{summary.revenue.toFixed(2)}</h3>
            <p className="text-[10px] text-gray-500 mt-1.5">Sum of period invoice totals</p>
          </div>

          {/* Cash Inflow */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-emerald-500 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <DollarSign size={20} />
            </div>
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold">Payment Inflow</span>
            <h3 className="text-2xl font-black text-white mt-2">₹{(summary.cashInflow + summary.upiInflow).toFixed(2)}</h3>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Cash: ₹{summary.cashInflow.toFixed(2)} · UPI: ₹{summary.upiInflow.toFixed(2)}
            </p>
          </div>

          {/* Total Expenses */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
              <TrendingDown size={20} />
            </div>
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold">Business Expenses</span>
            <h3 className="text-2xl font-black text-white mt-2">₹{summary.totalExpenses.toFixed(2)}</h3>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Cash: ₹{summary.splits.expensesCash.toFixed(2)} · UPI: ₹{summary.splits.expensesUpi.toFixed(2)}
            </p>
          </div>

          {/* Period Profit */}
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs text-gray-500 block uppercase tracking-wider font-semibold">Period Profit</span>
            <h3 className="text-2xl font-black text-white mt-2">₹{summary.profit.toFixed(2)}</h3>
            <p className="text-[10px] text-gray-500 mt-1.5">Revenue minus Period Expenses</p>
          </div>
        </div>
      ) : null}

      {/* Section Selector Tabs */}
      <div className="flex gap-4 border-b border-gray-800/80 mb-6">
        <button
          onClick={() => setActiveSection('ledger')}
          className={`pb-3 text-sm font-bold border-b-2 px-2 transition-all cursor-pointer ${
            activeSection === 'ledger' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          Transactions Ledger
        </button>
        <button
          onClick={() => setActiveSection('gst')}
          className={`pb-3 text-sm font-bold border-b-2 px-2 transition-all cursor-pointer ${
            activeSection === 'gst' ? 'border-purple-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          GST Tax Filing Report
        </button>
      </div>

      {activeSection === 'ledger' ? (
        /* Transactions History Grid */
        isTxLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-bold text-white">Chronological Transaction Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">Date</th>
                    <th className="p-6">Tx ID</th>
                    <th className="p-6">Transaction Title</th>
                    <th className="p-6">Flow Type</th>
                    <th className="p-6">Method Splits</th>
                    <th className="p-6">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {transactions.map((tx) => (
                    <tr key={`${tx.id}-${tx._id}`} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6 text-gray-400">{tx.date}</td>
                      <td className="p-6 font-mono text-xs text-purple-400 font-semibold">{tx.id}</td>
                      <td className="p-6">
                        <div className="font-bold text-white">{tx.title}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{tx.notes || 'No description notes'}</div>
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold uppercase rounded-full ${
                          tx.type === 'payment' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          tx.type === 'advance' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          tx.type === 'refund' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-6 text-xs text-gray-400">
                        <span>Cash: ₹{tx.cashAmount.toFixed(2)}</span>
                        <span className="mx-2">·</span>
                        <span>UPI: ₹{tx.upiAmount.toFixed(2)}</span>
                      </td>
                      <td className={`p-6 font-bold ${
                        tx.type === 'expense' || tx.type === 'refund' ? 'text-red-400' : 'text-emerald-400'
                      }`}>
                        {tx.type === 'expense' || tx.type === 'refund' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}

                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        No financial transactions recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* GST report summary */
        isGstLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : gstReport ? (
          <div className="space-y-6">
            {/* Overview summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6">
                <span className="text-xs text-gray-500 block uppercase font-semibold">Total Taxable Sales</span>
                <h3 className="text-2xl font-black text-white mt-2">₹{gstReport.totalTaxable.toFixed(2)}</h3>
              </div>
              <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6">
                <span className="text-xs text-gray-500 block uppercase font-semibold">Total GST Output Liability</span>
                <h3 className="text-2xl font-black text-purple-400 mt-2">₹{gstReport.totalGst.toFixed(2)}</h3>
              </div>
              <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-6 relative">
                <span className="text-xs text-gray-500 block uppercase font-semibold">Grand Gross Total</span>
                <h3 className="text-2xl font-black text-white mt-2">₹{gstReport.grandTotal.toFixed(2)}</h3>
                <button
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + ["Tax Rate (%),Taxable Value (INR),GST Tax Amount (INR),Total Gross (INR)"].concat(
                          gstReport.rates.map(r => `${r.rate}%,${r.taxableAmount},${r.gstAmount},${r.total}`)
                        ).join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `gst_report_${dates.startDate || 'start'}_to_${dates.endDate || 'end'}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="absolute right-6 top-6 flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-300 border border-purple-500/25 rounded-lg text-xs font-semibold hover:bg-purple-600 hover:text-white transition-all cursor-pointer"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>

            {/* GST breakdown table */}
            <div className="bg-[#0c0b11] border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-gray-800">
                <h3 className="font-bold text-white">GST Slab breakdown Summary</h3>
              </div>
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 uppercase text-xs tracking-wider">
                    <th className="p-6">GST Rate Slab</th>
                    <th className="p-6">Taxable Net Amount</th>
                    <th className="p-6">GST Output Liability</th>
                    <th className="p-6 font-bold text-right">Total Invoice Sum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {gstReport.rates.map((row) => (
                    <tr key={row.rate} className="hover:bg-gray-900/30 transition-all text-sm">
                      <td className="p-6 font-bold text-white">{row.rate}% Slab</td>
                      <td className="p-6">₹{row.taxableAmount.toFixed(2)}</td>
                      <td className="p-6 text-purple-400 font-semibold">₹{row.gstAmount.toFixed(2)}</td>
                      <td className="p-6 text-right font-bold text-white">₹{row.total.toFixed(2)}</td>
                    </tr>
                  ))}

                  {gstReport.rates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-gray-500">
                        No taxable print invoices generated for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
