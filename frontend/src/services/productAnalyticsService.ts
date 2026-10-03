import { jsPDF } from 'jspdf';
import {
  ProductSalesAnalyticsData,
  CustomItemAnalyticsData,
  ProductTransactionHistory,
  PrintVariantAnalyticsData,
  PrintVariantItemBreakdown,
} from '../types/billing';
import { StatementService, StatementFilterRange } from './statementService';

export interface VariantClassification {
  variantKey: string;
  variantLabel: string;
  paperSize: string;
  printType: 'Color' | 'B/W' | 'N/A';
  sides: 'Single-Side' | 'Double-Side' | 'N/A';
}

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
   * Classifies any line item into its standardized print variant.
   */
  static classifyItemVariant(item: any): VariantClassification {
    const name = (item.product_name || item.name || item.itemName || '').trim();
    const lower = name.toLowerCase();
    const itemPrintType = String(item.printType || item.print_type || '').toLowerCase();
    const itemSides = String(item.sides || item.side || '').toLowerCase();
    const itemSize = String(item.paperSize || item.paper_size || item.size || '').toLowerCase();

    // 1. Check Binding & Finishing
    if (/(spiral|wiro|hardcover|softcover|lamination|laminate|binding|staple|stapling|creasing|cutting)/i.test(lower)) {
      return {
        variantKey: 'binding_finishing',
        variantLabel: 'Binding & Finishing',
        paperSize: 'N/A',
        printType: 'N/A',
        sides: 'N/A',
      };
    }

    // 2. Paper Size detection
    let paperSize = 'A4';
    if (itemSize.includes('a3') || /\ba3\b/i.test(lower)) {
      paperSize = 'A3';
    } else if (itemSize.includes('legal') || /\blegal\b/i.test(lower)) {
      paperSize = 'Legal';
    } else if (itemSize.includes('a4') || /\ba4\b/i.test(lower)) {
      paperSize = 'A4';
    } else if (/\b(12x18|13x19|poster|banner|vinyl|flex|canvas)\b/i.test(lower)) {
      paperSize = 'Large / Poster';
    } else if (item.isCustom || (!item.product_id && !item.productId && /(design|typing|scan|photo|pvc|card|service|editing|dtp)/i.test(lower))) {
      paperSize = 'Custom / Service';
    }

    // 3. Print Type detection
    let printType: 'Color' | 'B/W' | 'N/A' = 'B/W';
    if (
      itemPrintType === 'color' ||
      itemPrintType === 'colour' ||
      itemPrintType === 'cmyk' ||
      /\b(color|colour|cmyk|multicolor|photo|multicolour)\b/i.test(lower)
    ) {
      printType = 'Color';
    } else if (
      itemPrintType === 'bw' ||
      itemPrintType === 'b&w' ||
      itemPrintType === 'black & white' ||
      /\b(b\/w|b&w|black\s*(?:&|and)?\s*white|mono|monochrome|xerox|copy)\b/i.test(lower)
    ) {
      printType = 'B/W';
    }

    // 4. Sides detection
    let sides: 'Single-Side' | 'Double-Side' | 'N/A' = 'Single-Side';
    if (
      itemSides === 'double' ||
      itemSides === '2' ||
      itemSides === 'duplex' ||
      itemSides === 'b2b' ||
      /\b(double|back\s*to\s*back|b2b|both\s*sides?|2\s*sides?|duplex)\b/i.test(lower)
    ) {
      sides = 'Double-Side';
    } else if (
      itemSides === 'single' ||
      itemSides === '1' ||
      itemSides === 'simplex' ||
      /\b(single|1\s*side|front\s*only|simplex)\b/i.test(lower)
    ) {
      sides = 'Single-Side';
    }

    if (paperSize === 'A4') {
      if (printType === 'Color') {
        return sides === 'Double-Side'
          ? { variantKey: 'a4_color_double', variantLabel: 'A4 Color Double-Side', paperSize: 'A4', printType: 'Color', sides: 'Double-Side' }
          : { variantKey: 'a4_color_single', variantLabel: 'A4 Color Single-Side', paperSize: 'A4', printType: 'Color', sides: 'Single-Side' };
      } else {
        return sides === 'Double-Side'
          ? { variantKey: 'a4_bw_double', variantLabel: 'A4 B/W Double-Side', paperSize: 'A4', printType: 'B/W', sides: 'Double-Side' }
          : { variantKey: 'a4_bw_single', variantLabel: 'A4 B/W Single-Side', paperSize: 'A4', printType: 'B/W', sides: 'Single-Side' };
      }
    }

    if (paperSize === 'A3') {
      if (printType === 'Color') {
        return sides === 'Double-Side'
          ? { variantKey: 'a3_color_double', variantLabel: 'A3 Color Double-Side', paperSize: 'A3', printType: 'Color', sides: 'Double-Side' }
          : { variantKey: 'a3_color_single', variantLabel: 'A3 Color Single-Side', paperSize: 'A3', printType: 'Color', sides: 'Single-Side' };
      } else {
        return sides === 'Double-Side'
          ? { variantKey: 'a3_bw_double', variantLabel: 'A3 B/W Double-Side', paperSize: 'A3', printType: 'B/W', sides: 'Double-Side' }
          : { variantKey: 'a3_bw_single', variantLabel: 'A3 B/W Single-Side', paperSize: 'A3', printType: 'B/W', sides: 'Single-Side' };
      }
    }

    if (paperSize === 'Legal') {
      return printType === 'Color'
        ? { variantKey: 'legal_color', variantLabel: 'Legal Color Print', paperSize: 'Legal', printType: 'Color', sides }
        : { variantKey: 'legal_bw', variantLabel: 'Legal B/W Print', paperSize: 'Legal', printType: 'B/W', sides };
    }

    if (paperSize === 'Custom / Service') {
      return {
        variantKey: 'custom_services',
        variantLabel: 'Custom & Specialty Services',
        paperSize: 'Custom',
        printType: 'N/A',
        sides: 'N/A',
      };
    }

    return {
      variantKey: `${printType.toLowerCase()}_other`,
      variantLabel: `Other ${printType} Prints / Media`,
      paperSize: paperSize,
      printType: printType,
      sides: sides,
    };
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
      if (stats && (stats.total_quantity_sold > 0 || stats.orders_count > 0)) {
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
   * Analytics grouped by standard Print Variants (A4 Single/Double Color, A4 Single/Double B/W, A3, Binding, etc.)
   */
  static getPrintVariantsAnalytics({
    filter = 'this_month',
    customRange,
    bills = [],
    products = [],
  }: {
    filter?: string;
    customRange?: StatementFilterRange;
    bills?: any[];
    products?: any[];
  }): PrintVariantAnalyticsData[] {
    const filteredBills = this.filterBillsByRange(bills, filter, customRange);
    const variantMap = new Map<
      string,
      {
        variant_key: string;
        variant_label: string;
        paper_size: string;
        print_type: string;
        sides: string;
        total_quantity: number;
        total_revenue: number;
        rates: number[];
        uniqueBills: Set<string>;
        itemsMap: Map<string, { quantity: number; revenue: number }>;
        transactions: ProductTransactionHistory[];
      }
    >();

    // Pre-seed standard print variant keys in priority order so they always appear cleanly in reports
    const standardKeys: Array<{ key: string; label: string; size: string; type: string; sides: string }> = [
      { key: 'a4_color_single', label: 'A4 Color Single-Side', size: 'A4', type: 'Color', sides: 'Single-Side' },
      { key: 'a4_color_double', label: 'A4 Color Double-Side', size: 'A4', type: 'Color', sides: 'Double-Side' },
      { key: 'a4_bw_single', label: 'A4 B/W Single-Side', size: 'A4', type: 'B/W', sides: 'Single-Side' },
      { key: 'a4_bw_double', label: 'A4 B/W Double-Side', size: 'A4', type: 'B/W', sides: 'Double-Side' },
      { key: 'a3_color_single', label: 'A3 Color Single-Side', size: 'A3', type: 'Color', sides: 'Single-Side' },
      { key: 'a3_color_double', label: 'A3 Color Double-Side', size: 'A3', type: 'Color', sides: 'Double-Side' },
      { key: 'a3_bw_single', label: 'A3 B/W Single-Side', size: 'A3', type: 'B/W', sides: 'Single-Side' },
      { key: 'a3_bw_double', label: 'A3 B/W Double-Side', size: 'A3', type: 'B/W', sides: 'Double-Side' },
      { key: 'legal_color', label: 'Legal Color Print', size: 'Legal', type: 'Color', sides: 'Single-Side' },
      { key: 'legal_bw', label: 'Legal B/W Print', size: 'Legal', type: 'B/W', sides: 'Single-Side' },
      { key: 'binding_finishing', label: 'Binding & Finishing', size: 'Finishing', type: 'N/A', sides: 'N/A' },
      { key: 'custom_services', label: 'Custom & Specialty Services', size: 'Custom', type: 'N/A', sides: 'N/A' },
    ];

    standardKeys.forEach((k) => {
      variantMap.set(k.key, {
        variant_key: k.key,
        variant_label: k.label,
        paper_size: k.size,
        print_type: k.type,
        sides: k.sides,
        total_quantity: 0,
        total_revenue: 0,
        rates: [],
        uniqueBills: new Set<string>(),
        itemsMap: new Map(),
        transactions: [],
      });
    });

    filteredBills.forEach((b) => {
      const items = b.items || [];
      const billId = String(b.id);
      const billNumber = b.bill_number || b.invoiceNumber || `BILL-${billId.slice(0, 6)}`;
      const createdAt = b.date || b.createdAt || b.created_at || new Date().toISOString();
      const customerId = b.customerId || b.customer_id;
      const customerName = b.customerName || b.customer_name || 'Walk-in Customer';

      items.forEach((item: any) => {
        const classification = this.classifyItemVariant(item);
        const vKey = classification.variantKey;

        if (!variantMap.has(vKey)) {
          variantMap.set(vKey, {
            variant_key: vKey,
            variant_label: classification.variantLabel,
            paper_size: classification.paperSize,
            print_type: classification.printType,
            sides: classification.sides,
            total_quantity: 0,
            total_revenue: 0,
            rates: [],
            uniqueBills: new Set<string>(),
            itemsMap: new Map(),
            transactions: [],
          });
        }

        const variant = variantMap.get(vKey)!;
        const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 1));
        const price = Number(item.price !== undefined ? item.price : (item.unitPrice || item.rate || 0));
        const total = Number(item.total !== undefined ? item.total : (item.amount || qty * price));
        const itemName = (item.product_name || item.name || item.itemName || 'Custom Item').trim();

        variant.total_quantity += qty;
        variant.total_revenue += total;
        if (price > 0) variant.rates.push(price);
        variant.uniqueBills.add(billId);

        if (!variant.itemsMap.has(itemName)) {
          variant.itemsMap.set(itemName, { quantity: 0, revenue: 0 });
        }
        const itemStats = variant.itemsMap.get(itemName)!;
        itemStats.quantity += qty;
        itemStats.revenue += total;

        variant.transactions.push({
          bill_id: billId,
          bill_number: billNumber,
          created_at: createdAt,
          customer_id: customerId,
          customer_name: customerName,
          quantity: qty,
          price,
          total,
          catalog_price: price,
          is_custom_rate: false,
        });
      });
    });

    const results: PrintVariantAnalyticsData[] = Array.from(variantMap.values()).map((v) => {
      const minRate = v.rates.length > 0 ? Math.min(...v.rates) : 0;
      const maxRate = v.rates.length > 0 ? Math.max(...v.rates) : 0;
      const avgRate = v.total_quantity > 0 ? v.total_revenue / v.total_quantity : 0;

      const itemBreakdown: PrintVariantItemBreakdown[] = Array.from(v.itemsMap.entries()).map(
        ([name, stats]) => ({
          name,
          quantity: stats.quantity,
          revenue: stats.revenue,
          avg_rate: stats.quantity > 0 ? stats.revenue / stats.quantity : 0,
        })
      ).sort((a, b) => b.revenue - a.revenue);

      v.transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return {
        variant_key: v.variant_key,
        variant_label: v.variant_label,
        paper_size: v.paper_size,
        print_type: v.print_type,
        sides: v.sides,
        total_quantity: v.total_quantity,
        total_revenue: v.total_revenue,
        average_rate: avgRate,
        min_rate: minRate,
        max_rate: maxRate,
        orders_count: v.uniqueBills.size,
        item_breakdown: itemBreakdown,
        transaction_history: v.transactions,
      };
    });

    // Return variants with sales first, or retain active standard groups
    return results.sort((a, b) => {
      if (b.total_revenue !== a.total_revenue) {
        return b.total_revenue - a.total_revenue;
      }
      return b.total_quantity - a.total_quantity;
    });
  }

  /**
   * Generates single product sales intelligence PDF document.
   */
  static generateProductSalesPDF(
    productData: ProductSalesAnalyticsData,
    business: any = {},
    periodLabel: string = 'Current Period',
    currency: string = '₹'
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
    doc.setTextColor(20, 20, 20);
    doc.text(business?.shopName || 'PrintPro Digital Print Studio', MARGIN, currentY);

    doc.setFontSize(11);
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

  /**
   * Generates single custom service analytics PDF document.
   */
  static generateCustomItemSalesPDF(
    customData: CustomItemAnalyticsData,
    business: any = {},
    periodLabel: string = 'Current Period',
    currency: string = '₹'
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
    doc.setTextColor(20, 20, 20);
    doc.text(business?.shopName || 'PrintPro Digital Print Studio', MARGIN, currentY);

    doc.setFontSize(11);
    doc.text('CUSTOM SERVICE SALES REPORT', PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${periodLabel}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(40, 40, 40);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 6;

    // Custom Item KPI Box
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, 26, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(customData.product_name, MARGIN + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Type: Ad-Hoc / Custom Service | Dynamic Rate: ${customData.is_dynamic_rate ? 'Yes' : 'Fixed'}`, MARGIN + 4, currentY + 11);
    doc.text(`Rate Range: ${currency} ${customData.min_rate.toFixed(2)} - ${currency} ${customData.max_rate.toFixed(2)}`, MARGIN + 4, currentY + 16);
    doc.text(`Average Selling Rate: ${currency} ${customData.average_selling_rate.toFixed(2)}`, MARGIN + 4, currentY + 21);

    // Right Summary in Box
    const rightCol = MARGIN + CONTENT_W / 2 + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text('PERFORMANCE METRICS', rightCol, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Total Quantity Sold: ${customData.total_quantity}`, rightCol, currentY + 11);
    doc.text(`Total Revenue: ${currency} ${customData.total_revenue.toFixed(2)}`, rightCol, currentY + 16);
    doc.text(`Total Invoices: ${customData.orders_count}`, rightCol, currentY + 21);

    currentY += 32;

    // Transaction Drilldown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text('CUSTOM ITEM TRANSACTION HISTORY', MARGIN, currentY);
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

    if (customData.transaction_history.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('No sales records found for this custom service in the selected period.', MARGIN + 3, currentY + 6);
    } else {
      customData.transaction_history.forEach((tx) => {
        if (currentY > PAGE_H - 20) {
          doc.addPage();
          currentY = 14;
        }

        const dateStr = tx.created_at ? tx.created_at.slice(0, 10) : '';

        doc.text(dateStr, MARGIN + 3, currentY + 4);
        doc.text(tx.bill_number, MARGIN + 30, currentY + 4);
        doc.text(tx.customer_name.slice(0, 28), MARGIN + 62, currentY + 4);
        doc.text(String(tx.quantity), MARGIN + 120, currentY + 4, { align: 'right' });
        doc.text(`${currency} ${tx.price.toFixed(2)}`, MARGIN + 150, currentY + 4, { align: 'right' });
        doc.text(`${currency} ${tx.total.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 4, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    return doc;
  }

  /**
   * Generates single variant drilldown PDF document.
   */
  static generateVariantSalesPDF(
    variantData: PrintVariantAnalyticsData,
    business: any = {},
    periodLabel: string = 'Current Period',
    currency: string = '₹'
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
    doc.setTextColor(20, 20, 20);
    doc.text(business?.shopName || 'PrintPro Digital Print Studio', MARGIN, currentY);

    doc.setFontSize(11);
    doc.text('PRINT VARIANT SALES REPORT', PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`Period: ${periodLabel}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(40, 40, 40);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 6;

    // Variant KPI Box
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(MARGIN, currentY, CONTENT_W, 26, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(variantData.variant_label, MARGIN + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Paper Size: ${variantData.paper_size || 'Standard'} | Type: ${variantData.print_type || 'General'} | Sides: ${variantData.sides || 'Single'}`, MARGIN + 4, currentY + 11);
    doc.text(`Rate Range: ${currency} ${variantData.min_rate.toFixed(2)} - ${currency} ${variantData.max_rate.toFixed(2)}`, MARGIN + 4, currentY + 16);
    doc.text(`Average Selling Rate: ${currency} ${variantData.average_rate.toFixed(2)}`, MARGIN + 4, currentY + 21);

    // Right Summary in Box
    const rightCol = MARGIN + CONTENT_W / 2 + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text('PERFORMANCE METRICS', rightCol, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Total Prints / Qty Sold: ${variantData.total_quantity}`, rightCol, currentY + 11);
    doc.text(`Total Realized Revenue: ${currency} ${variantData.total_revenue.toFixed(2)}`, rightCol, currentY + 16);
    doc.text(`Total Invoices: ${variantData.orders_count}`, rightCol, currentY + 21);

    currentY += 32;

    // Item Contributing Breakdown Table
    if (variantData.item_breakdown && variantData.item_breakdown.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text('CONTRIBUTING PRODUCTS & SERVICES', MARGIN, currentY);
      currentY += 4;

      doc.setFillColor(235, 238, 242);
      doc.rect(MARGIN, currentY, CONTENT_W, 5.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(40, 40, 40);
      doc.text('PRODUCT / SERVICE NAME', MARGIN + 3, currentY + 3.8);
      doc.text('QTY SOLD', MARGIN + 110, currentY + 3.8, { align: 'right' });
      doc.text('AVG RATE', MARGIN + 145, currentY + 3.8, { align: 'right' });
      doc.text('REVENUE', PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });
      currentY += 5.5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 30, 30);

      variantData.item_breakdown.forEach((ib) => {
        doc.text(ib.name.slice(0, 45), MARGIN + 3, currentY + 3.8);
        doc.text(String(ib.quantity), MARGIN + 110, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${ib.avg_rate.toFixed(2)}`, MARGIN + 145, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${ib.revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5, PAGE_W - MARGIN, currentY + 5);
        currentY += 5;
      });

      currentY += 5;
    }

    // Transaction Drilldown Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(20, 20, 20);
    doc.text('TRANSACTION HISTORY', MARGIN, currentY);
    currentY += 4;

    // Table Header
    doc.setFillColor(235, 238, 242);
    doc.rect(MARGIN, currentY, CONTENT_W, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    doc.text('DATE', MARGIN + 3, currentY + 3.8);
    doc.text('INVOICE #', MARGIN + 30, currentY + 3.8);
    doc.text('CUSTOMER NAME', MARGIN + 62, currentY + 3.8);
    doc.text('QTY', MARGIN + 120, currentY + 3.8, { align: 'right' });
    doc.text('RATE', MARGIN + 150, currentY + 3.8, { align: 'right' });
    doc.text('TOTAL', PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });
    currentY += 5.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);

    if (variantData.transaction_history.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.text('No sales records found for this variant in the selected period.', MARGIN + 3, currentY + 5);
    } else {
      variantData.transaction_history.forEach((tx) => {
        if (currentY > PAGE_H - 18) {
          doc.addPage();
          currentY = 14;
        }

        const dateStr = tx.created_at ? tx.created_at.slice(0, 10) : '';

        doc.text(dateStr, MARGIN + 3, currentY + 3.8);
        doc.text(tx.bill_number, MARGIN + 30, currentY + 3.8);
        doc.text(tx.customer_name.slice(0, 28), MARGIN + 62, currentY + 3.8);
        doc.text(String(tx.quantity), MARGIN + 120, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${tx.price.toFixed(2)}`, MARGIN + 150, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${tx.total.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });

        doc.setDrawColor(240, 240, 240);
        doc.line(MARGIN, currentY + 5, PAGE_W - MARGIN, currentY + 5);
        currentY += 5;
      });
    }

    return doc;
  }

  /**
   * Generates the Comprehensive Master Item Sales & Print Variant Intelligence Report PDF.
   */
  static generateComprehensiveItemSalesReportPDF({
    catalogData = [],
    customData = [],
    variantData = [],
    business = {},
    periodLabel = 'Selected Period',
    currency = '₹',
  }: {
    catalogData?: ProductSalesAnalyticsData[];
    customData?: CustomItemAnalyticsData[];
    variantData?: PrintVariantAnalyticsData[];
    business?: any;
    periodLabel?: string;
    currency?: string;
  }): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 12;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let currentY = 14;

    // Totals calculations
    const totalCatalogQty = catalogData.reduce((sum, c) => sum + c.total_quantity_sold, 0);
    const totalCatalogRev = catalogData.reduce((sum, c) => sum + c.total_revenue, 0);

    const totalCustomQty = customData.reduce((sum, c) => sum + c.total_quantity, 0);
    const totalCustomRev = customData.reduce((sum, c) => sum + c.total_revenue, 0);

    const grandTotalQty = totalCatalogQty + totalCustomQty;
    const grandTotalRev = totalCatalogRev + totalCustomRev;
    const activeVariants = variantData.filter((v) => v.total_quantity > 0 || v.total_revenue > 0);
    const topVariant = activeVariants.length > 0 ? activeVariants[0] : null;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(business?.shopName || 'PrintPro Digital Print Studio', MARGIN, currentY);

    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('ITEM SALES & PRINT VARIANT REPORT', PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(80, 80, 80);
    doc.text(business?.address || 'Printing & Reproduction Services', MARGIN, currentY);
    doc.text(`Report Period: ${periodLabel}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 4.5;

    doc.text(`Phone: ${business?.phone || 'N/A'}${business?.gstin ? ` | GSTIN: ${business.gstin}` : ''}`, MARGIN, currentY);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, PAGE_W - MARGIN, currentY, { align: 'right' });
    currentY += 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
    currentY += 5;

    // 4 KPI Summary Cards
    const cardW = (CONTENT_W - 9) / 4;
    const cardH = 17;

    const renderKpiCard = (x: number, title: string, value: string, sub: string, bgColor: number[]) => {
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.setDrawColor(220, 225, 230);
      doc.roundedRect(x, currentY, cardW, cardH, 1.2, 1.2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(90, 100, 115);
      doc.text(title.toUpperCase(), x + 3, currentY + 4);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(value, x + 3, currentY + 10.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(sub, x + 3, currentY + 14.5);
    };

    renderKpiCard(MARGIN, 'Total Units Sold', `${grandTotalQty.toLocaleString('en-IN')}`, 'Across all items', [245, 247, 250]);
    renderKpiCard(MARGIN + cardW + 3, 'Total Revenue', `${currency} ${grandTotalRev.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Realized billings', [236, 253, 245]);
    renderKpiCard(MARGIN + (cardW + 3) * 2, 'Average Unit Rate', `${currency} ${grandTotalQty > 0 ? (grandTotalRev / grandTotalQty).toFixed(2) : '0.00'}`, 'Weighted average', [240, 249, 255]);
    renderKpiCard(
      MARGIN + (cardW + 3) * 3,
      'Top Print Variant',
      topVariant ? `${topVariant.variant_label.slice(0, 16)}` : 'N/A',
      topVariant ? `${currency} ${topVariant.total_revenue.toFixed(0)} (${topVariant.total_quantity} qty)` : 'No sales in period',
      [254, 243, 199]
    );

    currentY += cardH + 7;

    // Helper for table page break check
    const checkPageBreak = (neededSpace: number = 15) => {
      if (currentY + neededSpace > PAGE_H - 15) {
        doc.addPage();
        currentY = 14;
        return true;
      }
      return false;
    };

    // SECTION 1: PRINT VARIANT PERFORMANCE MATRIX (A4 Color Single/Double, B/W Single/Double, etc.)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('1. PRINT VARIANT PERFORMANCE MATRIX (SIZE / COLOR / SIDES)', MARGIN, currentY);
    currentY += 4.5;

    // Variant Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('PRINT CONFIGURATION / VARIANT', MARGIN + 3, currentY + 4.2);
    doc.text('SIZE & SIDES', MARGIN + 70, currentY + 4.2);
    doc.text('VOLUME (QTY)', MARGIN + 110, currentY + 4.2, { align: 'right' });
    doc.text('RATE RANGE', MARGIN + 138, currentY + 4.2, { align: 'right' });
    doc.text('AVG RATE', MARGIN + 160, currentY + 4.2, { align: 'right' });
    doc.text('TOTAL REVENUE', PAGE_W - MARGIN - 3, currentY + 4.2, { align: 'right' });
    currentY += 6;

    if (activeVariants.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No print variant activity recorded in this period.', MARGIN + 3, currentY + 4.5);
      currentY += 7;
    } else {
      activeVariants.forEach((v, idx) => {
        checkPageBreak(7);

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(MARGIN, currentY, CONTENT_W, 5.5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(v.variant_label, MARGIN + 3, currentY + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const formatDetails = `${v.paper_size || ''} ${v.sides && v.sides !== 'N/A' ? `• ${v.sides}` : ''}`.trim();
        doc.text(formatDetails, MARGIN + 70, currentY + 3.8);

        doc.text(`${v.total_quantity.toLocaleString('en-IN')}`, MARGIN + 110, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${v.min_rate.toFixed(0)}-${v.max_rate.toFixed(0)}`, MARGIN + 138, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${v.average_rate.toFixed(2)}`, MARGIN + 160, currentY + 3.8, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${currency} ${v.total_revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });

        doc.setDrawColor(241, 245, 249);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    currentY += 5;

    // SECTION 2: CATALOG PRODUCTS BREAKDOWN
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`2. CATALOG INVENTORY & PRODUCT SALES (${catalogData.length} Items)`, MARGIN, currentY);
    currentY += 4.5;

    doc.setFillColor(71, 85, 105);
    doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('PRODUCT NAME', MARGIN + 3, currentY + 4.2);
    doc.text('CATEGORY', MARGIN + 75, currentY + 4.2);
    doc.text('QTY SOLD', MARGIN + 115, currentY + 4.2, { align: 'right' });
    doc.text('CATALOG PRICE', MARGIN + 142, currentY + 4.2, { align: 'right' });
    doc.text('AVG RATE', MARGIN + 162, currentY + 4.2, { align: 'right' });
    doc.text('REVENUE', PAGE_W - MARGIN - 3, currentY + 4.2, { align: 'right' });
    currentY += 6;

    if (catalogData.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No catalog products sold in this period.', MARGIN + 3, currentY + 4.5);
      currentY += 7;
    } else {
      catalogData.forEach((p, idx) => {
        checkPageBreak(7);

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(MARGIN, currentY, CONTENT_W, 5.5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(p.product_name.slice(0, 36), MARGIN + 3, currentY + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text((p.category || 'General').slice(0, 18), MARGIN + 75, currentY + 3.8);
        doc.text(`${p.total_quantity_sold}`, MARGIN + 115, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${p.catalog_price.toFixed(2)}`, MARGIN + 142, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${p.average_selling_rate.toFixed(2)}`, MARGIN + 162, currentY + 3.8, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${currency} ${p.total_revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });

        doc.setDrawColor(241, 245, 249);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    currentY += 5;

    // SECTION 3: CUSTOM / AD-HOC SERVICES BREAKDOWN
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`3. CUSTOM & AD-HOC SERVICES (${customData.length} Services)`, MARGIN, currentY);
    currentY += 4.5;

    doc.setFillColor(100, 116, 139);
    doc.rect(MARGIN, currentY, CONTENT_W, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CUSTOM SERVICE / AD-HOC ITEM', MARGIN + 3, currentY + 4.2);
    doc.text('FREQUENCY', MARGIN + 85, currentY + 4.2);
    doc.text('QTY SOLD', MARGIN + 115, currentY + 4.2, { align: 'right' });
    doc.text('RATE RANGE', MARGIN + 142, currentY + 4.2, { align: 'right' });
    doc.text('AVG RATE', MARGIN + 162, currentY + 4.2, { align: 'right' });
    doc.text('REVENUE', PAGE_W - MARGIN - 3, currentY + 4.2, { align: 'right' });
    currentY += 6;

    if (customData.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No custom or ad-hoc services billed in this period.', MARGIN + 3, currentY + 4.5);
      currentY += 7;
    } else {
      customData.forEach((c, idx) => {
        checkPageBreak(7);

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.setFillColor(248, 250, 252);
          doc.rect(MARGIN, currentY, CONTENT_W, 5.5, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(c.product_name.slice(0, 42), MARGIN + 3, currentY + 3.8);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`${c.orders_count} Invoices`, MARGIN + 85, currentY + 3.8);
        doc.text(`${c.total_quantity}`, MARGIN + 115, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${c.min_rate.toFixed(0)}-${c.max_rate.toFixed(0)}`, MARGIN + 142, currentY + 3.8, { align: 'right' });
        doc.text(`${currency} ${c.average_selling_rate.toFixed(2)}`, MARGIN + 162, currentY + 3.8, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${currency} ${c.total_revenue.toFixed(2)}`, PAGE_W - MARGIN - 3, currentY + 3.8, { align: 'right' });

        doc.setDrawColor(241, 245, 249);
        doc.line(MARGIN, currentY + 5.5, PAGE_W - MARGIN, currentY + 5.5);
        currentY += 5.5;
      });
    }

    // Footers across all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);

      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);

      doc.text('PrintPro Digital Print Studio Management Suite • Confidential Business Report', MARGIN, PAGE_H - 6.5);
      doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 6.5, { align: 'right' });
    }

    return doc;
  }
}
