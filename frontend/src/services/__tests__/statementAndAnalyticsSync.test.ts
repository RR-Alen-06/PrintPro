import { describe, it, expect } from 'vitest';
import { StatementService } from '../statementService';
import { ProductAnalyticsService } from '../productAnalyticsService';

describe('Consolidated Statement & Product Analytics Suite', () => {
  const mockCustomers = [
    {
      id: 'cust-1',
      name: 'Acme Corp',
      customerCode: 'CUST-001',
      mobile: '9876543210',
      type: 'regular',
      advanceBalance: 500,
      balanceDue: 350,
    },
  ];

  const mockProducts = [
    {
      id: 'prod-1',
      code: 'PRNT-A4',
      name: 'A4 Color Print',
      category: 'Printing',
      price: 10.0,
    },
    {
      id: 'prod-2',
      code: 'LAM-A4',
      name: 'A4 Lamination',
      category: 'Finishing',
      price: 25.0,
    },
  ];

  const mockBills = [
    {
      id: 'bill-101',
      bill_number: 'INV-2026-001',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      date: '2026-09-10T10:00:00.000Z',
      subtotal: 100,
      discount: 10,
      tax_amount: 5,
      total: 95,
      paidTotal: 95,
      balance: 0,
      status: 'paid',
      items: [
        {
          productId: 'prod-1',
          name: 'A4 Color Print',
          qty: 10,
          unitPrice: 10,
          amount: 100,
        },
      ],
    },
    {
      id: 'bill-102',
      bill_number: 'INV-2026-002',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      date: '2026-09-15T14:30:00.000Z',
      subtotal: 350,
      discount: 0,
      tax_amount: 0,
      total: 350,
      paidTotal: 0,
      balance: 350,
      status: 'unpaid',
      items: [
        {
          productId: 'prod-1',
          name: 'A4 Color Print',
          qty: 15,
          unitPrice: 10,
          amount: 150,
        },
        {
          productId: 'prod-2',
          name: 'A4 Lamination',
          qty: 4,
          unitPrice: 25,
          amount: 100,
        },
        {
          product_id: null,
          name: 'Custom Graphic Design Service',
          qty: 1,
          unitPrice: 100,
          amount: 100,
        },
      ],
    },
    {
      id: 'bill-103',
      bill_number: 'INV-2026-003',
      customerId: 'cust-2',
      customerName: 'Walk-in John',
      date: '2026-09-18T16:00:00.000Z',
      total: 80,
      paidTotal: 80,
      balance: 0,
      items: [
        {
          productId: 'prod-1',
          name: 'A4 Color Print',
          qty: 10,
          unitPrice: 8, // Discounted custom rate applied!
          amount: 80,
        },
      ],
    },
  ];

  const mockPayments = [
    {
      id: 'pay-1',
      customerId: 'cust-1',
      billId: 'bill-101',
      amount: 95,
      date: '2026-09-10T10:05:00.000Z',
      payment_method: 'UPI',
    },
  ];

  const mockBusiness = {
    shopName: 'PrintPro Alpha',
    address: '123 Print Street',
    phone: '9988776655',
    gstin: '33AAAAA0000A1Z5',
  };

  it('calculates customer consolidated statement KPI and line-item reconciliation correctly', () => {
    const statement = StatementService.getCustomerStatementData({
      customerId: 'cust-1',
      filter: 'all_time',
      customers: mockCustomers,
      bills: mockBills,
      payments: mockPayments,
      business: mockBusiness,
    });

    expect(statement).toBeDefined();
    expect(statement?.customer.name).toBe('Acme Corp');
    expect(statement?.kpi.total_invoiced).toBe(445); // 95 + 350
    expect(statement?.kpi.invoices_count).toBe(2);
    expect(statement?.kpi.total_units_bought).toBe(30); // 10 + 15 + 4 + 1
    expect(statement?.reconciliation.current_outstanding_balance).toBe(350);
    expect(statement?.reconciliation.advance_balance).toBe(500);
    expect(statement?.invoices.length).toBe(2);

    // Check line items under bill-102
    const bill2 = statement?.invoices.find((i) => i.bill_number === 'INV-2026-002');
    expect(bill2?.items.length).toBe(3);
    expect(bill2?.items[2].product_name).toBe('Custom Graphic Design Service');
  });

  it('generates single product sales intelligence with pricing variance detection', () => {
    const analytics = ProductAnalyticsService.getProductSalesAnalytics({
      productId: 'prod-1',
      filter: 'all_time',
      bills: mockBills,
      products: mockProducts,
    });

    expect(analytics).toBeDefined();
    expect(analytics?.product_name).toBe('A4 Color Print');
    expect(analytics?.total_quantity_sold).toBe(35); // 10 + 15 + 10
    expect(analytics?.total_revenue).toBe(330); // 100 + 150 + 80
    expect(analytics?.orders_count).toBe(3);
    expect(analytics?.min_rate).toBe(8); // Custom rate on bill-103
    expect(analytics?.max_rate).toBe(10);
    expect(analytics?.has_price_variance).toBe(true);
    expect(analytics?.transaction_history.length).toBe(3);
  });

  it('groups uncataloged ad-hoc services and tracks dynamic rate metrics', () => {
    const customAnalytics = ProductAnalyticsService.getCustomItemsAnalytics({
      filter: 'all_time',
      bills: mockBills,
      products: mockProducts,
    });

    expect(customAnalytics.length).toBe(1);
    expect(customAnalytics[0].product_name).toBe('Custom Graphic Design Service');
    expect(customAnalytics[0].total_quantity).toBe(1);
    expect(customAnalytics[0].total_revenue).toBe(100);
    expect(customAnalytics[0].min_rate).toBe(100);
    expect(customAnalytics[0].max_rate).toBe(100);
    expect(customAnalytics[0].orders_count).toBe(1);
  });

  it('generates vector A4 PDF documents without throwing errors', () => {
    const statement = StatementService.getCustomerStatementData({
      customerId: 'cust-1',
      filter: 'all_time',
      customers: mockCustomers,
      bills: mockBills,
      payments: mockPayments,
      business: mockBusiness,
    });

    expect(() => {
      const doc = StatementService.generateStatementPDF(statement!);
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    }).not.toThrow();

    const productAnalytics = ProductAnalyticsService.getProductSalesAnalytics({
      productId: 'prod-1',
      filter: 'all_time',
      bills: mockBills,
      products: mockProducts,
    });

    expect(() => {
      const doc = ProductAnalyticsService.generateProductSalesPDF(
        productAnalytics!,
        mockBusiness,
        'All Time'
      );
      expect(doc.internal.pages.length).toBeGreaterThan(0);
    }).not.toThrow();
  });
});
