'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '@/lib/services/api';
import { StatementGenerator } from '@/lib/services/statementGenerator';
import { CustomerStatementData, DateFilterOption } from '@/lib/types';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Receipt,
  Layers,
  IndianRupee,
  Clock,
  Building2,
  Phone,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Check
} from 'lucide-react';

interface CustomerStatementModalProps {
  customerId: string;
  onClose: () => void;
}

export function CustomerStatementModal({ customerId, onClose }: CustomerStatementModalProps) {
  const [filter, setFilter] = useState<DateFilterOption>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statementData, setStatementData] = useState<CustomerStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [expandedTxnIds, setExpandedTxnIds] = useState<Set<string>>(new Set());

  const fetchStatement = useCallback(async (selectedFilter: DateFilterOption, from?: string, to?: string) => {
    setLoading(true);
    try {
      const customRange = (selectedFilter === 'custom' && from && to) ? { from, to } : undefined;
      const data = await ApiService.getCustomerStatementData(customerId, selectedFilter, customRange);
      setStatementData(data);
    } catch (err) {
      console.error('Failed to load customer statement:', err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (filter === 'custom' && (!customFrom || !customTo)) {
        return;
      }
      try {
        const customRange = (filter === 'custom' && customFrom && customTo) ? { from: customFrom, to: customTo } : undefined;
        const data = await ApiService.getCustomerStatementData(customerId, filter, customRange);
        if (isMounted) {
          setStatementData(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load customer statement:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [customerId, filter, customFrom, customTo]);

  const handleApplyCustomFilter = () => {
    if (customFrom && customTo) {
      fetchStatement('custom', customFrom, customTo);
    }
  };

  const toggleExpand = (txnId: string) => {
    setExpandedTxnIds(prev => {
      const next = new Set(prev);
      if (next.has(txnId)) {
        next.delete(txnId);
      } else {
        next.add(txnId);
      }
      return next;
    });
  };

  const toggleAllInvoices = () => {
    if (!statementData?.transactions) return;
    const invoiceIds = statementData.transactions.filter(t => t.type === 'INVOICE').map(t => t.id);
    const allExpanded = invoiceIds.every(id => expandedTxnIds.has(id));
    if (allExpanded) {
      setExpandedTxnIds(new Set());
    } else {
      setExpandedTxnIds(new Set(invoiceIds));
    }
  };

  const handleDownloadPdf = () => {
    if (!statementData) return;
    setGeneratingPdf(true);
    try {
      StatementGenerator.downloadStatementPdf(statementData);
    } catch (e) {
      console.error('PDF download error:', e);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrintPdf = () => {
    if (!statementData) return;
    try {
      StatementGenerator.printCustomerStatementPdf(statementData);
    } catch (e) {
      console.error('PDF print error:', e);
    }
  };

  const hasInvoices = (statementData?.transactions || []).some(t => t.type === 'INVOICE');
  const invoiceCount = (statementData?.transactions || []).filter(t => t.type === 'INVOICE').length;
  const allInvoicesExpanded = hasInvoices && (statementData?.transactions || [])
    .filter(t => t.type === 'INVOICE')
    .every(t => expandedTxnIds.has(t.id));

  return (
    <div className="statement-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:static print:bg-white print:backdrop-none">
      <div className="relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-full print:max-h-none">
        
        {/* Modal Top Header (Clean Light ERP Surface) */}
        <div className="flex items-center justify-between px-6 py-4 bg-white text-slate-900 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 font-sans">
                  Statement of Account
                </h2>
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  Financial Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span>Customer:</span>
                <span className="text-slate-900 font-semibold">{statementData?.customer.name || 'Loading customer account...'}</span>
                {statementData?.customer.customer_code && (
                  <span className="font-mono text-slate-500 text-[11px]">({statementData.customer.customer_code})</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              disabled={loading || !statementData}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 cursor-pointer"
              title="Print Financial Statement"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={loading || !statementData || generatingPdf}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              title="Download Statement PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{generatingPdf ? 'Generating...' : 'Export PDF'}</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Filter & Control Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-slate-500" /> Period:
            </span>
            {(
              [
                { id: 'all_time', label: 'All Transactions' },
                { id: 'today', label: 'Today' },
                { id: 'weekly', label: 'This Week' },
                { id: 'monthly', label: 'This Month' },
                { id: 'quarterly', label: 'This Quarter' },
                { id: 'financial_year', label: 'Financial Year (FY)' },
                { id: 'custom', label: 'Custom Range' }
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                onClick={() => setFilter(preset.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filter === preset.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-transparent text-slate-800 focus:outline-hidden text-xs"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-transparent text-slate-800 focus:outline-hidden text-xs"
              />
              <button
                onClick={handleApplyCustomFilter}
                disabled={!customFrom || !customTo}
                className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold transition cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body / Statement Live Document Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/70">
          
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-sm">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="font-medium text-slate-600">Compiling financial ledger statement of account...</span>
            </div>
          ) : !statementData ? (
            <div className="py-16 text-center text-slate-500 font-medium">Customer record not found or access denied.</div>
          ) : (
            <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
              
              {/* 1. STORE HEADER & STATEMENT BANNER */}
              <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h1 className="text-xl font-bold tracking-tight text-slate-900">
                        {statementData.shop_settings.shop_name}
                      </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-md leading-relaxed">
                      {statementData.shop_settings.address}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap">
                      {statementData.shop_settings.phone && (
                        <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                          <Phone className="w-3 h-3 text-slate-400" /> {statementData.shop_settings.phone}
                        </span>
                      )}
                      {statementData.shop_settings.gst_number && (
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200 text-slate-700">
                          GSTIN: {statementData.shop_settings.gst_number}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block font-mono">
                      Statement of Account
                    </span>
                    <div className="text-xs font-semibold text-slate-800 mt-1">
                      Period: <span className="text-blue-600 font-bold">{statementData.period.filter_label}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      Issue Date: {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CUSTOMER PROFILE & LIVE STATUS CARD */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Customer Account Summary
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Live Advance Balance Badge */}
                    {statementData.current_advance_balance > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Advance Credit: ₹{statementData.current_advance_balance.toFixed(2)}
                      </span>
                    )}
                    {/* Live Outstanding Due Badge */}
                    {statementData.current_balance_due > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Balance Due: ₹{statementData.current_balance_due.toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All Dues Settled
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer Name</span>
                    <strong className="text-slate-900 text-sm font-semibold">{statementData.customer.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Contact Phone</span>
                    <span className="font-mono text-slate-700">{statementData.customer.mobile || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Email Address</span>
                    <span className="text-slate-700">{statementData.customer.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Customer ID / Code</span>
                    <span className="font-mono text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                      {statementData.customer.customer_code || 'CUST-' + statementData.customer.id.slice(0, 6).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. DOUBLE-ENTRY BENTO KPI MATRIX (Opening, Invoiced, Paid, Closing) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Opening Balance */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <span>Opening Balance</span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="text-xl font-bold text-slate-900 font-mono mt-1.5 tabular-nums">
                    ₹{statementData.opening_balance.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Brought forward at start</div>
                </div>

                {/* Total Invoiced (Debits) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <span>Total Invoiced (Dr)</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-xl font-bold text-blue-700 font-mono mt-1.5 tabular-nums">
                    ₹{statementData.kpi.total_invoiced.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{statementData.kpi.invoices_count} bill(s) in period</div>
                </div>

                {/* Total Paid (Credits) */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <span>Total Paid (Cr)</span>
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-emerald-600 font-mono mt-1.5 tabular-nums">
                    ₹{statementData.kpi.total_paid.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Credits / payments collected</div>
                </div>

                {/* Closing Ledger Balance */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <span>Closing Balance</span>
                    <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className={`text-xl font-bold font-mono mt-1.5 tabular-nums ${
                    statementData.closing_balance > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    ₹{statementData.closing_balance.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {statementData.closing_balance > 0 ? 'Net Dr balance due' : 'Fully settled balance'}
                  </div>
                </div>
              </div>

              {/* 3.1 DETAILED FINANCIAL SUMMARY BREAKDOWN */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 font-mono">
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    Financial Breakdown & Collections Summary
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">Period Breakdown</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Bills</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {statementData.financial_summary?.total_bills ?? statementData.kpi.invoices_count}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Cash Received</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      ₹{(statementData.financial_summary?.total_cash_received ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">UPI Received</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">
                      ₹{(statementData.financial_summary?.total_upi_received ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Mixed Payments</span>
                    <span className="font-mono font-bold text-purple-600 text-sm">
                      ₹{(statementData.financial_summary?.total_mixed_payments ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Advance Utilized</span>
                    <span className="font-mono font-bold text-teal-700 text-sm">
                      ₹{(statementData.financial_summary?.total_advance_utilized ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Outstanding</span>
                    <span className="font-mono font-bold text-amber-600 text-sm">
                      ₹{(statementData.financial_summary?.total_outstanding ?? statementData.current_balance_due).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. FINANCIAL STATEMENT OF ACCOUNT TABLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 font-mono">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Chronological Statement of Transactions
                    </h3>
                    <span className="text-xs text-slate-500 font-mono font-medium">
                      ({statementData.transactions.length} record{statementData.transactions.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {hasInvoices && (
                    <button
                      type="button"
                      onClick={toggleAllInvoices}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {allInvoicesExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Collapse All Items</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Expand All Items ({invoiceCount})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                        <th className="py-2.5 px-3 font-mono">Date & Time</th>
                        <th className="py-2.5 px-3 font-sans">Type</th>
                        <th className="py-2.5 px-3 font-mono">Ref No</th>
                        <th className="py-2.5 px-3 font-sans">Particulars / Details</th>
                        <th className="py-2.5 px-3 text-right font-mono">Debit (Dr)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Credit (Cr)</th>
                        <th className="py-2.5 px-3 text-right font-mono">Balance (Dr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Opening Balance Row */}
                      <tr className="bg-slate-50/70 text-slate-700 font-medium border-b border-slate-200">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">—</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {statementData.period.start_date 
                            ? new Date(statementData.period.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                            : 'Initial'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300">
                            OPENING
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          Opening Balance Brought Forward
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{statementData.opening_balance.toFixed(2)}
                        </td>
                      </tr>

                      {/* Transaction Rows */}
                      {statementData.transactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-600">No transactions found for this period</p>
                            <p className="text-xs text-slate-400 mt-1">No invoices or payments were recorded in the selected date range.</p>
                          </td>
                        </tr>
                      ) : (
                        statementData.transactions.map((txn, idx) => {
                          const isInvoice = txn.type === 'INVOICE';
                          const isExpanded = expandedTxnIds.has(txn.id);
                          const itemsCount = txn.items?.length || 0;

                          return (
                            <React.Fragment key={txn.id}>
                              <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                  {txn.date}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isInvoice ? (
                                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                      <Receipt className="w-3 h-3 text-blue-600" />
                                      INVOICE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CreditCard className="w-3 h-3 text-emerald-600" />
                                      PAYMENT
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                  {txn.reference_no}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isInvoice ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => toggleExpand(txn.id)}
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                        >
                                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                          <span>{itemsCount} Item{itemsCount !== 1 ? 's' : ''}</span>
                                        </button>

                                        {txn.is_fully_paid ? (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                            <Check className="w-2.5 h-2.5" /> Paid
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                                            Due: ₹{Number(txn.bill_due || 0).toFixed(2)}
                                          </span>
                                        )}

                                        {Number(txn.advance_used || 0) > 0 && (
                                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-mono">
                                            Adv: ₹{Number(txn.advance_used).toFixed(2)}
                                          </span>
                                        )}

                                        {Number(txn.direct_paid || 0) > 0 && (
                                          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                            Direct: ₹{Number(txn.direct_paid).toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-slate-800">{txn.particulars}</span>
                                      {txn.payment_method && (
                                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                          {txn.payment_method}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {txn.debit > 0 ? `₹${txn.debit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                  {txn.credit > 0 ? `₹${txn.credit.toFixed(2)}` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                  ₹{txn.running_balance.toFixed(2)}
                                </td>
                              </tr>

                              {/* Expandable Item Drawer for Invoices */}
                              {isInvoice && isExpanded && (
                                <tr className="bg-slate-50/70 border-b border-slate-200">
                                  <td colSpan={8} className="p-3.5 pl-10 pr-6">
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-3">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <div className="flex items-center gap-2">
                                          <Receipt className="w-3.5 h-3.5 text-blue-600" />
                                          <span className="text-xs font-bold text-slate-800 font-mono">
                                            {txn.reference_no} — Itemized Line Items
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 font-mono">
                                          {itemsCount} line item{itemsCount !== 1 ? 's' : ''}
                                        </span>
                                      </div>

                                      {/* Sub-table */}
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                          <tr>
                                            <th className="py-1.5 px-2.5 w-8 font-mono">#</th>
                                            <th className="py-1.5 px-2.5 font-sans">Product Description</th>
                                            <th className="py-1.5 px-2.5 text-right font-mono">Qty</th>
                                            <th className="py-1.5 px-2.5 text-right font-mono">Unit Rate</th>
                                            <th className="py-1.5 px-2.5 text-right font-mono">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {txn.items && txn.items.length > 0 ? (
                                            txn.items.map(item => (
                                              <tr key={item.item_index} className="text-slate-700">
                                                <td className="py-1.5 px-2.5 font-mono text-slate-400">{item.item_index}</td>
                                                <td className="py-1.5 px-2.5 font-medium text-slate-900">
                                                  <span>{item.product_name}</span>
                                                  {item.is_custom_item && (
                                                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                                      Custom
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-semibold">{item.quantity}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono">₹{item.price.toFixed(2)}</td>
                                                <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">₹{item.total.toFixed(2)}</td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td colSpan={5} className="py-2 text-center text-slate-400">No item details available</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>

                                      {/* Invoice Settlement Breakdown Bar */}
                                      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                                        <span>Invoice Total: <strong className="font-mono text-slate-900">₹{txn.debit.toFixed(2)}</strong></span>
                                        {Number(txn.advance_used || 0) > 0 && (
                                          <span>Advance Used: <strong className="font-mono text-teal-700">₹{Number(txn.advance_used).toFixed(2)}</strong></span>
                                        )}
                                        <span>Direct Paid: <strong className="font-mono text-emerald-600">₹{Number(txn.direct_paid || 0).toFixed(2)}</strong></span>
                                        {Number(txn.bill_due || 0) > 0 ? (
                                          <span>Due: <strong className="font-mono text-amber-600">₹{Number(txn.bill_due).toFixed(2)}</strong></span>
                                        ) : (
                                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Fully Settled
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}

                      {/* Closing Balance Row */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-200">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">—</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                          {statementData.period.end_date 
                            ? new Date(statementData.period.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                            : 'Current'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                            CLOSING
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">—</td>
                        <td className="py-2.5 px-3 text-slate-900">
                          Closing Balance Carried Forward
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{statementData.kpi.total_invoiced.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                          ₹{statementData.kpi.total_paid.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                          ₹{statementData.closing_balance.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. STATEMENT RECONCILIATION & BALANCE CARD (Accounting Standard Double-Entry) */}
              <div className="bg-slate-900 text-white p-5 rounded-xl space-y-4 border border-slate-800 shadow-md">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center justify-between font-mono">
                  <span>Statement Reconciliation Summary</span>
                  {statementData.current_advance_balance > 0 && (
                    <span className="text-emerald-400 font-medium normal-case flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Customer Advance Credit: ₹{statementData.current_advance_balance.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Opening Balance</span>
                    <span className="text-base font-bold font-mono text-white">
                      ₹{statementData.opening_balance.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">+ Total Invoiced (Dr)</span>
                    <span className="text-base font-bold font-mono text-blue-400">
                      ₹{statementData.kpi.total_invoiced.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">- Total Paid (Cr)</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      ₹{statementData.kpi.total_paid.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">= Closing Balance</span>
                    <span className={`text-lg font-bold font-mono ${statementData.closing_balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ₹{statementData.closing_balance.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                  <span>
                    Reconciliation Formula: <strong className="text-white font-mono">Opening ({statementData.opening_balance.toFixed(2)}) + Invoiced ({statementData.kpi.total_invoiced.toFixed(2)}) - Paid ({statementData.kpi.total_paid.toFixed(2)}) = Closing ({statementData.closing_balance.toFixed(2)})</strong>
                  </span>
                  <span>
                    Status: <strong className={statementData.current_balance_due > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {statementData.current_balance_due > 0 ? `₹${statementData.current_balance_due.toFixed(2)} Net Due` : 'All Accounts Settled'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Footer message */}
              <p className="text-center text-[11px] text-slate-500 italic">
                {statementData.shop_settings.footer_message || 'Thank you for your business. For any queries regarding this statement, please contact the store.'}
              </p>

            </div>
          )}

        </div>

        {/* Modal Bottom Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="font-mono text-[11px] text-slate-600">
            {statementData ? (
              <span>Financial Ledger of Account • Chronological Debits & Credits</span>
            ) : null}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              disabled={loading || !statementData}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 transition disabled:opacity-50 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={loading || !statementData || generatingPdf}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{generatingPdf ? 'Generating PDF...' : 'Download Statement PDF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
