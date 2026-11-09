'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '@/lib/services/api';
import { Product, ProductSalesAnalytics, DateFilterOption } from '@/lib/types';
import { 
  X, 
  Package, 
  IndianRupee, 
  ShoppingCart, 
  Calendar, 
  Tag, 
  ExternalLink,
  Receipt,
  Search,
  Filter,
  ArrowUpDown,
  BarChart3
} from 'lucide-react';

interface ProductSalesHistoryModalProps {
  product: Product;
  onClose: () => void;
  onViewInvoice?: (billId: string) => void;
}

export function ProductSalesHistoryModal({ product, onClose, onViewInvoice }: ProductSalesHistoryModalProps) {
  const [filter, setFilter] = useState<DateFilterOption>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [analytics, setAnalytics] = useState<ProductSalesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDesc, setSortDesc] = useState(true);

  const fetchAnalytics = useCallback(async (selectedFilter: DateFilterOption, from?: string, to?: string) => {
    setLoading(true);
    try {
      const customRange = (selectedFilter === 'custom' && from && to) ? { from, to } : undefined;
      const data = await ApiService.getProductSalesAnalytics(product.id, selectedFilter, customRange);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load product sales analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (filter === 'custom' && (!customFrom || !customTo)) {
        return;
      }
      try {
        const customRange = (filter === 'custom' && customFrom && customTo) ? { from: customFrom, to: customTo } : undefined;
        const data = await ApiService.getProductSalesAnalytics(product.id, filter, customRange);
        if (isMounted) {
          setAnalytics(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load product sales analytics:', err);
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [product.id, filter, customFrom, customTo]);

  const handleApplyCustomFilter = () => {
    if (customFrom && customTo) {
      fetchAnalytics('custom', customFrom, customTo);
    }
  };

  const filteredTransactions = (analytics?.transactions || [])
    .filter(t => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.bill_number.toLowerCase().includes(q) ||
        (t.customer_name && t.customer_name.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortDesc ? diff : -diff;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header (Clean Light ERP Surface) */}
        <div className="flex items-center justify-between px-6 py-4 bg-white text-slate-900 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 font-sans">{product.name}</h2>
                {product.product_code && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200 font-semibold">
                    {product.product_code}
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                  {product.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{product.product_code === 'CUSTOM' ? 'Ad-Hoc / Custom Service Realized Rate:' : 'Master Catalog Rate:'}</span>
                <span className="text-emerald-600 font-bold font-mono">₹{Number(product.price).toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mr-1 font-mono">
              <Filter className="w-3 h-3 text-slate-500" /> Period:
            </span>
            {(
              [
                { id: 'all_time', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'monthly', label: 'This Month' },
                { id: 'custom', label: 'Custom Window' }
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                onClick={() => setFilter(preset.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
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
                className="px-2.5 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold transition"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-100/60">
          
          {/* Summary Bento Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Total Qty Sold */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Quantity Sold</span>
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {loading ? '...' : (analytics?.total_quantity_sold || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-500 font-mono">units</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Total volume billed</div>
            </div>

            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Revenue Earned</span>
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
                  {loading ? '...' : `₹${(analytics?.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Gross sales turnover</div>
            </div>

            {/* Average Selling Rate */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Avg Selling Rate</span>
                <Tag className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                  {loading ? '...' : `₹${(analytics?.average_selling_rate || product.price).toFixed(2)}`}
                </span>
                <span className="text-xs text-slate-500 font-mono">/ unit</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {analytics && analytics.average_selling_rate !== product.price ? (
                  <span className="text-blue-600 font-medium">Custom rates realized</span>
                ) : (
                  <span>Standard catalog rate</span>
                )}
              </div>
            </div>

            {/* Orders Count */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Invoices Count</span>
                <ShoppingCart className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {loading ? '...' : (analytics?.orders_count || 0)}
                </span>
                <span className="text-xs text-slate-500 font-mono">bills</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Distinct customer sales</div>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  Chronological Transaction History
                  <span className="text-[11px] font-normal text-slate-500 font-mono">
                    ({filteredTransactions.length} records)
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search bill # or customer..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-48 sm:w-56 shadow-2xs"
                  />
                </div>
                <button
                  onClick={() => setSortDesc(!sortDesc)}
                  className="p-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 font-mono shadow-2xs"
                  title="Toggle chronological sort"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline text-[11px]">{sortDesc ? 'Newest' : 'Oldest'}</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-sm">
                <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="font-medium text-slate-600">Loading product transaction log...</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300 p-6 shadow-2xs">
                <Package className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold text-slate-700">No transactions recorded for this period</p>
                <p className="text-xs text-slate-400 mt-1">This product has not been included in any billed invoices within the selected date window.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 font-mono">
                    <tr>
                      <th className="py-2.5 px-3.5">Invoice #</th>
                      <th className="py-2.5 px-3.5">Date & Time</th>
                      <th className="py-2.5 px-3.5 font-sans">Customer</th>
                      <th className="py-2.5 px-3.5 text-center">Qty × Rate</th>
                      <th className="py-2.5 px-3.5 text-right">Total Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTransactions.map((tx, idx) => {
                      const dateObj = new Date(tx.created_at);
                      const formattedDate = dateObj.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });
                      const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <tr key={`${tx.bill_id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-medium text-blue-600">
                            {onViewInvoice ? (
                              <button
                                onClick={() => onViewInvoice(tx.bill_id)}
                                className="hover:underline flex items-center gap-1 font-semibold group"
                              >
                                <span>{tx.bill_number}</span>
                                <ExternalLink className="w-3 h-3 inline opacity-50 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ) : (
                              <span>{tx.bill_number}</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                            <div className="font-medium text-slate-800">{formattedDate}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{formattedTime}</div>
                          </td>
                          <td className="py-3 px-3.5 font-medium text-slate-900">
                            {tx.customer_name}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <div className="font-mono text-slate-800">
                              <span className="font-semibold">{tx.quantity}</span> × ₹{tx.price.toFixed(2)}
                            </div>
                            {tx.is_custom_rate ? (
                              <span 
                                className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono"
                                title={`Standard catalog rate is ₹${tx.catalog_price.toFixed(2)}`}
                              >
                                ⚡ Custom Rate (Std: ₹{tx.catalog_price.toFixed(2)})
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-mono">Standard Rate</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap text-sm">
                            ₹{tx.total.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>{product.product_code === 'CUSTOM' ? 'Ad-Hoc Realized Avg Rate: ' : 'Catalog Master Rate: '}<strong className="text-slate-800 font-mono">₹{product.price.toFixed(2)}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

