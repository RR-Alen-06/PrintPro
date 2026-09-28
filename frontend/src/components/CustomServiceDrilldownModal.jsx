import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Search,
  ArrowUpDown,
  TrendingUp,
  Wrench,
  DollarSign,
  AlertTriangle,
  FileText,
  ExternalLink,
  Calendar,
} from 'lucide-react';

export default function CustomServiceDrilldownModal({
  isOpen,
  onClose,
  serviceData,
  business = {},
  periodLabel = 'Selected Period',
  onInspectBill,
}) {
  if (!isOpen || !serviceData) return null;

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredTransactions = useMemo(() => {
    let txs = [...serviceData.transaction_history];

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
  }, [serviceData.transaction_history, searchTerm, sortOrder]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#120924] border border-purple-900/60 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-900/40 bg-purple-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {serviceData.product_name}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-900/50 text-amber-300 border border-amber-700/40 font-mono">
                  Custom / Ad-Hoc Service
                </span>
              </h2>
              <p className="text-xs text-purple-300/80">
                First Used: {serviceData.first_used_at ? serviceData.first_used_at.slice(0, 10) : 'N/A'} • Last Used: {serviceData.last_used_at ? serviceData.last_used_at.slice(0, 10) : 'N/A'}
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Volume Rendered</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white font-mono">{serviceData.total_quantity}</span>
                <span className="text-xs text-purple-400 font-medium">Units</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Total Revenue</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-emerald-400 font-mono">₹{serviceData.total_revenue.toFixed(2)}</span>
                <span className="text-xs text-emerald-400/80 font-medium">Realized</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Average Selling Rate</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-indigo-300 font-mono">₹{serviceData.average_selling_rate.toFixed(2)}</span>
                <span className="text-xs text-indigo-400/80 font-medium">Per Unit</span>
              </div>
            </div>

            <div className="bg-[#180e30] border border-purple-900/40 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
              <span className="text-[11px] font-medium text-purple-300/70 uppercase tracking-wider">Billed In</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-purple-300 font-mono">{serviceData.orders_count}</span>
                <span className="text-xs text-purple-400 font-medium">Invoices</span>
              </div>
            </div>
          </div>

          {/* Pricing Dynamic Rate Range */}
          <div className="bg-purple-950/30 border border-purple-800/40 rounded-xl p-3.5 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <strong className="text-white">Ad-Hoc Rate Range:</strong> Charged between{' '}
                <span className="font-mono font-bold text-white">₹{serviceData.min_rate.toFixed(2)}</span> and{' '}
                <span className="font-mono font-bold text-white">₹{serviceData.max_rate.toFixed(2)}</span>.
              </div>
            </div>
            {serviceData.is_dynamic_rate ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/50 font-semibold text-amber-300">
                Dynamic Pricing
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 font-semibold text-emerald-300">
                Consistent Rate
              </span>
            )}
          </div>

          {/* Transaction History Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                Service Usage Log ({filteredTransactions.length} Invoices)
              </h3>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search invoice or customer..."
                    className="pl-8 pr-3 py-1 bg-[#180e30] border border-purple-800/40 rounded-lg text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500 w-52"
                  />
                </div>

                <button
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#180e30] border border-purple-800/40 rounded-lg text-xs text-purple-300 hover:text-white transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </button>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-purple-900/40 rounded-xl bg-purple-950/10 text-xs text-purple-300">
                No matching sales transactions found.
              </div>
            ) : (
              <div className="border border-purple-900/40 rounded-xl overflow-hidden bg-[#180e30]">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-purple-950/40 text-purple-300/80 uppercase text-[10px] font-semibold border-b border-purple-900/40">
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                      {onInspectBill && <th className="py-2.5 px-3 text-center w-12">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/20 text-slate-200">
                    {filteredTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-purple-950/20">
                        <td className="py-2.5 px-3 text-slate-400 font-mono">
                          {tx.created_at ? tx.created_at.slice(0, 10) : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{tx.bill_number}</td>
                        <td className="py-2.5 px-3 text-purple-200 font-medium">{tx.customer_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-300">{tx.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-white">₹{tx.price.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">₹{tx.total.toFixed(2)}</td>
                        {onInspectBill && (
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => onInspectBill(tx.bill_id)}
                              className="p-1 text-purple-400 hover:text-white hover:bg-purple-800/40 rounded transition-colors"
                              title="View Bill"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-purple-900/40 bg-[#0c0517] flex items-center justify-between text-xs text-slate-400">
          <span>Reporting Period: <strong className="text-purple-200">{periodLabel}</strong></span>
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
