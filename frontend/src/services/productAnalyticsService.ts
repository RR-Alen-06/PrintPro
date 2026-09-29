import { jsPDF } from 'jspdf';
import {
  ProductSalesAnalyticsData,
  CustomItemAnalyticsData,
  ProductTransactionHistory,
} from '../types/billing';
import { StatementService, StatementFilterRange } from './statementService';

export class ProductAnalyticsService {
  /**
   * Filters bills by date range based on filter key or custom range.
   */
  static filterBillsByRange(bills: any[], filter: string, customRange?: StatementFilterRange): any[] {
    const { start, end } = StatementService.getFilterBoundaries(filter, customRange);
    return (bills || []).filter((b) => {
      if (b.deleted || b.deleted_at || b.isGroupParent) return false;
      const dateStr = b.date || b.createdAt || b.created_at;
      if (!dateStr) return true;
      const bDate = new Date(dateStr);
      if (start && bDate < start) return false;
      if (end && bDate > end) return false;
      return true;
    });
  }

  /**
   * Analytics for a single catalog product.
   */
  static getProductSalesAnalytics({
    productId,
    filter = 'this_month',
    customRange,
    bills = [],
    products = [],
  }: {
    productId: string | number;
    filter?: string;
    customRange?: StatementFilterRange;
    bills?: any[];
    products?: any[];
  }): ProductSalesAnalyticsData | null {
    if (!productId) return null;

    const product = products.find((p) => String(p.id) === String(productId));
    const catalogPrice = Number(product?.price || product?.rate || product?.unitPrice || 0);
    const productName = product?.name || product?.itemName || `Product #${productId}`;
    const productCode = product?.code || product?.itemCode || product?.product_code || '';
    const category = product?.category || 'General';

    const filteredBills = this.filterBillsByRange(bills, filter, customRange);

    let totalQuantity = 0;
    let totalRevenue = 0;
    const uniqueBillIds = new Set<string>();
    const rates: number[] = [];
    const transactionHistory: ProductTransactionHistory[] = [];

    filteredBills.forEach((b) => {
      const items = b.items || [];
      const billId = String(b.id);
      const billNumber = b.bill_number || b.invoiceNumber || `BILL-${billId.slice(0, 6)}`;
      const createdAt = b.date || b.createdAt || b.created_at || new Date().toISOString();
      const customerId = b.customerId || b.customer_id;
      const customerName = b.customerName || b.customer_name || 'Walk-in Customer';

      items.forEach((item: any) => {
        const itemProdId = item.product_id || item.productId;
        const isMatch =
          String(itemProdId) === String(productId) ||
          (!itemProdId && item.name && item.name.trim().toLowerCase() === productName.trim().toLowerCase());

        if (isMatch) {
          const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 1));
          const price = Number(item.price !== undefined ? item.price : (item.unitPrice || item.rate || 0));
          const total = Number(item.total !== undefined ? item.total : (item.amount || qty * price));

          totalQuantity += qty;
          totalRevenue += total;
          uniqueBillIds.add(billId);
          rates.push(price);

          const isCustomRate = catalogPrice > 0 && Math.abs(price - catalogPrice) > 0.01;

          transactionHistory.push({
            bill_id: billId,
            bill_number: billNumber,
            created_at: createdAt,
            customer_id: customerId,
            customer_name: customerName,
            quantity: qty,
            price,
            total,
            catalog_price: catalogPrice,
            is_custom_rate: isCustomRate,
          });
        }
      });
    });

    transactionHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const minRate = rates.length > 0 ? Math.min(...rates) : catalogPrice;
    const maxRate = rates.length > 0 ? Math.max(...rates) : catalogPrice;
    const hasPriceVariance = rates.length > 1 ? minRate !== maxRate : (rates.length === 1 ? rates[0] !== catalogPrice : false);
    const avgSellingRate = totalQuantity > 0 ? totalRevenue / totalQuantity : catalogPrice;

    return {
      product_id: String(productId),
      product_code: productCode,
      product_name: productName,
      category,
      catalog_price: catalogPrice,
      total_quantity_sold: totalQuantity,
      total_revenue: totalRevenue,
      average_selling_rate: avgSellingRate,
      orders_count: uniqueBillIds.size,
      min_rate: minRate,
      max_rate: maxRate,
      has_price_variance: hasPriceVariance,
      transaction_history: transactionHistory,
    };
  }

  /**
   * Analytics across ALL catalog products for the selected date period.
   */
  static getAllCatalogProductsAnalytics({
    filter = 'this_month',
    customRange,
    bills = [],
    products = [],
  }: {
    filter?: string;
    customRange?: StatementFilterRange;
    bills?: any[];
    products?: any[];
  }): ProductSalesAnalyticsData[] {
    const analyticsList: ProductSalesAnalyticsData[] = [];
    const activeProducts = (products || []).filter((p) => !p.deleted && !p.deleted_at);

    activeProducts.forEach((p) => {
      const stats = this.getProductSalesAnalytics({
        productId: p.id,
        filter,
        customRange,
        bills,
        products,
      });
      if (stats) {
        analyticsList.push(stats);
      }
    });

    return analyticsList.sort((a, b) => b.total_revenue - a.total_revenue);
  }

  /**
   * Analytics for Custom / Ad-Hoc uncataloged services (where product_id is null / empty).
   */
  static getCustomItemsAnalytics({
    filter = 'this_month',
    customRange,
    bills = [],
    products = [],
  }: {
    filter?: string;
    customRange?: StatementFilterRange;
    bills?: any[];
    products?: any[];
  }): CustomItemAnalyticsData[] {
    const catalogProductNames = new Set(
      (products || []).map((p) => (p.name || p.itemName || '').trim().toLowerCase()).filter(Boolean)
    );

    const filteredBills = this.filterBillsByRange(bills, filter, customRange);
    const customMap = new Map<
      string,
      {
        product_name: string;
        total_quantity: number;
        total_revenue: number;
        rates: number[];
        uniqueBills: Set<string>;
        dates: string[];
        transactions: ProductTransactionHistory[];
      }
    >();

    filteredBills.forEach((b) => {
      const items = b.items || [];
      const billId = String(b.id);
      const billNumber = b.bill_number || b.invoiceNumber || `BILL-${billId.slice(0, 6)}`;
      const createdAt = b.date || b.createdAt || b.created_at || new Date().toISOString();
      const customerId = b.customerId || b.customer_id;
      const customerName = b.customerName || b.customer_name || 'Walk-in Customer';

      items.forEach((item: any) => {
        const itemProdId = item.product_id || item.productId;
        const rawName = (item.product_name || item.name || item.itemName || '').trim();
        if (!rawName) return;

        // Is custom item if no productId or not matched in catalog
        const isCustom = !itemProdId && !catalogProductNames.has(rawName.toLowerCase());

        if (isCustom) {
          const key = rawName.toLowerCase();
          const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 1));
          const price = Number(item.price !== undefined ? item.price : (item.unitPrice || item.rate || 0));
          const total = Number(item.total !== undefined ? item.total : (item.amount || qty * price));

          if (!customMap.has(key)) {
            customMap.set(key, {
              product_name: rawName,
              total_quantity: 0,
              total_revenue: 0,
              rates: [],
              uniqueBills: new Set<string>(),
              dates: [],
              transactions: [],
            });
          }

          const entry = customMap.get(key)!;
          entry.total_quantity += qty;
          entry.total_revenue += total;
          entry.rates.push(price);
          entry.uniqueBills.add(billId);
          entry.dates.push(createdAt);
          entry.transactions.push({
            bill_id: billId,
            bill_number: billNumber,
            created_at: createdAt,
            customer_id: customerId,
            customer_name: customerName,
            quantity: qty,
            price,
            total,
            catalog_price: price,
            is_custom_rate: true,
          });
        }
      });
    });

    const results: CustomItemAnalyticsData[] = Array.from(customMap.values()).map((entry) => {
      const minRate = entry.rates.length > 0 ? Math.min(...entry.rates) : 0;
      const maxRate = entry.rates.length > 0 ? Math.max(...entry.rates) : 0;
      const isDynamic = minRate !== maxRate;
      const avgRate = entry.total_quantity > 0 ? entry.total_revenue / entry.total_quantity : 0;

      entry.dates.sort();
      const firstUsed = entry.dates.length > 0 ? entry.dates[0] : '';
      const lastUsed = entry.dates.length > 0 ? entry.dates[entry.dates.length - 1] : '';

      entry.transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        product_name: entry.product_name,
        total_quantity: entry.total_quantity,
        total_revenue: entry.total_revenue,
        average_selling_rate: avgRate,
        min_rate: minRate,
        max_rate: maxRate,
        is_dynamic_rate: isDynamic,
        orders_count: entry.uniqueBills.size,
        first_used_at: firstUsed,
        last_used_at: lastUsed,
        transaction_history: entry.transactions,
      };
    });

    return results.sort((a, b) => b.total_revenue - a.total_revenue);
  }

  /**
   * Generates single product sales intelligence PDF document.
   */
  static generateProductSalesPDF(
    productData: ProductSalesAnalyticsData,
    business: any = {},
    periodLabel: string = 'Current Period',
    currency: string = 'Rs.'
  ): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 12;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let currentY = 14;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(business?.shopName || 'PrintPro Digital Print Studio', MARGIN, currentY);

    doc.setFontSize(12);
    doc.text('PRODUCT SALES INTELLIGENCE REPORT', PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${periodLabel}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(40, 40, 40);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 6;

    // Product Details & KPI Box
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, 28, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(productData.product_name, MARGIN + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Category: ${productData.category || 'General'} | Product Code: ${productData.product_code || 'N/A'}`, MARGIN + 4, currentY + 11);
    doc.text(`Catalog Standard Price: ${currency} ${productData.catalog_price.toFixed(2)}`, MARGIN + 4, currentY + 16);

    const priceVarText = productData.has_price_variance
      ? `Rate Variance: ${currency} ${productData.min_rate.toFixed(2)} - ${currency} ${productData.max_rate.toFixed(2)} (Dynamic)`
      : `Rate Variance: Consistent standard pricing`;
    doc.text(priceVarText, MARGIN + 4, currentY + 21);

    // Right Summary in Box
    const rightCol = MARGIN + CONTENT_W / 2 + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text('PERFORMANCE METRICS', rightCol, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Total Units Sold: ${productData.total_quantity_sold}`, rightCol, currentY + 11);
    doc.text(`Total Realized Revenue: ${currency} ${productData.total_revenue.toFixed(2)}`, rightCol, currentY + 16);
    doc.text(`Weighted Avg Rate: ${currency} ${productData.average_selling_rate.toFixed(2)}`, rightCol, currentY + 21);
    doc.text(`Order Frequency: ${productData.orders_count} Invoices`, rightCol, currentY + 25.5);

    currentY += 34;

    // Transaction Drilldown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('HISTORICAL SALES & TRANSACTION DRILLDOWN', MARGIN, currentY);
    currentY += 5;

    // Table Header
    doc.setFillColor(235, 238, 242);
    doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text('DATE', MARGIN + 3, currentY + 4);
    doc.text('INVOICE #', MARGIN + 30, currentY + 4);
    doc.text('CUSTOMER NAME', MARGIN + 62, currentY + 4);
    doc.text('QTY', MARGIN + 120, currentY + 4, { align: 'right' });
    doc.text('RATE APPLIED', MARGIN + 150, currentY + 4, { align: 'right' });
    doc.text('TOTAL', PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);

    if (productData.transaction_history.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('No sales records found for this product in the selected period.', MARGIN + 3, currentY + 6);
    } else {
      productData.transaction_history.forEach((tx) => {
        if (currentY > PAGE_H - 20) {
          doc.addPage();
          currentY = 14;
        }

        const dateStr = tx.created_at ? tx.created_at.slice(0, 10) : '';
        const rateDisplay = `${currency} ${tx.price.toFixed(2)}${tx.is_custom_rate ? '*' : ''}`;

        doc.text(dateStr, MARGIN + 3, currentY + 4);
        doc.text(tx.bill_number, MARGIN + 30, currentY + 4);
        doc.text(tx.customer_name.slice(0, 28), MARGIN + 62, currentY + 4);
        doc.text(String(tx.quantity), MARGIN + 120, currentY + 4, { align: 'right' });
        doc.text(rateDisplay, MARGIN + 150, currentY + 4, { align: 'right' });
        doc.text(`${currency} ${tx.total.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    return doc;
  }
}
