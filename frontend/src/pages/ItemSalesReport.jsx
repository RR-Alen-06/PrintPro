import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useBills } from '../hooks/useBillsQuery';
import { useCustomers } from '../hooks/useCustomersQuery';
import { useInventory } from '../hooks/useEntitiesQuery';
import {
  Calendar,
  Layers,
  Search,
  Filter,
  Printer,
  Download,
  Share2,
  Copy,
  Check,
  TrendingUp,
  Tag,
  Wrench,
  AlertTriangle,
  FileText,
  DollarSign,
  ShoppingBag,
  ExternalLink,
  ArrowUpDown,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ProductAnalyticsService } from '../services/productAnalyticsService';
import { STATEMENT_PERIOD_OPTIONS, StatementService } from '../services/statementService';
import ProductDrilldownModal from '../components/ProductDrilldownModal';
import CustomServiceDrilldownModal from '../components/CustomServiceDrilldownModal';
import EmptyState from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/Skeleton';

export default function ItemSalesReport() {
  const { business, settings } = useAppContext();
  const { data: bills = [], isLoading: isLoadingBills } = useBills();
  const { data: customers = [] } = useCustomers();
  const { data: inventory = [], isLoading: isLoadingInventory } = useInventory();

  // Tab State: 'catalog' | 'custom'
  const [activeTab, setActiveTab] = useState('catalog');

  // Filter States
  const [period, setPeriod] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('revenue_desc'); // 'revenue_desc' | 'volume_desc' | 'variance' | 'name_asc'

  // Modal drilldown states
  const [selectedProductData, setSelectedProductData] = useState(null);
  const [selectedCustomServiceData, setSelectedCustomServiceData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Period label
  const { label: periodLabel } = useMemo(() => {
    return StatementService.getFilterBoundaries(period, {
      startDate: customStartDate,
      endDate: customEndDate,
    });
  }, [period, customStartDate, customEndDate]);

  // 1. Catalog Products Analytics
  const catalogAnalytics = useMemo(() => {
    const list = ProductAnalyticsService.getAllCatalogProductsAnalytics({
      filter: period,
      customRange: { startDate: customStartDate, endDate: customEndDate },
      bills,
      products: inventory,
    });

    return list;
  }, [period, customStartDate, customEndDate, bills, inventory]);

  // 2. Custom & Ad-Hoc Services Analytics
  const customItemsAnalytics = useMemo(() => {
    return ProductAnalyticsService.getCustomItemsAnalytics({
      filter: period,
      customRange: { startDate: customStartDate, endDate: customEndDate },
      bills,
      products: inventory,
    });
  }, [period, customStartDate, customEndDate, bills, inventory]);

  // Filtered & Sorted Catalog Products
  const filteredCatalogProducts = useMemo(() => {
    let result = [...catalogAnalytics];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.product_name.toLowerCase().includes(q) ||
          (p.product_code && p.product_code.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case 'volume_desc':
        result.sort((a, b) => b.total_quantity_sold - a.total_quantity_sold);
        break;
      case 'variance':
        result.sort((a, b) => (b.has_price_variance ? 1 : 0) - (a.has_price_variance ? 1 : 0));
        break;
      case 'name_asc':
        result.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case 'revenue_desc':
      default:
        result.sort((a, b) => b.total_revenue - a.total_revenue);
        break;
    }

    return result;
  }, [catalogAnalytics, searchQuery, sortBy]);

  // Filtered & Sorted Custom Items
  const filteredCustomItems = useMemo(() => {
    let result = [...customItemsAnalytics];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.product_name.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'volume_desc':
        result.sort((a, b) => b.total_quantity - a.total_quantity);
        break;
      case 'variance':
        result.sort((a, b) => (b.is_dynamic_rate ? 1 : 0) - (a.is_dynamic_rate ? 1 : 0));
        break;
      case 'name_asc':
        result.sort((a, b) => a.product_name.localeCompare(b.product_name));
        break;
      case 'revenue_desc':
      default:
        result.sort((a, b) => b.total_revenue - a.total_revenue);
        break;
    }

    return result;
  }, [customItemsAnalytics, searchQuery, sortBy]);

  // KPI Aggregates for current active tab
  const tabKPIs = useMemo(() => {
    if (activeTab === 'catalog') {
      const totalVolume = catalogAnalytics.reduce((s, p) => s + p.total_quantity_sold, 0);
      const totalRevenue = catalogAnalytics.reduce((s, p) => s + p.total_revenue, 0);
      const activeCount = catalogAnalytics.filter((p) => p.total_quantity_sold > 0).length;
      const avgRate = totalVolume > 0 ? totalRevenue / totalVolume : 0;
      const varianceCount = catalogAnalytics.filter((p) => p.has_price_variance).length;

      return {
        totalVolume,
        totalRevenue,
        avgRate,
        count: activeCount,
        countLabel: 'Active Products Sold',
        varianceCount,
      };
    } else {
      const totalVolume = customItemsAnalytics.reduce((s, c) => s + c.total_quantity, 0);
      const totalRevenue = customItemsAnalytics.reduce((s, c) => s + c.total_revenue, 0);
      const activeCount = customItemsAnalytics.length;
      const avgRate = totalVolume > 0 ? totalRevenue / totalVolume : 0;
      const varianceCount = customItemsAnalytics.filter((c) => c.is_dynamic_rate).length;

      return {
        totalVolume,
        totalRevenue,
        avgRate,
        count: activeCount,
        countLabel: 'Custom Services Billed',
        varianceCount,
      };
    }
  }, [activeTab, catalogAnalytics, customItemsAnalytics]);

  // Export Summary CSV
  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    let csvContent = '';

    if (activeTab === 'catalog') {
      const rows = [
        ['Product Sales Intelligence Report', '', '', '', '', '', ''],
        [`Period:`, periodLabel, '', '', '', '', ''],
        [`Store:`, business?.shopName || 'PrintPro', '', '', '', '', ''],
        [''],
        ['Product Code', 'Product Name', 'Category', 'Catalog Price (Rs)', 'Units Sold', 'Realized Revenue (Rs)', 'Avg Rate (Rs)', 'Price Variance'],
        ...filteredCatalogProducts.map((p) => [
          `"${p.product_code || ''}"`,
          `"${p.product_name}"`,
          `"${p.category || 'General'}"`,
          p.catalog_price.toFixed(2),
          p.total_quantity_sold,
          p.total_revenue.toFixed(2),
          p.average_selling_rate.toFixed(2),
          p.has_price_variance ? `Dynamic (Rs ${p.min_rate.toFixed(2)} - ${p.max_rate.toFixed(2)})` : 'Standard Price',
        ]),
      ];
      csvContent = rows.map((r) => r.join(',')).join('\n');
    } else {
      const rows = [
        ['Custom & Ad-Hoc Services Sales Report', '', '', '', '', '', ''],
        [`Period:`, periodLabel, '', '', '', '', ''],
        [`Store:`, business?.shopName || 'PrintPro', '', '', '', '', ''],
        [''],
        ['Custom Service Description', 'Units Billed', 'Realized Revenue (Rs)', 'Avg Rate (Rs)', 'Min Rate (Rs)', 'Max Rate (Rs)', 'Orders Count', 'First Used', 'Last Used'],
        ...filteredCustomItems.map((c) => [
          `"${c.product_name}"`,
          c.total_quantity,
          c.total_revenue.toFixed(2),
          c.average_selling_rate.toFixed(2),
          c.min_rate.toFixed(2),
          c.max_rate.toFixed(2),
          c.orders_count,
          c.first_used_at ? c.first_used_at.slice(0, 10) : '',
          c.last_used_at ? c.last_used_at.slice(0, 10) : '',
        ]),
      ];
      csvContent = rows.map((r) => r.join(',')).join('\n');
    }

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${activeTab === 'catalog' ? 'Catalog_Products' : 'Custom_Services'}_Analytics_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Export Full Summary PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 12;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let currentY = 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(business?.shopName || 'PrintPro Studio', MARGIN, currentY);

    doc.setFontSize(12);
    doc.text(activeTab === 'catalog' ? 'CATALOG PRODUCTS SALES REPORT' : 'CUSTOM & AD-HOC SERVICES REPORT', PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${periodLabel}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(40, 40, 40);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 6;

    // KPI Summary Strip
    doc.setFillColor(245, 246, 248);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, 16, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    const kpiSummaryText = `Total Revenue: Rs. ${tabKPIs.totalRevenue.toFixed(2)}  |  Total Units: ${tabKPIs.totalVolume}  |  Avg Selling Rate: Rs. ${tabKPIs.avgRate.toFixed(2)}  |  ${tabKPIs.countLabel}: ${tabKPIs.count}`;
    doc.text(kpiSummaryText, PAGE_W / 2, currentY + 10, { align: 'center' });
    currentY += 22;

    // Table Header
    doc.setFillColor(235, 238, 242);
    doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);

    if (activeTab === 'catalog') {
      doc.text('CODE', MARGIN + 3, currentY + 4);
      doc.text('PRODUCT / SERVICE NAME', MARGIN + 25, currentY + 4);
      doc.text('CATALOG', MARGIN + 95, currentY + 4, { align: 'right' });
      doc.text('UNITS', MARGIN + 120, currentY + 4, { align: 'right' });
      doc.text('AVG RATE', MARGIN + 145, currentY + 4, { align: 'right' });
      doc.text('TOTAL REVENUE', PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });
      currentY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      filteredCatalogProducts.forEach((p) => {
        if (currentY > PAGE_H - 18) {
          doc.addPage();
          currentY = 14;
        }
        doc.text(p.product_code || '-', MARGIN + 3, currentY + 4);
        doc.text(p.product_name.slice(0, 32), MARGIN + 25, currentY + 4);
        doc.text(`Rs. ${p.catalog_price.toFixed(2)}`, MARGIN + 95, currentY + 4, { align: 'right' });
        doc.text(String(p.total_quantity_sold), MARGIN + 120, currentY + 4, { align: 'right' });
        doc.text(`Rs. ${p.average_selling_rate.toFixed(2)}`, MARGIN + 145, currentY + 4, { align: 'right' });
        doc.text(`Rs. ${p.total_revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    } else {
      doc.text('CUSTOM SERVICE NAME', MARGIN + 3, currentY + 4);
      doc.text('ORDERS', MARGIN + 85, currentY + 4, { align: 'right' });
      doc.text('UNITS', MARGIN + 110, currentY + 4, { align: 'right' });
      doc.text('RATE RANGE', MARGIN + 145, currentY + 4, { align: 'right' });
      doc.text('TOTAL REVENUE', PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });
      currentY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      filteredCustomItems.forEach((c) => {
        if (currentY > PAGE_H - 18) {
          doc.addPage();
          currentY = 14;
        }
        doc.text(c.product_name.slice(0, 36), MARGIN + 3, currentY + 4);
        doc.text(String(c.orders_count), MARGIN + 85, currentY + 4, { align: 'right' });
        doc.text(String(c.total_quantity), MARGIN + 110, currentY + 4, { align: 'right' });
        doc.text(`Rs. ${c.min_rate.toFixed(2)} - ${c.max_rate.toFixed(2)}`, MARGIN + 145, currentY + 4, { align: 'right' });
        doc.text(`Rs. ${c.total_revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    doc.save(`${activeTab === 'catalog' ? 'Catalog_Products' : 'Custom_Services'}_Report_${period}.pdf`);
  };

  const isDataLoading = isLoadingBills || isLoadingInventory;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Product & Sales Intelligence</h1>
          <p className="text-sm text-purple-300/80 mt-1">
            Item-level revenue intelligence, dynamic pricing detection, and ad-hoc custom services drilldown.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            Export Report PDF
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-3 border-b border-purple-900/40 pb-3">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'catalog'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
              : 'text-purple-300/70 hover:text-white hover:bg-purple-950/40'
          }`}
        >
          <Tag className="w-4 h-4" />
          Catalog Products Analytics ({catalogAnalytics.length})
        </button>

        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'custom'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
              : 'text-purple-300/70 hover:text-white hover:bg-purple-950/40'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Custom & Ad-Hoc Services ({customItemsAnalytics.length})
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#180e30] border border-purple-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70 uppercase tracking-wider">Total Volume Sold</span>
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">{tabKPIs.totalVolume}</span>
            <span className="text-xs text-purple-400 font-medium">Units</span>
          </div>
        </div>

        <div className="bg-[#180e30] border border-purple-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70 uppercase tracking-wider">Total Realized Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-400">₹{tabKPIs.totalRevenue.toFixed(2)}</span>
            <span className="text-xs text-emerald-400/80 font-medium">{periodLabel}</span>
          </div>
        </div>

        <div className="bg-[#180e30] border border-purple-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70 uppercase tracking-wider">Weighted Avg Selling Rate</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-indigo-300">₹{tabKPIs.avgRate.toFixed(2)}</span>
            <span className="text-xs text-indigo-400/80 font-medium">Per Unit</span>
          </div>
        </div>

        <div className="bg-[#180e30] border border-purple-900/40 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-300/70 uppercase tracking-wider">{tabKPIs.countLabel}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-300">{tabKPIs.count}</span>
            <span className="text-xs text-amber-400/80 font-medium">
              {tabKPIs.varianceCount > 0 ? `${tabKPIs.varianceCount} Dynamic Pricing` : 'Fixed Pricing'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#180e30] border border-purple-900/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Date Filter Buttons */}
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
              <option value="" disabled>More periods...</option>
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

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'catalog' ? 'Search product or code...' : 'Search custom service...'}
              className="pl-9 pr-4 py-1.5 bg-[#120924] border border-purple-800/40 rounded-xl text-xs text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500 w-56"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-[#120924] px-3 py-1.5 rounded-xl border border-purple-800/40 text-purple-300">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="revenue_desc" className="bg-[#180e30]">Revenue: High to Low</option>
              <option value="volume_desc" className="bg-[#180e30]">Units: High to Low</option>
              <option value="variance" className="bg-[#180e30]">Dynamic Pricing First</option>
              <option value="name_asc" className="bg-[#180e30]">Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Data Table */}
      {isDataLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : activeTab === 'catalog' ? (
        filteredCatalogProducts.length === 0 ? (
          <EmptyState
            Icon={ShoppingBag}
            title="No catalog product sales found"
            description="No matching sales records were found for the selected time range."
          />
        ) : (
          <div className="border border-purple-900/40 rounded-2xl overflow-hidden bg-[#180e30] shadow-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-purple-950/40 text-purple-300/80 uppercase text-[10px] font-semibold border-b border-purple-900/40">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Catalog Rate</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Realized Revenue</th>
                  <th className="py-3 px-4 text-right">Avg Rate</th>
                  <th className="py-3 px-4 text-center">Pricing Dynamics</th>
                  <th className="py-3 px-4 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 text-slate-200">
                {filteredCatalogProducts.map((prod) => (
                  <tr
                    key={prod.product_id}
                    onClick={() => setSelectedProductData(prod)}
                    className="hover:bg-purple-950/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-purple-300 font-semibold">{prod.product_code || '—'}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white text-sm">{prod.product_name}</div>
                      <div className="text-[10px] text-purple-400/70">{prod.orders_count} Invoices</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-purple-900/40 border border-purple-700/40 text-[10px] text-purple-300 font-medium">
                        {prod.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">₹{prod.catalog_price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300 text-sm">{prod.total_quantity_sold}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₹{prod.total_revenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-white">₹{prod.average_selling_rate.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      {prod.has_price_variance ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          ₹{prod.min_rate.toFixed(1)} - ₹{prod.max_rate.toFixed(1)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-semibold">
                          Fixed Standard
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedProductData(prod)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/40 transition-colors"
                      >
                        Drilldown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredCustomItems.length === 0 ? (
          <EmptyState
            Icon={Wrench}
            title="No custom or ad-hoc services billed"
            description="No uncataloged line-items were billed in this time period."
          />
        ) : (
          <div className="border border-purple-900/40 rounded-2xl overflow-hidden bg-[#180e30] shadow-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-purple-950/40 text-purple-300/80 uppercase text-[10px] font-semibold border-b border-purple-900/40">
                  <th className="py-3 px-4">Custom Service Description</th>
                  <th className="py-3 px-4 text-right">Orders Count</th>
                  <th className="py-3 px-4 text-right">Units Rendered</th>
                  <th className="py-3 px-4 text-right">Realized Revenue</th>
                  <th className="py-3 px-4 text-right">Avg Rate</th>
                  <th className="py-3 px-4 text-center">Dynamic Pricing Range</th>
                  <th className="py-3 px-4 text-center">First / Last Used</th>
                  <th className="py-3 px-4 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/20 text-slate-200">
                {filteredCustomItems.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedCustomServiceData(item)}
                    className="hover:bg-purple-950/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white text-sm">{item.product_name}</div>
                      <span className="text-[10px] text-amber-400/80 font-mono">Uncataloged Ad-Hoc Item</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-300">{item.orders_count}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-indigo-300 text-sm">{item.total_quantity}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₹{item.total_revenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-white">₹{item.average_selling_rate.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-200 border border-purple-700/40 text-[10px] font-mono font-semibold">
                        ₹{item.min_rate.toFixed(2)} - ₹{item.max_rate.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 text-[10px] font-mono">
                      {item.first_used_at ? item.first_used_at.slice(0, 10) : 'N/A'} → {item.last_used_at ? item.last_used_at.slice(0, 10) : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedCustomServiceData(item)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-900/50 hover:bg-purple-800 text-purple-200 border border-purple-700/40 transition-colors"
                      >
                        Drilldown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Single Product Drilldown Modal */}
      <ProductDrilldownModal
        isOpen={!!selectedProductData}
        onClose={() => setSelectedProductData(null)}
        productData={selectedProductData}
        business={business}
        periodLabel={periodLabel}
      />

      {/* Custom Service Drilldown Modal */}
      <CustomServiceDrilldownModal
        isOpen={!!selectedCustomServiceData}
        onClose={() => setSelectedCustomServiceData(null)}
        serviceData={selectedCustomServiceData}
        business={business}
        periodLabel={periodLabel}
      />
    </div>
  );
}
