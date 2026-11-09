'use client';

import React, { useState, useEffect } from 'react';
import { ApiService } from '@/lib/services/api';
import { Expense, DateFilterOption, ExpensePaymentMode } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { downloadCSV } from '@/lib/utils/csv';
import { EXPENSES_DATE_FILTER_BUTTONS } from '@/lib/constants/filters';
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  PieChart as PieIcon,
  Filter,
  Search,
  FileSpreadsheet,
  Tag,
  CreditCard,
  Settings2,
  Zap,
  Home,
  Package,
  Wrench,
  Users,
  ShieldCheck
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Shop Expense',
  'Electricity',
  'Rent',
  'Paper Stock & Rolls',
  'Toner & Cartridges',
  'Machine Maintenance',
  'Staff Wages',
  'Other Expense'
];

const PAYMENT_MODES: (ExpensePaymentMode | 'Split')[] = ['Cash', 'UPI', 'Split', 'Bank Transfer', 'Card', 'Cheque', 'Other'];

const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#64748B', // Slate
  '#14B8A6', // Teal
  '#F97316'  // Orange
];

const dateFilterButtons = EXPENSES_DATE_FILTER_BUTTONS;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartView, setChartView] = useState<'pie' | 'bar'>('pie');

  // Add Expense Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<string>('Shop Expense');
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode | 'Split'>('Cash');
  const [cashAmount, setCashAmount] = useState<number | ''>('');
  const [upiAmount, setUpiAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Category Manager Modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Delete modal state
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isDeletingInClosedSession, setIsDeletingInClosedSession] = useState(false);
  const [deleteAdminPin, setDeleteAdminPin] = useState('');

  // Feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, stats, settingsData] = await Promise.all([
        ApiService.getExpenses(),
        ApiService.getDashboardStats(dateFilter, { from: customFrom, to: customTo }),
        ApiService.getSettings()
      ]);
      setExpenses(expData);
      setTotalIncome(stats.total_income);
      setTotalExpense(stats.total_expense);

      if (settingsData.expenses?.categories && settingsData.expenses.categories.length > 0) {
        setCategories(settingsData.expenses.categories);
      }
    } catch (err) {
      console.error('Error fetching expenses & accounting stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, customFrom, customTo]);

  const handleOpenAdd = () => {
    setTitle('');
    setAmount('');
    setCategory(categories[0] || 'Shop Expense');
    setPaymentMode('Cash');
    setCashAmount('');
    setUpiAmount('');
    setNotes('');
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Expense title is required.');
      return;
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Amount must be greater than 0.');
      return;
    }

    let cAmt = 0;
    let uAmt = 0;

    if (paymentMode === 'Split') {
      cAmt = Number(cashAmount || 0);
      uAmt = Number(upiAmount || 0);
      if (cAmt <= 0 && uAmt <= 0) {
        setErrorMsg('Please enter Cash and/or UPI amounts for split payment.');
        return;
      }
      if (Math.abs(cAmt + uAmt - amt) > 0.01) {
        setErrorMsg(`Split sum (Cash ₹${cAmt} + UPI ₹${uAmt} = ₹${cAmt + uAmt}) must equal total amount (₹${amt}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await ApiService.addExpense({
        title: title.trim(),
        amount: amt,
        category,
        payment_mode: paymentMode,
        cash_amount: paymentMode === 'Split' ? cAmt : (paymentMode === 'Cash' ? amt : 0),
        upi_amount: paymentMode === 'Split' ? uAmt : (paymentMode === 'UPI' ? amt : 0),
        notes: notes.trim() || undefined
      });
      setSuccessMsg('Expense recorded successfully.');
      setShowAddModal(false);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record expense');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromptDelete = async (exp: Expense) => {
    setDeletingExpense(exp);
    setDeleteAdminPin('');
    try {
      const check = await ApiService.isDateInClosedSession(exp.created_at);
      setIsDeletingInClosedSession(check.isClosed);
    } catch {
      setIsDeletingInClosedSession(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingExpense) return;
    try {
      await ApiService.deleteExpense(deletingExpense.id, deleteAdminPin);
      setSuccessMsg('Expense record removed.');
      setDeletingExpense(null);
      setDeleteAdminPin('');
      loadData();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete expense');
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const catName = newCategoryName.trim();
    if (!catName) return;
    if (categories.includes(catName)) {
      setErrorMsg('Category already exists.');
      return;
    }

    try {
      const updated = await ApiService.addExpenseCategory(catName);
      setCategories(updated);
      setNewCategoryName('');
      setSuccessMsg(`Category "${catName}" added.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleRemoveCategory = async (catToRemove: string) => {
    try {
      const updated = await ApiService.removeExpenseCategory(catToRemove);
      setCategories(updated);
      setSuccessMsg(`Category "${catToRemove}" removed.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove category');
    }
  };

  // Filter expenses list by date, category, payment mode, and search query
  const dateBounds = ApiService.getDateRangeBounds(dateFilter, { from: customFrom, to: customTo });
  const filteredExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.created_at);
    if (dateBounds.startDate && expDate < dateBounds.startDate) return false;
    if (dateBounds.endDate && expDate > dateBounds.endDate) return false;
    if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) return false;
    if (selectedPaymentMode !== 'ALL' && (exp.payment_mode || 'Cash') !== selectedPaymentMode) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = exp.title.toLowerCase().includes(q);
      const matchCategory = exp.category.toLowerCase().includes(q);
      const matchNumber = (exp.expense_number || '').toLowerCase().includes(q);
      const matchNotes = (exp.notes || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCategory && !matchNumber && !matchNotes) {
        return false;
      }
    }
    return true;
  });

  const periodExpenseSum = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const effectiveExpense = dateFilter === 'all_time' && selectedCategory === 'ALL' && selectedPaymentMode === 'ALL' && !searchQuery ? totalExpense : periodExpenseSum;
  const netProfit = totalIncome - effectiveExpense;

  // Category Breakdown Data for Recharts
  const categoryBreakdownMap = new Map<string, number>();
  filteredExpenses.forEach((exp) => {
    const cat = exp.category || 'Other Expense';
    categoryBreakdownMap.set(cat, (categoryBreakdownMap.get(cat) || 0) + Number(exp.amount || 0));
  });

  const categoryChartData = Array.from(categoryBreakdownMap.entries())
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
      percentage: periodExpenseSum > 0 ? ((value / periodExpenseSum) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.value - a.value);

  // Payment Mode Breakdown Data
  const paymentModeMap = new Map<string, number>();
  filteredExpenses.forEach((exp) => {
    const mode = exp.payment_mode || 'Cash';
    paymentModeMap.set(mode, (paymentModeMap.get(mode) || 0) + Number(exp.amount || 0));
  });

  const handleExportCSV = () => {
    const headers = ['Expense Number', 'Date Time', 'Description', 'Category', 'Payment Mode', 'Notes', 'Amount (INR)'];
    const rows = filteredExpenses.map(e => [
      e.expense_number || 'N/A',
      new Date(e.created_at).toLocaleString('en-IN'),
      e.title,
      e.category,
      e.payment_mode || 'Cash',
      e.notes || '',
      Number(e.amount).toFixed(2)
    ]);

    downloadCSV(`Expenses_Report_${dateFilter}_${new Date().toISOString().split('T')[0]}`, headers, rows);
  };

  const getCategoryIcon = (catName: string) => {
    const lower = catName.toLowerCase();
    if (lower.includes('electric')) return <Zap size={14} className="text-amber-500" />;
    if (lower.includes('rent')) return <Home size={14} className="text-indigo-500" />;
    if (lower.includes('paper')) return <Package size={14} className="text-emerald-500" />;
    if (lower.includes('maintenance')) return <Wrench size={14} className="text-rose-500" />;
    if (lower.includes('staff') || lower.includes('wage')) return <Users size={14} className="text-cyan-500" />;
    return <Tag size={14} className="text-blue-500" />;
  };

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <DollarSign className="text-blue-600" size={26} />
            <span>Simple Accounting & Expenses</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track shop electricity, stock purchases, rent, payments, and view net profit</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowCategoryModal(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            title="Manage custom expense categories"
          >
            <Settings2 size={16} className="text-slate-600" />
            <span>Categories</span>
          </button>

          {filteredExpenses.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs px-3.5 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              title="Export filtered expenses to CSV"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg flex items-center space-x-3 text-rose-800 text-sm">
          <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex items-center space-x-3 text-emerald-800 text-sm">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* DATE RANGE FILTER STRIP */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter size={15} className="text-blue-600" />
            <span>Date Range:</span>
          </div>

          {/* Quick Date Pills */}
          <div className="flex flex-wrap gap-1.5">
            {dateFilterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => setDateFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  dateFilter === btn.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-600">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-medium"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-600">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* FINANCIAL PROFIT & LOSS SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Income (Sales)</p>
            <p className="text-2xl font-data-mono font-extrabold text-emerald-600 mt-1">₹{totalIncome.toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{dateFilter.replace('_', ' ')} revenue</p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-data-mono font-extrabold text-rose-600 mt-1">₹{effectiveExpense.toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{dateFilter.replace('_', ' ')} expenditures</p>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl border border-rose-100">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Net Profit</p>
            <p className={`text-2xl font-data-mono font-extrabold mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{netProfit.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {netProfit >= 0 ? 'Net positive earnings' : 'Net operating deficit'}
            </p>
          </div>
          <div className="bg-slate-800 text-blue-400 p-3 rounded-xl border border-slate-700">
            <PieIcon size={24} />
          </div>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN & PAYMENT METHOD METRICS (Always visible) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Chart Card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <PieIcon size={18} className="text-blue-600" />
                <span>Expense Category Breakdown</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution of spending across shop categories</p>
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setChartView('pie')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  chartView === 'pie' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pie
              </button>
              <button
                onClick={() => setChartView('bar')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  chartView === 'bar' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bar
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            {categoryChartData.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center p-6">
                <PieIcon className="text-slate-300 mb-2" size={40} />
                <p className="text-sm font-semibold text-slate-700">No Expense Data to Visualize</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Click &quot;Record Expense&quot; to log shop expenses and view interactive category breakdown.
                </p>
              </div>
            ) : chartView === 'pie' ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categoryChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Amount']} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Amount']} />
                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]}>
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Mode & Category Stats Sidebar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3">
              <CreditCard size={18} className="text-emerald-600" />
              <span>Payment Mode Breakdown</span>
            </h3>

            <div className="space-y-3 mt-3">
              {paymentModeMap.size === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No payment records yet</p>
              ) : (
                Array.from(paymentModeMap.entries()).map(([mode, amt]) => {
                  const pct = periodExpenseSum > 0 ? ((amt / periodExpenseSum) * 100).toFixed(1) : '0';
                  return (
                    <div key={mode} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span className="text-xs font-semibold text-slate-800">{mode}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold font-data-mono text-slate-900">₹{amt.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400">{pct}%</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">Top Category:</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-bold text-slate-900">{categoryChartData[0]?.name || 'None'}</span>
              <span className="text-xs font-extrabold text-rose-600 font-data-mono">
                ₹{categoryChartData[0]?.value.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* EXPENSES LOG & FILTERS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <DollarSign className="text-rose-600" size={20} />
            <h2 className="font-bold text-slate-800 text-base">Shop Expense Log</h2>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {filteredExpenses.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[180px]">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search description / notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Payment Mode Filter Select */}
            <select
              value={selectedPaymentMode}
              onChange={(e) => setSelectedPaymentMode(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Payment Modes</option>
              {PAYMENT_MODES.map(pm => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <DollarSign className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="font-medium text-base text-slate-700">No expenses found for the selected filter.</p>
            <p className="text-xs text-slate-400 mt-1">Try changing your date filter, category selection, or record a new expense.</p>
            <button
              onClick={handleOpenAdd}
              className="mt-4 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Record Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3.5">Expense #</th>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Expense Description</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Payment Mode</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-slate-800">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-xs font-data-mono font-bold text-slate-500">
                      {exp.expense_number || 'EXP-—'}
                    </td>
                    <td className="px-6 py-4 text-xs font-data-mono text-slate-500">
                      {new Date(exp.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{exp.title}</p>
                      {exp.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 italic">{exp.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {exp.payment_mode === 'Split' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                            Split Payment
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Cash: ₹{Number(exp.cash_amount ?? 0).toFixed(0)} | UPI: ₹{Number(exp.upi_amount ?? 0).toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                          exp.payment_mode === 'Cash' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : exp.payment_mode === 'UPI' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {exp.payment_mode || 'Cash'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-data-mono font-bold text-rose-600 text-base">
                      ₹{Number(exp.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handlePromptDelete(exp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition mx-auto cursor-pointer"
                        title="Delete Expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Plus size={20} className="text-rose-600" />
                <span>Record Shop Expense</span>
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Purchased A4 Paper Rim, Shop Electricity Bill"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => {
                      const mode = e.target.value as ExpensePaymentMode | 'Split';
                      setPaymentMode(mode);
                      if (mode === 'Split' && amount && !cashAmount && !upiAmount) {
                        setCashAmount(Number(amount));
                        setUpiAmount(0);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                  >
                    {PAYMENT_MODES.map(pm => (
                      <option key={pm} value={pm}>{pm === 'Split' ? 'Split (Cash + UPI)' : pm}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Total Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    setAmount(val);
                    if (paymentMode === 'Split' && typeof val === 'number') {
                      if (typeof cashAmount === 'number' && cashAmount <= val) {
                        setUpiAmount(val - cashAmount);
                      } else {
                        setCashAmount(val);
                        setUpiAmount(0);
                      }
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* SPLIT PAYMENT BREAKDOWN */}
              {paymentMode === 'Split' && (
                <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Split Cash & UPI Breakdown</span>
                    <span className="text-[11px] font-mono font-bold text-amber-700">
                      Total: ₹{Number(amount || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Cash Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => {
                          const c = e.target.value === '' ? '' : Number(e.target.value);
                          setCashAmount(c);
                          if (amount !== '' && typeof c === 'number' && c <= Number(amount)) {
                            setUpiAmount(Number(amount) - c);
                          }
                        }}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">UPI Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={upiAmount}
                        onChange={(e) => {
                          const u = e.target.value === '' ? '' : Number(e.target.value);
                          setUpiAmount(u);
                          if (amount !== '' && typeof u === 'number' && u <= Number(amount)) {
                            setCashAmount(Number(amount) - u);
                          }
                        }}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  {amount !== '' && (
                    <div className="text-[11px] text-amber-800 flex justify-between font-mono pt-1 border-t border-amber-200">
                      <span>Sum: ₹{Number(cashAmount || 0) + Number(upiAmount || 0)}</span>
                      <span className={Math.abs(Number(cashAmount || 0) + Number(upiAmount || 0) - Number(amount)) < 0.01 ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                        {Math.abs(Number(cashAmount || 0) + Number(upiAmount || 0) - Number(amount)) < 0.01
                          ? '✓ Balanced'
                          : `Difference: ₹${(Number(amount) - (Number(cashAmount || 0) + Number(upiAmount || 0))).toFixed(0)}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes / Receipt Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Receipt #8892, Paid via Shop QR"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGER MODAL */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Settings2 size={20} className="text-blue-600" />
                <span>Manage Expense Categories</span>
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Add New Category Form */}
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="New Category Name (e.g. Tea & Snacks)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow transition cursor-pointer flex items-center space-x-1"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </form>

            {/* Category List */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
              {categories.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-2 bg-white rounded-md border border-slate-200 shadow-xs">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
                    {getCategoryIcon(cat)}
                    <span>{cat}</span>
                  </div>
                  {categories.length > 1 && (
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                      title={`Remove category "${cat}"`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-center">
            <AlertTriangle className="mx-auto text-rose-600" size={40} />
            <h3 className="text-lg font-bold text-slate-900">Confirm Expense Deletion</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to remove <span className="font-bold text-slate-900">&quot;{deletingExpense.title}&quot;</span> (₹{Number(deletingExpense.amount).toFixed(2)})?
            </p>

            {isDeletingInClosedSession && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-left space-y-2">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-amber-700" />
                  <span>Closed Session Locked: Super Admin PIN Required</span>
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  This expense belongs to a closed accounting session. Enter your Super Admin Security PIN to confirm deletion.
                </p>
                <input
                  type="password"
                  placeholder="Enter Security PIN (e.g. 1234)"
                  value={deleteAdminPin}
                  onChange={(e) => setDeleteAdminPin(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-md px-3 py-1.5 text-xs font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
            <div className="flex justify-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
