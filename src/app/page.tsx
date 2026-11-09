'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiService } from '@/lib/services/api';
import { DashboardStats, Bill, DateFilterOption, AllSettings, CurrentSessionStatus } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { InvoiceModal } from '@/components/InvoiceModal';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  IndianRupee, 
  Receipt, 
  Users, 
  AlertCircle, 
  TrendingUp, 
  PlusCircle, 
  Eye, 
  Package, 
  Filter,
  Smartphone,
  Wallet,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todays_sales: 0,
    monthly_sales: 0,
    todays_bills_count: 0,
    pending_balance: 0,
    total_customers: 0,
    total_income: 0,
    total_expense: 0,
    net_profit: 0,
    bills_generated: 0,
    average_bill_value: 0,
    payment_summary: {
      total_sales: 0,
      cash_collected: 0,
      upi_collected: 0,
      total_amount_collected: 0,
      outstanding_amount: 0,
      customer_advance_balance: 0,
      payment_method_breakdown: [],
      daily_collection_trend: [],
      monthly_collection_trend: []
    },
    sales_trend: [],
    monthly_revenue: [],
    payment_distribution: [],
    top_products: []
  });
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [_sessionStatus, setSessionStatus] = useState<CurrentSessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Date Filter State - defaults to current_session as requested
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('current_session');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [data, bills, settingsData, currentSession] = await Promise.all([
        ApiService.getDashboardStats(dateFilter, { from: customFrom, to: customTo }),
        ApiService.getBills(),
        ApiService.getSettings(),
        ApiService.getCurrentSessionStatus()
      ]);
      setStats(data);
      setRecentBills(bills.slice(0, 8));
      setSettings(settingsData);
      setSessionStatus(currentSession);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customFrom, customTo]);

  const handleViewBill = async (billId: string) => {
    const fullBill = await ApiService.getBillById(billId);
    if (fullBill) setSelectedBill(fullBill);
  };

  const ps = stats.payment_summary;

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dashboard & Payment Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Separate collection breakdown for Cash and UPI payments</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/billing"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5"
          >
            <PlusCircle size={18} />
            <span>Create Bill</span>
          </Link>
          <Link
            href="/accounting"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5"
          >
            <BookOpen size={16} />
            <span>Accounting</span>
          </Link>
          <Link
            href="/products"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-lg border border-slate-200 transition flex items-center space-x-1.5"
          >
            <Package size={16} />
            <span>Products</span>
          </Link>
          <Link
            href="/customers"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-lg border border-slate-200 transition flex items-center space-x-1.5"
          >
            <Users size={16} />
            <span>Customers</span>
          </Link>
        </div>
      </div>


      {/* DATE FILTER TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <Filter size={16} className="text-blue-600" />
          <span>Select Reconciliation Period:</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Current Session', value: 'current_session' },
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' },
            { label: 'Quarterly', value: 'quarterly' },
            { label: 'Yearly', value: 'yearly' },
            { label: 'Financial Year', value: 'financial_year' },
            { label: 'Custom Range', value: 'custom' }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setDateFilter(item.value as DateFilterOption)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                dateFilter === item.value
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase">From Date:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase">To Date:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* DEDICATED PAYMENT SUMMARY CARDS GRID (8 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sales Billed</p>
            <p className="text-2xl font-data-mono font-extrabold text-slate-900 mt-1">₹{ps.total_sales.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100">
            <Receipt size={24} />
          </div>
        </div>

        {/* Cash Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cash Collected</p>
            <p className="text-2xl font-data-mono font-extrabold text-emerald-600 mt-1">₹{ps.cash_collected.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100">
            <Wallet size={24} />
          </div>
        </div>

        {/* UPI Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">UPI Collected</p>
            <p className="text-2xl font-data-mono font-extrabold text-indigo-600 mt-1">₹{ps.upi_collected.toFixed(2)}</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
            <Smartphone size={24} />
          </div>
        </div>


        {/* Total Amount Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Amount Collected</p>
            <p className="text-2xl font-data-mono font-extrabold text-emerald-700 mt-1">₹{ps.total_amount_collected.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-100 text-emerald-800 p-3 rounded-xl border border-emerald-200">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Outstanding Amount */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Outstanding Amount</p>
            <p className="text-2xl font-data-mono font-extrabold text-rose-600 mt-1">₹{ps.outstanding_amount.toFixed(2)}</p>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100">
            <AlertCircle size={24} />
          </div>
        </div>

        {/* Customer Advance Balance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer Advance Balance</p>
            <p className="text-2xl font-data-mono font-extrabold text-blue-600 mt-1">₹{ps.customer_advance_balance.toFixed(2)}</p>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl border border-blue-100">
            <IndianRupee size={24} />
          </div>
        </div>
      </div>

      {/* PAYMENT ANALYSIS BREAKDOWN TABLE & FINANCIAL SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PAYMENT ANALYSIS TABLE (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-3">
          <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
            <Wallet className="text-blue-600" size={20} />
            <span>Payment Analysis Breakdown</span>
          </h3>

          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                <th className="py-2.5 px-4">Payment Method</th>
                <th className="py-2.5 px-4 text-right">Amount Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {ps.payment_method_breakdown.map((item, idx) => (
                <tr key={idx} className={item.method === 'Total Collected' ? 'bg-slate-900 text-white font-bold' : 'hover:bg-slate-50/80 transition-colors'}>
                  <td className="py-3 px-4 font-semibold text-sm">{item.method}</td>
                  <td className="py-3 px-4 text-right font-data-mono font-bold">
                    ₹{item.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* NET PROFIT SUMMARY (6 Cols) */}
        <div className="lg:col-span-6 bg-slate-900 text-white p-6 rounded-xl shadow-md space-y-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Reconciled Financial Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Income (Collected)</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">₹{stats.total_income.toFixed(2)}</p>
            </div>
            <div className="bg-slate-800 p-3.5 rounded-lg border border-slate-700">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Shop Expenses</p>
              <p className="text-xl font-bold text-rose-400 mt-1">₹{stats.total_expense.toFixed(2)}</p>
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase">Net Profit</p>
              <p className={`text-2xl font-extrabold mt-0.5 ${stats.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{stats.net_profit.toFixed(2)}
              </p>
            </div>
            <Link href="/expenses" className="text-xs font-bold text-blue-400 hover:underline">
              Manage Expenses
            </Link>
          </div>
        </div>
      </div>

      {/* RECHARTS ANALYTICS VISUALIZATIONS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: SALES TREND */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-2">
            <TrendingUp size={18} className="text-emerald-600" />
            <span>Sales Trend</span>
          </h3>
          <div className="h-64">
            {stats.sales_trend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No sales data for selected period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.sales_trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="amount" stroke="#10B981" fill="#D1FAE5" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* CHART 2: PAYMENT METHOD DISTRIBUTION */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-2">
            <IndianRupee size={18} className="text-purple-600" />
            <span>Payment Method Distribution</span>
          </h3>
          <div className="h-64">
            {stats.payment_distribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No payment data recorded.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.payment_distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {stats.payment_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* RECENT BILLS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-lg flex items-center space-x-2">
            <Receipt className="text-blue-600" size={20} />
            <span>Recent Transactions</span>
          </h2>
          <Link href="/billing" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            + Create New Bill
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading recent transactions...</div>
        ) : recentBills.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="font-medium text-base text-slate-700">No bills available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3.5">Bill No</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Method</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-slate-800">
                {recentBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-data-mono font-bold text-slate-900">{bill.bill_number}</td>
                    <td className="px-6 py-3.5 text-xs font-data-mono text-slate-500">
                      {new Date(bill.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">{bill.customer_name}</td>
                    <td className="px-6 py-3.5">
                      {bill.payment_method === 'UPI' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          UPI
                        </span>
                      ) : bill.payment_method === 'Cash' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Cash
                        </span>
                      ) : bill.payment_method === 'Split Payment' || bill.payment_method === 'Split' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                          Split
                        </span>
                      ) : bill.payment_method === 'Advance Used' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-teal-50 text-teal-700 border border-teal-200">
                          Advance
                        </span>
                      ) : bill.payment_method === 'Pay Later' || Number(bill.paid_total || 0) <= 0.01 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          Pay Later
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {bill.payment_method}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right font-data-mono font-bold text-slate-900">
                      ₹{Number(bill.grand_total).toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <button
                        onClick={() => handleViewBill(bill.id)}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-semibold transition flex items-center space-x-1 mx-auto border border-slate-200"
                      >
                        <Eye size={14} />
                        <span>View / Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {selectedBill && (
        <InvoiceModal 
          bill={selectedBill} 
          settings={settings || undefined} 
          customerEmail={selectedBill.customer_email || undefined} 
          onClose={() => setSelectedBill(null)} 
        />
      )}
    </div>
  );
}
