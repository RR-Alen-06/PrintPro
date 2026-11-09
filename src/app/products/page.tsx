'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '@/lib/services/api';
import { Product, Bill, CustomItemAnalytics, DateFilterOption } from '@/lib/types';
import { SupabaseBanner } from '@/components/SupabaseBanner';
import { ProductSalesHistoryModal } from '@/components/ProductSalesHistoryModal';
import { InvoiceModal } from '@/components/InvoiceModal';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  BarChart2,
  Layers,
  Sparkles,
  Calendar,
  IndianRupee,
  ShoppingCart,
  FolderPlus,
  Filter
} from 'lucide-react';

const CATEGORIES = ['Xerox & Print', 'Lamination & Binding', 'Stationery', 'Paper & Envelopes', 'Other Services'];

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom_items'>('catalog');

  // Master Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Custom Items Analytics State
  const [customItems, setCustomItems] = useState<CustomItemAnalytics[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [customSearchTerm, setCustomSearchTerm] = useState('');
  const [customDateFilter, setCustomDateFilter] = useState<DateFilterOption>('all_time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Analytics Modal state
  const [analyticsProduct, setAnalyticsProduct] = useState<Product | null>(null);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState<number | ''>('');

  // Delete Confirmation Modal state
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Status feedback
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomItems = useCallback(async (filter: DateFilterOption, from?: string, to?: string) => {
    setLoadingCustom(true);
    try {
      const customRange = (filter === 'custom' && from && to) ? { from, to } : undefined;
      const data = await ApiService.getCustomItemsAnalytics(filter, customRange);
      setCustomItems(data);
    } catch (err) {
      console.error('Failed to fetch custom items analytics:', err);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCustomItems('all_time');
  }, [loadCustomItems]);

  const handleApplyCustomDateFilter = () => {
    if (customFrom && customTo) {
      loadCustomItems('custom', customFrom, customTo);
    }
  };

  const handleFilterChange = (filter: DateFilterOption) => {
    setCustomDateFilter(filter);
    if (filter !== 'custom') {
      loadCustomItems(filter);
    }
  };

  const handleOpenAdd = (prefillName?: string, prefillPrice?: number) => {
    setEditingProduct(null);
    setName(prefillName || '');
    setCategory(CATEGORIES[0]);
    setPrice(prefillPrice !== undefined ? prefillPrice : '');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setPrice(product.price);
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('Price cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        await ApiService.updateProduct(editingProduct.id, {
          name: name.trim(),
          category,
          price: priceNum
        });
        setSuccessMsg('Product updated successfully.');
      } else {
        await ApiService.addProduct({
          name: name.trim(),
          category,
          price: priceNum
        });
        setSuccessMsg('Product added to Master Catalog successfully.');
      }
      setShowModal(false);
      loadProducts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    try {
      await ApiService.deleteProduct(deletingProduct.id);
      setSuccessMsg('Product deleted successfully.');
      setDeletingProduct(null);
      loadProducts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  const handleViewInvoice = async (billId: string) => {
    try {
      const b = await ApiService.getBillById(billId);
      if (b) setViewingBill(b);
    } catch (err) {
      console.error('Failed to load bill for preview:', err);
    }
  };

  const handleViewCustomItemAnalytics = (item: CustomItemAnalytics) => {
    setAnalyticsProduct({
      id: `custom:${encodeURIComponent(item.name)}`,
      name: item.name,
      price: item.average_selling_rate,
      category: 'Custom Service',
      product_code: 'CUSTOM',
      created_at: item.first_used_at || new Date().toISOString()
    });
  };

  // Filtered lists
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCustomItems = customItems.filter(item =>
    item.name.toLowerCase().includes(customSearchTerm.toLowerCase())
  );

  // Custom Items Aggregated Summary Metrics
  const totalCustomRevenue = customItems.reduce((sum, i) => sum + i.total_revenue, 0);
  const totalCustomQty = customItems.reduce((sum, i) => sum + i.total_quantity, 0);
  const totalCustomOrders = customItems.reduce((sum, i) => sum + i.orders_count, 0);

  return (
    <div className="space-y-6">
      <SupabaseBanner />

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center space-x-2">
            <Package className="text-blue-600" />
            <span>Products & Services</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage master rate cards, track sales volumes, and analyze custom ad-hoc services billed to customers.
          </p>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-xs flex items-center justify-center space-x-2 transition shrink-0"
        >
          <Plus size={16} />
          <span>Add New Product</span>
        </button>
      </div>

      {/* FEEDBACK NOTICES */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-xs flex items-center space-x-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-xs flex items-center space-x-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* TAB SELECTOR */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 px-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'catalog'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Master Catalog</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
            activeTab === 'catalog' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {products.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('custom_items')}
          className={`pb-3 px-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'custom_items'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Custom & Ad-Hoc Services</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
            activeTab === 'custom_items' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {customItems.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MASTER CATALOG                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* SEARCH BAR */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-2xs max-w-md">
            <Search size={16} className="text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search products by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-600">
                Clear
              </button>
            )}
          </div>

          {/* PRODUCTS TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading product catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Package className="mx-auto text-slate-300 mb-3" size={40} />
                <p className="font-medium text-base text-slate-700">No products found.</p>
                <p className="text-xs text-slate-400 mt-1">Add items like A4 B&W, A4 Color, Lamination, Spiral Binding, Pens, Notebooks to start billing.</p>
                <button
                  onClick={() => handleOpenAdd()}
                  className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs inline-flex items-center space-x-1.5"
                >
                  <Plus size={14} />
                  <span>Add Your First Product</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 font-mono">
                      <th className="px-6 py-3.5">Product Name</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5 text-right font-mono">Unit Price</th>
                      <th className="px-6 py-3.5 text-center w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          <div>{product.name}</div>
                          {product.product_code && (
                            <div className="text-[11px] font-mono text-slate-400 font-normal">{product.product_code}</div>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                          ₹{Number(product.price).toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setAnalyticsProduct(product)}
                              className="px-2.5 py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition flex items-center gap-1 font-semibold text-xs border border-indigo-200"
                              title="Sales History & Analytics"
                            >
                              <BarChart2 size={13} />
                              <span className="text-[11px]">Analytics</span>
                            </button>
                            <button
                              onClick={() => handleOpenEdit(product)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit Product"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => setDeletingProduct(product)}
                              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                              title="Delete Product"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CUSTOM & AD-HOC SERVICES ANALYTICS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'custom_items' && (
        <div className="space-y-5">
          
          {/* Custom Items Banner / Bento Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Unique Custom Items */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Unique Services</span>
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {loadingCustom ? '...' : customItems.length}
                </span>
                <span className="text-xs text-slate-500 font-mono">items</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Ad-hoc services logged</div>
            </div>

            {/* Total Custom Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Gross Revenue</span>
                <IndianRupee className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
                  {loadingCustom ? '...' : `₹${totalCustomRevenue.toFixed(2)}`}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">From non-catalog items</div>
            </div>

            {/* Total Units */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Total Units Billed</span>
                <Package className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {loadingCustom ? '...' : totalCustomQty}
                </span>
                <span className="text-xs text-slate-500 font-mono">units</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Total quantity billed</div>
            </div>

            {/* Invoices Count */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <span>Invoices Count</span>
                <ShoppingCart className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 font-mono">
                  {loadingCustom ? '...' : totalCustomOrders}
                </span>
                <span className="text-xs text-slate-500 font-mono">bills</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Transactions with custom items</div>
            </div>
          </div>

          {/* Filter Toolbar for Custom Items */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            
            {/* Search */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs w-full sm:w-72">
              <Search size={14} className="text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search custom services..."
                value={customSearchTerm}
                onChange={(e) => setCustomSearchTerm(e.target.value)}
                className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
              />
              {customSearchTerm && (
                <button onClick={() => setCustomSearchTerm('')} className="text-xs text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mr-1 font-mono">
                <Filter className="w-3 h-3 text-slate-500" /> Period:
              </span>
              {(
                [
                  { id: 'all_time', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'monthly', label: 'This Month' },
                  { id: 'custom', label: 'Custom' }
                ] as const
              ).map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleFilterChange(preset.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    customDateFilter === preset.id
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}

              {customDateFilter === 'custom' && (
                <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
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
                    onClick={handleApplyCustomDateFilter}
                    disabled={!customFrom || !customTo}
                    className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold transition"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CUSTOM ITEMS TABLE */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loadingCustom ? (
              <div className="p-12 text-center text-slate-500 text-sm">Loading custom services analytics...</div>
            ) : filteredCustomItems.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Sparkles className="mx-auto text-amber-300 mb-3" size={40} />
                <p className="font-medium text-base text-slate-700">No custom ad-hoc services recorded.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  When you type in a custom item or service during billing without selecting a pre-existing catalog product, it will automatically appear here for tracking and one-click saving to catalog.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 font-mono">
                      <th className="px-6 py-3.5">Custom Item / Service Name</th>
                      <th className="px-6 py-3.5 text-right font-mono">Units Sold</th>
                      <th className="px-6 py-3.5 text-right font-mono">Gross Revenue</th>
                      <th className="px-6 py-3.5 text-right font-mono">Realized Avg Rate</th>
                      <th className="px-6 py-3.5 text-center font-mono">Orders Count</th>
                      <th className="px-6 py-3.5 text-center w-56">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                    {filteredCustomItems.map((item) => (
                      <tr key={item.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-tight">
                              Custom
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                            Last billed: {new Date(item.last_used_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-semibold text-slate-800">
                          {item.total_quantity}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-emerald-600 text-sm">
                          ₹{item.total_revenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-slate-700">
                          ₹{item.average_selling_rate.toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5 text-center font-mono text-slate-600">
                          {item.orders_count} bills
                        </td>
                        <td className="px-6 py-3.5 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleViewCustomItemAnalytics(item)}
                              className="px-2.5 py-1 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition flex items-center gap-1 font-semibold text-xs border border-indigo-200"
                              title="Detailed Transaction Analytics"
                            >
                              <BarChart2 size={13} />
                              <span className="text-[11px]">Analytics</span>
                            </button>
                            <button
                              onClick={() => handleOpenAdd(item.name, item.average_selling_rate)}
                              className="px-2.5 py-1 text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition flex items-center gap-1 font-semibold text-xs border border-emerald-200"
                              title="Save this custom service to Master Catalog"
                            >
                              <FolderPlus size={13} />
                              <span className="text-[11px]">Save to Catalog</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT MODAL                                                          */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product to Catalog'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product / Service Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A4 B&W Xerox, Spiral Binding, Pen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit Price (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.25"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-center animate-in zoom-in-95 duration-200">
            <AlertTriangle className="mx-auto text-rose-600" size={40} />
            <h3 className="text-lg font-bold text-slate-900">Confirm Product Deletion</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-900">&quot;{deletingProduct.name}&quot;</span>? This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3 pt-2">
              <button
                onClick={() => setDeletingProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-xs"
              >
                Yes, Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT / CUSTOM SERVICE SALES HISTORY & ANALYTICS MODAL                  */}
      {/* ========================================================================= */}
      {analyticsProduct && (
        <ProductSalesHistoryModal
          product={analyticsProduct}
          onClose={() => setAnalyticsProduct(null)}
          onViewInvoice={handleViewInvoice}
        />
      )}

      {/* ========================================================================= */}
      {/* INVOICE PREVIEW MODAL                                                     */}
      {/* ========================================================================= */}
      {viewingBill && (
        <InvoiceModal
          bill={viewingBill}
          onClose={() => setViewingBill(null)}
        />
      )}
    </div>
  );
}
