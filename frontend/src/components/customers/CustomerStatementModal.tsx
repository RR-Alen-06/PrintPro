import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Share2,
} from 'lucide-react';
import { StatementService, STATEMENT_PERIOD_OPTIONS } from '../../services/statementService';
import { CustomerStatementData } from '../../types/billing';

interface CustomerStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string | null;
  customers?: any[];
  bills?: any[];
  payments?: any[];
  advancePayments?: any[];
  business?: any;
  settings?: any;
  onInspectBill?: (billId: string) => void;
}

export default function CustomerStatementModal({
  isOpen,
  onClose,
  customerId,
  customers = [],
  bills = [],
  payments = [],
  advancePayments = [],
  business = {},
  settings = {},
  onInspectBill,
}: CustomerStatementModalProps) {
  if (!isOpen || !customerId) return null;

  const [period, setPeriod] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDetailed, setIsDetailed] = useState<boolean>(true);
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Compute statement data
  const statementData: CustomerStatementData | null = useMemo(() => {
    return StatementService.getCustomerStatementData({
      customerId,
      filter: period,
      customRange: { startDate: customStartDate, endDate: customEndDate },
      customers,
      bills,
      payments,
      advancePayments,
      business,
      settings,
    });
  }, [
    customerId,
    period,
    customStartDate,
    customEndDate,
    customers,
    bills,
    payments,
    advancePayments,
    business,
    settings,
  ]);

  if (!statementData) return null;

  const toggleBillExpand = (billId: string) => {
    setExpandedBills((prev) => ({
      ...prev,
      [billId]: !prev[billId],
    }));
  };

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const doc = StatementService.generateStatementPDF(statementData, {
        detailed: isDetailed,
        currency: '₹',
      });
      const filename = `${statementData.customer.name.replace(/\s+/g, '_')}_Statement_${statementData.period.key}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to generate PDF statement', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      const doc = StatementService.generateStatementPDF(statementData, {
        detailed: isDetailed,
        currency: '₹',
      });
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Failed to print statement', err);
    }
  };

  const handleCopySummary = () => {
    const summaryText =
      `*STATEMENT OF ACCOUNT - ${statementData.store.shopName}*\n` +
      `Customer: ${statementData.customer.name} (${statementData.customer.customer_code || ''})\n` +
      `Period: ${statementData.period.label}\n\n` +
      `*KPI Summary:*\n` +
      `• Total Invoiced: ₹${statementData.kpi.total_invoiced.toFixed(2)} (${statementData.kpi.invoices_count} Bills)\n` +
      `• Total Paid in Period: ₹${statementData.kpi.total_paid.toFixed(2)}\n` +
      `• Total Units Purchased: ${statementData.kpi.total_units_bought} Items\n\n` +
      `*Ledger Status:*\n` +
      `• Current Outstanding Balance: ₹${statementData.reconciliation.current_outstanding_balance.toFixed(2)}\n` +
      (statementData.reconciliation.advance_balance > 0
        ? `• Available Advance/Credit: ₹${statementData.reconciliation.advance_balance.toFixed(2)}\n`
        : '');

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const message = StatementService.buildWhatsAppStatementMessage(statementData);
    const cleanPhone = (statementData.customer.mobile || '').replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length >= 10 ? (cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone) : '';
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
            Fully Paid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/30">
            Partially Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30">
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Container - Bottom sheet on mobile, centered modal on desktop */}
      <div className="bg-[#100d23] border border-cyan-500/20 sm:border-purple-500/30 rounded-t-3xl sm:rounded-2xl w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,240,255,0.15)] overflow-hidden text-slate-100 animate-slideUp sm:animate-scaleFadeIn">
        
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-purple-900/40 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Purchase Statement</span>
                {statementData.customer.customer_code && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 font-mono">
                    {statementData.customer.customer_code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-purple-300/80">
                Customer: <strong className="text-white">{statementData.customer.name}</strong> • Phone: {statementData.customer.mobile || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsAppShare}
              className="p-2 text-emerald-400 hover:text-emerald-300 rounded-lg hover:bg-emerald-500/10 transition-colors"
              title="Share on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="hidden sm:flex p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              title="Print Statement"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(0,240,255,0.3)] transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Period & Filter Control Bar */}
        <div className="px-5 sm:px-6 py-3 border-b border-purple-900/30 bg-[#0c0919] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <span className="text-slate-400 font-medium flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Period:
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-[#181230] border border-cyan-500/30 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-cyan-400"
            >
              {STATEMENT_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            {period === 'custom' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-[#181230] border border-purple-800/40 rounded px-2 py-0.5 text-white text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-[#181230] border border-purple-800/40 rounded px-2 py-0.5 text-white text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={isDetailed}
                onChange={(e) => setIsDetailed(e.target.checked)}
                className="rounded border-purple-700 bg-purple-950 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
              />
              <span className="text-xs">Show Line Items</span>
            </label>

            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#181230] border border-purple-800/40 hover:border-purple-600 text-purple-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top KPI Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#150f2b] border border-purple-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Invoiced</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-white font-mono">
                  ₹{statementData.kpi.total_invoiced.toFixed(2)}
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  {statementData.kpi.invoices_count} bills
                </span>
              </div>
            </div>

            <div className="bg-[#150f2b] border border-purple-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Paid in Period</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-emerald-400 font-mono">
                  ₹{statementData.kpi.total_paid.toFixed(2)}
                </span>
                <span className="text-[11px] text-emerald-400/70 font-medium">Verified</span>
              </div>
            </div>

            <div className="bg-[#150f2b] border border-purple-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Units Bought</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-indigo-300 font-mono">
                  {statementData.kpi.total_units_bought}
                </span>
                <span className="text-[11px] text-indigo-400 font-medium">Quantity</span>
              </div>
            </div>

            <div className="bg-[#150f2b] border border-purple-900/40 rounded-xl p-3 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Net Outstanding</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-rose-400 font-mono">
                  ₹{statementData.reconciliation.current_outstanding_balance.toFixed(2)}
                </span>
                {statementData.reconciliation.advance_balance > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono" title="Available Advance">
                    +₹{statementData.reconciliation.advance_balance.toFixed(0)} adv
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Grouped Day Breakdown / Invoices List */}
          <div className="space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Purchases & Transactions ({statementData.invoices.length} Bills)
              </span>
              <span className="text-xs text-slate-400 font-normal">
                {statementData.period.label}
              </span>
            </h3>

            {statementData.invoices.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-purple-900/40 rounded-xl bg-purple-950/10 text-xs text-slate-400">
                No purchase transactions recorded for the selected period.
              </div>
            ) : (
              <div className="space-y-3">
                {statementData.grouped_by_date.map((group) => (
                  <div key={group.date} className="border border-purple-900/40 rounded-xl overflow-hidden bg-[#150f2b]">
                    {/* Day Group Header */}
                    <div className="bg-[#1c1438] px-4 py-2 border-b border-purple-900/40 flex items-center justify-between text-xs font-semibold text-purple-200">
                      <span>Date: {group.date}</span>
                      <span className="font-mono text-cyan-300">
                        Day Total: ₹{group.day_total.toFixed(2)}
                      </span>
                    </div>

                    {/* Invoices inside this day */}
                    <div className="divide-y divide-purple-900/20">
                      {group.invoices.map((inv) => (
                        <div key={inv.id} className="p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleBillExpand(inv.id)}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors"
                              >
                                {expandedBills[inv.id] ? (
                                  <ChevronUp className="w-4 h-4 text-cyan-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                              <span className="font-mono font-bold text-white">{inv.bill_number}</span>
                              {getStatusBadge(inv.payment_status)}
                            </div>

                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-white font-bold">₹{inv.grand_total.toFixed(2)}</span>
                              {inv.balance_due > 0 && (
                                <span className="text-rose-400 text-[11px]">(Due: ₹{inv.balance_due.toFixed(2)})</span>
                              )}
                              {onInspectBill && (
                                <button
                                  onClick={() => onInspectBill(inv.id)}
                                  className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                                  title="View Full Bill"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Line items details if expanded or detailed view */}
                          {(expandedBills[inv.id] || isDetailed) && inv.items.length > 0 && (
                            <div className="pl-6 pt-1">
                              <div className="bg-[#100b21] rounded-lg p-2 border border-purple-900/30 overflow-x-auto">
                                <table className="w-full text-[11px] text-left">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-purple-900/40 pb-1 font-medium">
                                      <th className="py-1 px-2">Item</th>
                                      <th className="py-1 px-2 text-right">Qty</th>
                                      <th className="py-1 px-2 text-right">Rate</th>
                                      <th className="py-1 px-2 text-right">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-purple-900/20 text-slate-200">
                                    {inv.items.map((it, idx) => (
                                      <tr key={idx}>
                                        <td className="py-1 px-2 font-medium">{it.product_name}</td>
                                        <td className="py-1 px-2 text-right font-mono text-cyan-300">{it.quantity} {it.unit || ''}</td>
                                        <td className="py-1 px-2 text-right font-mono text-slate-300">₹{it.price.toFixed(2)}</td>
                                        <td className="py-1 px-2 text-right font-mono font-bold text-white">₹{it.total.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-purple-900/40 bg-[#0a0715] flex items-center justify-between text-xs text-slate-400">
          <span>Statement for: <strong className="text-white">{statementData.customer.name}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
