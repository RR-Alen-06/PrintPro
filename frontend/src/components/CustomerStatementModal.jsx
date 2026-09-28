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
} from 'lucide-react';
import { StatementService, STATEMENT_PERIOD_OPTIONS } from '../services/statementService';

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
}) {
  if (!isOpen || !customerId) return null;

  const [period, setPeriod] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDetailed, setIsDetailed] = useState(true);
  const [expandedBills, setExpandedBills] = useState({});
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Compute statement data
  const statementData = useMemo(() => {
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

  const toggleBillExpand = (billId) => {
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
    const summaryText = `*STATEMENT OF ACCOUNT - ${statementData.store.shopName}*\n` +
      `Customer: ${statementData.customer.name} (${statementData.customer.customer_code})\n` +
      `Period: ${statementData.period.label}\n\n` +
      `*KPI Summary:*\n` +
      `• Total Invoiced: ₹${statementData.kpi.total_invoiced.toFixed(2)} (${statementData.kpi.invoices_count} Bills)\n` +
      `• Total Paid in Period: ₹${statementData.kpi.total_paid.toFixed(2)}\n` +
      `• Total Units Purchased: ${statementData.kpi.total_units_bought} Items\n\n` +
      `*Ledger Status:*\n` +
      `• Current Outstanding Balance: ₹${statementData.reconciliation.current_outstanding_balance.toFixed(2)}\n` +
      (statementData.reconciliation.advance_balance > 0 ? `• Available Advance/Credit: ₹${statementData.reconciliation.advance_balance.toFixed(2)}\n` : '');

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            Fully Paid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
            Partially Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#120924] border border-purple-900/60 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Consolidated Purchase Statement
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-700/40 font-mono">
                  {statementData.customer.customer_code}
                </span>
              </h2>
              <p className="text-xs text-purple-300/80">
                Customer: <strong className="text-white">{statementData.customer.name}</strong> • Phone: {statementData.customer.mobile || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar & Actions */}
        <div className="px-6 py-3 border-b border-purple-900/30 bg-[#0c0517] flex flex-wrap items-center justify-between gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-purple-950/40 p-1 rounded-xl border border-purple-800/40">
              {STATEMENT_PERIOD_OPTIONS.slice(0, 6).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriod(opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                    period === opt.value
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-purple-200/70 hover:text-white hover:bg-purple-800/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <select
                value={['today', 'yesterday', 'this_week', 'last_7_days', 'this_month', 'last_month'].includes(period) ? '' : period}
                onChange={(e) => setPeriod(e.target.value || 'this_quarter')}
                className="bg-purple-900/40 text-purple-200 text-xs px-2 py-1 rounded-lg border border-purple-700/40 focus:outline-none focus:border-purple-500"
              >
                <option value="" disabled>More ranges...</option>
                {STATEMENT_PERIOD_OPTIONS.slice(6).map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#120924]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-800/30">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-purple-900/40 border border-purple-700/50 rounded px-1.5 py-0.5 text-white text-xs"
                />
                <span className="text-purple-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-purple-900/40 border border-purple-700/50 rounded px-1.5 py-0.5 text-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Detailed / Compact Toggle */}
            <button
              onClick={() => setIsDetailed(!isDetailed)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isDetailed
                  ? 'bg-purple-900/40 border-purple-600 text-purple-200'
                  : 'bg-slate-800/50 border-slate-700 text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {isDetailed ? 'Itemized View' : 'Compact Bills'}
            </button>

            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 border border-slate-700 transition-colors"
              title="Copy statement summary to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/30 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {isExporting ? 'Generating PDF...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* KPI Strip & Account Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Period Invoiced</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white font-mono">₹{statementData.kpi.total_invoiced.toFixed(2)}</span>
                <span className="text-xs text-purple-400 font-medium">{statementData.kpi.invoices_count} Bills</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Period Payments</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-400 font-mono">₹{statementData.kpi.total_paid.toFixed(2)}</span>
                <span className="text-xs text-emerald-400/80 font-medium">Received</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Total Units Bought</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-indigo-300 font-mono">{statementData.kpi.total_units_bought}</span>
                <span className="text-xs text-indigo-400/80 font-medium">Items</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Current Account Balance</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={`text-xl font-bold font-mono ${statementData.reconciliation.current_outstanding_balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ₹{statementData.reconciliation.current_outstanding_balance.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400">
                  {statementData.reconciliation.current_outstanding_balance > 0 ? 'Unpaid Due' : 'All Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* Account Reconciliation Banner */}
          <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-800/30 border border-purple-600/30 flex items-center justify-center text-purple-300">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-white">Live Ledger Status: {statementData.customer.name}</p>
                <p className="text-purple-300/70 text-[11px]">
                  All-time purchases: ₹{statementData.reconciliation.all_time_billed.toFixed(2)} | All-time receipts: ₹{statementData.reconciliation.all_time_paid.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <span className="text-purple-300/70 block text-[10px] uppercase">Period Net Due</span>
                <span className="font-mono font-bold text-white text-sm">
                  ₹{Math.max(0, statementData.kpi.total_invoiced - statementData.kpi.total_paid).toFixed(2)}
                </span>
              </div>
              {statementData.reconciliation.advance_balance > 0 && (
                <div>
                  <span className="text-emerald-400/80 block text-[10px] uppercase">Advance Deposit Credit</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ₹{statementData.reconciliation.advance_balance.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Invoices List / Grouped by Date */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                Purchases Ledger ({statementData.invoices.length} Invoices in {statementData.period.label})
              </h3>
              <span className="text-xs text-slate-400">
                Sorted chronologically
              </span>
            </div>

            {statementData.invoices.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-purple-900/40 rounded-xl bg-purple-950/10">
                <ShoppingBag className="w-10 h-10 text-purple-400/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-purple-200">No invoices found for this time period.</p>
                <p className="text-xs text-purple-400/60 mt-1">Try selecting a broader date range or "All Time".</p>
              </div>
            ) : (
              <div className="space-y-3">
                {statementData.invoices.map((inv) => {
                  const isExpanded = isDetailed || expandedBills[inv.id];

                  return (
                    <div
                      key={inv.id}
                      className="bg-[#180e30] border border-purple-900/40 hover:border-purple-700/50 rounded-xl transition-all overflow-hidden"
                    >
                      {/* Invoice Card Header */}
                      <div
                        onClick={() => toggleBillExpand(inv.id)}
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-purple-950/30 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <button className="text-purple-400 hover:text-white transition-colors">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white text-sm">{inv.bill_number}</span>
                              {getStatusBadge(inv.payment_status)}
                            </div>
                            <span className="text-xs text-purple-300/70 mt-0.5 block">
                              Date: {inv.date} • {inv.items.length} Line Items
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <span className="text-[10px] text-purple-300/60 block uppercase">Grand Total</span>
                            <span className="font-mono font-bold text-white text-sm">₹{inv.grand_total.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-purple-300/60 block uppercase">Paid / Balance Due</span>
                            <span className="font-mono text-xs block text-slate-300">
                              <span className="text-emerald-400">₹{inv.paid_amount.toFixed(2)}</span> /{' '}
                              <span className={inv.balance_due > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                                ₹{inv.balance_due.toFixed(2)}
                              </span>
                            </span>
                          </div>

                          {onInspectBill && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectBill(inv.id);
                              }}
                              className="p-1.5 text-purple-400 hover:text-white hover:bg-purple-800/40 rounded-lg transition-colors"
                              title="Inspect Original Invoice"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Detailed Line Items Sub-Table */}
                      {isExpanded && inv.items.length > 0 && (
                        <div className="border-t border-purple-900/30 bg-[#120924]/60 p-4">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="text-purple-300/70 border-b border-purple-900/30 uppercase text-[10px] font-semibold">
                                <th className="py-1.5 px-2 w-8">#</th>
                                <th className="py-1.5 px-2">Item / Service Description</th>
                                <th className="py-1.5 px-2 text-right">Unit Rate</th>
                                <th className="py-1.5 px-2 text-right">Qty</th>
                                <th className="py-1.5 px-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-purple-900/20 text-slate-200">
                              {inv.items.map((item) => (
                                <tr key={item.item_index} className="hover:bg-purple-950/20">
                                  <td className="py-2 px-2 text-slate-400 font-mono">{item.item_index}</td>
                                  <td className="py-2 px-2 font-medium text-white">{item.product_name}</td>
                                  <td className="py-2 px-2 text-right font-mono text-slate-300">₹{item.price.toFixed(2)}</td>
                                  <td className="py-2 px-2 text-right font-mono text-purple-300">
                                    {item.quantity} {item.unit || ''}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-semibold text-white">₹{item.total.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {/* Invoice Footer Breakdown */}
                          <div className="mt-3 pt-2 border-t border-purple-900/20 flex items-center justify-between text-xs text-purple-300/80">
                            <div className="flex items-center gap-4">
                              <span>Subtotal: <strong>₹{inv.subtotal.toFixed(2)}</strong></span>
                              {inv.discount > 0 && <span className="text-amber-400">Discount: -₹{inv.discount.toFixed(2)}</span>}
                              {inv.tax_amount > 0 && <span>GST/Tax: +₹{inv.tax_amount.toFixed(2)}</span>}
                            </div>
                            <span className="font-mono font-bold text-white">
                              Bill Total: ₹{inv.grand_total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-purple-900/40 bg-[#0c0517] flex items-center justify-between text-xs text-slate-400">
          <div>
            Statement Period: <strong className="text-purple-200">{statementData.period.label}</strong>
          </div>
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
