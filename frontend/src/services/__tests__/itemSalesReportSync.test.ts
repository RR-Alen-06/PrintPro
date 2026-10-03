import { describe, it, expect } from 'vitest'
import { ProductAnalyticsService } from '../productAnalyticsService'

describe('Item Sales Report & Print Variant Intelligence Engine', () => {
  const sampleProducts = [
    { id: 'PROD-001', name: 'A4 Color Single Print', category: 'Printing', price: 10, code: 'PR001' },
    { id: 'PROD-002', name: 'Spiral Binding A4', category: 'Finishing', price: 50, code: 'PR002' },
  ]

  const sampleBills = [
    {
      id: 'BILL-0001',
      total: 750,
      date: '2026-09-10',
      items: [
        { product_id: 'PROD-001', name: 'A4 Color Single Print', printType: 'color', sides: 'single', qty: 50, unitPrice: 10, amount: 500 },
        { product_id: 'PROD-002', name: 'Spiral Binding A4', printType: 'bw', sides: 'single', qty: 5, unitPrice: 50, amount: 250 },
      ]
    },
    {
      id: 'BILL-0002',
      total: 600,
      date: '2026-09-11',
      items: [
        { product_id: 'PROD-001', name: 'A4 Color Single Print', printType: 'color', sides: 'single', qty: 20, unitPrice: 10, amount: 200 },
        { name: 'A4 B/W Double Copy', printType: 'bw', sides: 'double', qty: 100, unitPrice: 3, amount: 300 },
        { name: 'Glossy Lamination', printType: 'bw', sides: 'single', qty: 10, unitPrice: 10, amount: 100 },
      ]
    },
    {
      id: 'BILL-0003',
      total: 450,
      date: '2026-09-12',
      items: [
        { name: 'Custom Logo Design & Vectorization', qty: 1, unitPrice: 300, amount: 300 },
        { name: 'A4 Color Double Photo Print', printType: 'color', sides: 'double', qty: 10, unitPrice: 15, amount: 150 },
      ]
    }
  ]

  it('accurately classifies items into standardized print variants', () => {
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'A4 Color Single Print', printType: 'color', sides: 'single' }).variantKey).toBe('a4_color_single')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'A4 Color Double Photo Print', printType: 'color', sides: 'double' }).variantKey).toBe('a4_color_double')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'A4 B/W Double Copy', printType: 'bw', sides: 'double' }).variantKey).toBe('a4_bw_double')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'A4 B/W Single Page', printType: 'bw', sides: 'single' }).variantKey).toBe('a4_bw_single')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'Spiral Binding A4' }).variantKey).toBe('binding_finishing')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'Glossy Lamination' }).variantKey).toBe('binding_finishing')
    expect(ProductAnalyticsService.classifyItemVariant({ name: 'Custom Logo Design & Vectorization' }).variantKey).toBe('custom_services')
  })

  it('aggregates print variants with volume, rate range, revenue, and item breakdowns', () => {
    const variants = ProductAnalyticsService.getPrintVariantsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })

    const a4ColorSingle = variants.find(v => v.variant_key === 'a4_color_single')
    expect(a4ColorSingle).toBeDefined()
    expect(a4ColorSingle!.total_quantity).toBe(70) // 50 + 20
    expect(a4ColorSingle!.total_revenue).toBe(700) // 500 + 200
    expect(a4ColorSingle!.average_rate).toBe(10)

    const a4BwDouble = variants.find(v => v.variant_key === 'a4_bw_double')
    expect(a4BwDouble).toBeDefined()
    expect(a4BwDouble!.total_quantity).toBe(100)
    expect(a4BwDouble!.total_revenue).toBe(300)

    const bindingFinishing = variants.find(v => v.variant_key === 'binding_finishing')
    expect(bindingFinishing).toBeDefined()
    expect(bindingFinishing!.total_quantity).toBe(15) // 5 + 10
    expect(bindingFinishing!.total_revenue).toBe(350) // 250 + 100
    expect(bindingFinishing!.item_breakdown.length).toBe(2)

    const customServices = variants.find(v => v.variant_key === 'custom_services')
    expect(customServices).toBeDefined()
    expect(customServices!.total_quantity).toBe(1)
    expect(customServices!.total_revenue).toBe(300)
  })

  it('tracks catalog and custom ad-hoc services separately', () => {
    const catalog = ProductAnalyticsService.getAllCatalogProductsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })

    expect(catalog.length).toBe(2)
    const prod1 = catalog.find(c => c.product_id === 'PROD-001')
    expect(prod1!.total_quantity_sold).toBe(70)
    expect(prod1!.total_revenue).toBe(700)

    const custom = ProductAnalyticsService.getCustomItemsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })

    const logoCustom = custom.find(cu => cu.product_name === 'Custom Logo Design & Vectorization')
    expect(logoCustom).toBeDefined()
    expect(logoCustom!.total_revenue).toBe(300)
    expect(logoCustom!.orders_count).toBe(1)
  })

  it('successfully generates a comprehensive master PDF report without errors', () => {
    const variants = ProductAnalyticsService.getPrintVariantsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })
    const catalog = ProductAnalyticsService.getAllCatalogProductsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })
    const custom = ProductAnalyticsService.getCustomItemsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })

    const doc = ProductAnalyticsService.generateComprehensiveItemSalesReportPDF({
      catalogData: catalog,
      customData: custom,
      variantData: variants,
      business: { shopName: 'PrintPro Cyber Hub', address: 'MG Road, Bangalore', phone: '9876543210' },
      periodLabel: 'September 2026',
      currency: '₹',
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('generates variant-specific and custom service drilldown PDFs', () => {
    const variants = ProductAnalyticsService.getPrintVariantsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })
    const variantDoc = ProductAnalyticsService.generateVariantSalesPDF(
      variants[0],
      { shopName: 'PrintPro Studio' },
      'September 2026',
      '₹'
    )
    expect(variantDoc).toBeDefined()

    const custom = ProductAnalyticsService.getCustomItemsAnalytics({
      filter: 'all',
      bills: sampleBills,
      products: sampleProducts,
    })
    const customDoc = ProductAnalyticsService.generateCustomItemSalesPDF(
      custom[0],
      { shopName: 'PrintPro Studio' },
      'September 2026',
      '₹'
    )
    expect(customDoc).toBeDefined()
  })
})
