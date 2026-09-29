import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  BarChart2,
  TrendingUp,
  Filter,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  Tag,
  Wrench,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ProductAnalyticsService } from '../../services/productAnalyticsService';
import { STATEMENT_PERIOD_OPTIONS } from '../../services/statementService';
import { ProductSalesAnalyticsData, CustomItemAnalyticsData } from '../../types/billing';
import ProductDrilldownModal from './ProductDrilldownModal';
import CustomServiceDrilldownModal from './CustomServiceDrilldownModal';
import EmptyState from '../common/EmptyState';

interface ItemSalesTabProps {
  bills: any[];
  inventory?: any[];
  customers?: any[];
  business?: any;
  settings?: any;
  onInspectBill?: (billId: string) => void;
}

export const ItemSalesTab: React.FC<ItemSalesTabProps> = ({
  bills = [],
  inventory = [],
  customers = [],
  business = {},
  settings = {},
  onInspectBill,
}) => {
  const [period, setPeriod] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'custom'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductSalesAnalyticsData | null>(null);
  const [selectedCustomService, setSelectedCustomService] = useState<CustomItemAnalyticsData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const customRange = useMemo(
    () => ({ startDate: customStartDate, endDate: customEndDate }),
    [customStartDate, customEndDate]
  );

  // Period label for headers & PDFs
  const periodLabel = useMemo(() => {
    const opt = STATEMENT_PERIOD_OPTIONS.find((o) => o.key === period);
    if (period === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate} to ${customEndDate}`;
    }
    return opt?.label || 'Selected Period';
  }, [period, customStartDate, customEndDate]);

  // Compute catalog items analytics
  const catalogAnalytics: ProductSalesAnalyticsData[] = useMemo(() => {
    return ProductAnalyticsService.getAllCatalogProductsAnalytics({
      filter: period,
      customRange,
      bills,
      products: inventory,
    });
  }, [period, customRange, bills, inventory]);

  // Compute custom services analytics
  const customAnalytics: CustomItemAnalyticsData[] = useMemo(() => {
    return ProductAnalyticsService.getCustomItemsAnalytics({
      filter: period,
      customRange,
      bills,
      products: inventory,
    });
  }, [period, customRange, bills, inventory]);

  // KPIs
  const totalCatalogSold = useMemo(
    () => catalogAnalytics.reduce((sum, item) => sum + item.total_quantity_sold, 0),
    [catalogAnalytics]
  );
  const totalCatalogRevenue = useMemo(
    () => catalogAnalytics.reduce((sum, item) => sum + item.total_revenue, 0),
    [catalogAnalytics]
  );
  const totalCustomSold = useMemo(
    () => customAnalytics.reduce((sum, item) => sum + item.total_quantity, 0),
    [customAnalytics]
  );
  const totalCustomRevenue = useMemo(
    () => customAnalytics.reduce((sum, item) => sum + item.total_revenue, 0),
    [customAnalytics]
  );

  const grandTotalUnits = totalCatalogSold + totalCustomSold;
  const grandTotalRevenue = totalCatalogRevenue + totalCustomRevenue;

  // Filtered lists
  const filteredCatalog = useMemo(() => {
    if (!searchQuery) return catalogAnalytics;
    const q = searchQuery.toLowerCase();
    return catalogAnalytics.filter(
      (item) =>
        item.product_name.toLowerCase().includes(q) ||
        (item.product_code && item.product_code.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [catalogAnalytics, searchQuery]);

  const filteredCustom = useMemo(() => {
    if (!searchQuery) return customAnalytics;
    const q = searchQuery.toLowerCase();
    return customAnalytics.filter((item) =>
      item.product_name.toLowerCase().includes(q)
    );
  }, [customAnalytics, searchQuery]);

  // Export full report PDF
  const handleExportFullPDF = () => {
    try {
      setIsExporting(true);
      const doc = ProductAnalyticsService.generateFullReportPDF(
        catalogAnalytics,
        customAnalytics,
        business,
        periodLabel,
        '₹'
      );
      doc.save(`Product_Sales_Report_${period}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF report', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--aurora-cyan, #00f0ff)" />
            Product Sales & Material Intelligence
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Track sales velocity, dynamic price variance, catalog performance, and ad-hoc custom printing jobs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="form-input"
              style={{
                fontSize: '0.8rem',
                padding: '5px 10px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.7)',
                borderColor: 'var(--border)',
              }}
            >
              {STATEMENT_PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>

            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    height: '34px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border)',
                    color: '#fff',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    height: '34px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid var(--border)',
                    color: '#fff',
                  }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportFullPDF}
            disabled={isExporting}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>{isExporting ? 'Exporting...' : 'Export Report PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        <div
          className="stat-card"
          style={{
            borderLeft: '4px solid var(--aurora-cyan, #00f0ff)',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
          }}
        >
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Total Items & Prints Sold
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--aurora-cyan, #00f0ff)', margin: '4px 0 2px' }}>
            {grandTotalUnits.toLocaleString()} units
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Catalog: {totalCatalogSold} • Custom: {totalCustomSold}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Realized Item Revenue
          </div>
          <div className="currency-num" style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '4px 0 2px' }}>
            ₹{grandTotalRevenue.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Catalog: ₹{totalCatalogRevenue.toFixed(0)} • Custom: ₹{totalCustomRevenue.toFixed(0)}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Catalog Top Seller
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {catalogAnalytics[0]?.product_name || 'No catalog sales'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {catalogAnalytics[0] ? `₹${catalogAnalytics[0].total_revenue.toFixed(2)} (${catalogAnalytics[0].total_quantity_sold} qty)` : '—'}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="stat-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
            Top Ad-Hoc Service
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--aurora-amber, #f59e0b)', margin: '6px 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {customAnalytics[0]?.product_name || 'No custom items'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {customAnalytics[0] ? `₹${customAnalytics[0].total_revenue.toFixed(2)} (${customAnalytics[0].total_quantity} qty)` : '—'}
          </div>
        </div>
      </div>

      {/* 3. Sub-tabs (Catalog vs Custom Ad-Hoc) & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeSubTab === 'catalog' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('catalog')}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Tag size={14} /> Catalog Products ({catalogAnalytics.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeSubTab === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveSubTab('custom')}
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Wrench size={14} /> Custom & Ad-Hoc Services ({customAnalytics.length})
          </button>
        </div>

        <div className="search-input-wrapper" style={{ minWidth: '220px', maxWidth: '320px' }}>
          <Search size={14} />
          <input
            type="text"
            className="form-input"
            placeholder={activeSubTab === 'catalog' ? 'Search catalog products...' : 'Search custom services...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', height: '34px', fontSize: '0.82rem' }}
          />
        </div>
      </div>

      {/* 4. Table Views */}
      {activeSubTab === 'catalog' ? (
        filteredCatalog.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No Catalog Sales Recorded"
            description={`No catalog products were billed in ${periodLabel}.`}
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Product / Code</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Catalog Price</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Units Sold</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Selling Rate</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Revenue</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Pricing Variance</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCatalog.map((prod, idx) => (
                    <tr
                      key={prod.product_id}
                      onClick={() => setSelectedProduct(prod)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="hover:bg-purple-950/20"
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{prod.product_name}</span>
                          {prod.product_code && (
                            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', fontFamily: 'monospace' }}>
                              {prod.product_code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {prod.category || 'General'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        ₹{prod.catalog_price.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--aurora-cyan, #00f0ff)', fontFamily: 'monospace' }}>
                        {prod.total_quantity_sold.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        ₹{prod.average_selling_rate.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                        ₹{prod.total_revenue.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {prod.has_price_variance ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              color: '#f59e0b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title={`Range: ₹${prod.min_rate.toFixed(2)} - ₹${prod.max_rate.toFixed(2)}`}
                          >
                            <AlertTriangle size={11} /> Variance Active
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Standard</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(prod);
                          }}
                          title="Drilldown Sales History"
                        >
                          <ChevronRight size={15} color="var(--aurora-cyan, #00f0ff)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        filteredCustom.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No Custom Items Recorded"
            description={`No ad-hoc or custom service items were billed in ${periodLabel}.`}
          />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Custom Service / Ad-Hoc Item</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Units Delivered</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Avg Rate Applied</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Rate Dynamics</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Realized Revenue</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '60px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustom.map((item, idx) => (
                    <tr
                      key={idx}
                      onClick={() => setSelectedCustomService(item)}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.product_name}</span>
                          <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            Ad-Hoc
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--aurora-cyan, #00f0ff)', fontFamily: 'monospace' }}>
                        {item.total_quantity.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        ₹{item.average_selling_rate.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ₹{item.min_rate.toFixed(2)} - ₹{item.max_rate.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                        ₹{item.total_revenue.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomService(item);
                          }}
                          title="Drilldown Service Usage"
                        >
                          <ChevronRight size={15} color="var(--aurora-cyan, #00f0ff)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 5. Drilldown Modals */}
      <ProductDrilldownModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        productData={selectedProduct}
        business={business}
        periodLabel={periodLabel}
        onInspectBill={onInspectBill}
      />

      <CustomServiceDrilldownModal
        isOpen={!!selectedCustomService}
        onClose={() => setSelectedCustomService(null)}
        serviceData={selectedCustomService}
        business={business}
        periodLabel={periodLabel}
        onInspectBill={onInspectBill}
      />
    </div>
  );
};
