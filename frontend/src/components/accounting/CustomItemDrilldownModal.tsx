import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Search,
  ArrowUpDown,
  Sparkles,
  DollarSign,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { ProductAnalyticsService } from '../../services/productAnalyticsService';
import { CustomItemAnalyticsData } from '../../types/billing';

interface CustomItemDrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  customData: CustomItemAnalyticsData | null;
  business?: any;
  periodLabel?: string;
  onInspectBill?: (billId: string) => void;
}

export default function CustomItemDrilldownModal({
  isOpen,
  onClose,
  customData,
  business = {},
  periodLabel = 'Selected Period',
  onInspectBill,
}: CustomItemDrilldownModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isExporting, setIsExporting] = useState(false);

  // Filter and sort transaction history
  const filteredTransactions = useMemo(() => {
    if (!customData) return [];
    let txs = [...customData.transaction_history];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      txs = txs.filter(
        (t) =>
          t.bill_number.toLowerCase().includes(q) ||
          t.customer_name.toLowerCase().includes(q)
      );
    }

    txs.sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return txs;
  }, [customData, searchTerm, sortOrder]);

  if (!isOpen || !customData) return null;

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const doc = ProductAnalyticsService.generateCustomItemSalesPDF(
        customData,
        business,
        periodLabel,
        '₹'
      );
      const filename = `${customData.product_name.replace(/\s+/g, '_')}_Custom_Sales.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Failed to export custom service PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    try {
      const doc = ProductAnalyticsService.generateCustomItemSalesPDF(
        customData,
        business,
        periodLabel,
        '₹'
      );
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error('Failed to print custom service report', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Container */}
      <div className="bg-[#100d23] border border-cyan-500/20 sm:border-purple-500/30 rounded-t-3xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,240,255,0.15)] overflow-hidden text-slate-100 animate-slideUp sm:animate-scaleFadeIn">
        
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-600/60 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-purple-900/40 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{customData.product_name}</span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/30 font-mono">
                  Custom Service
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ad-Hoc Uncataloged Item • {periodLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Print Report"
            >
              <Printer className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/50 border border-purple-500/20 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Quantity Sold</span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-white">{customData.total_quantity.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400">units</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Total in {periodLabel}</span>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/50 border border-emerald-500/20 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Revenue</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-emerald-400">₹{customData.total_revenue.toFixed(2)}</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Realized billings</span>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/50 border border-cyan-500/20 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Selling Rate</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-black text-cyan-400">₹{customData.average_selling_rate.toFixed(2)}</span>
                <span className="text-[11px] text-slate-400">/ unit</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Weighted average</span>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/50 border border-amber-500/20 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Rate Applied</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-base sm:text-lg font-black text-amber-300">
                  ₹{customData.min_rate.toFixed(0)} - ₹{customData.max_rate.toFixed(0)}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">
                {customData.orders_count} Invoices billed
              </span>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Transaction Audit Trail ({filteredTransactions.length})
                </h3>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search invoice or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
                  title="Sort by Date"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="border border-purple-900/40 rounded-xl overflow-hidden bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 border-b border-purple-900/40 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Applied Rate</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      {onInspectBill && <th className="py-2.5 px-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/20 text-slate-300">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={onInspectBill ? 7 : 6} className="py-8 text-center text-slate-500 italic">
                          No sales transactions found for this custom service in the selected period.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-purple-950/20 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-cyan-300 whitespace-nowrap">
                            {tx.bill_number}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-200 truncate max-w-[150px]">
                            {tx.customer_name}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-white">
                            {tx.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span>₹{tx.price.toFixed(2)}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                            ₹{tx.total.toFixed(2)}
                          </td>
                          {onInspectBill && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  onClose();
                                  onInspectBill(tx.bill_id);
                                }}
                                className="p-1 rounded hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300 transition-colors"
                                title="View Bill"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-purple-900/40 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500">
          <span>PrintPro Intelligence Engine</span>
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
