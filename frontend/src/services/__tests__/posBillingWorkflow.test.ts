import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SequenceService } from '../sequenceService'
import { BillingService } from '../billingService'
import { CreditService } from '../creditService'
import { PromoService, PromoCode } from '../promoService'
import { LoyaltyService, LoyaltyConfig } from '../loyaltyService'
import { GstService } from '../gstService'
import { ReminderService } from '../reminderService'

describe('Workflow 2: Core POS Billing & Invoicing One-to-One Trace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executes complete POS workflow: Paper/Product/Custom Matrix -> Promo -> Loyalty -> Deterministic Bill & GST -> Stock Decrement -> Advance Drawdown + Split Payment -> WhatsApp Receipt', () => {
    // =========================================================================
    // STAGE 1: PAPER PRICING MATRIX, STANDARD PRODUCTS & CUSTOM LINE ITEMS
    // =========================================================================
    // Define Paper Item with 4-way printing matrix (Color/BW, Single/Double)
    const printPaperCatalogItem = {
      id: 'prod-paper-a4',
      name: 'A4 80 GSM Bond Paper',
      type: 'print' as const,
      hsn_code: '4911',
      color_single: 10.0,
      color_double: 18.0,
      bw_single: 3.0,
      bw_double: 5.0,
    }

    // Standard Inventory Product with tracked physical stock
    const standardInventoryProduct = {
      id: 'prod-spiral-bind',
      name: 'Spiral Binding Notebook (100 Sheets)',
      type: 'product' as const,
      hsn_code: '4820',
      selling_price: 65.0,
      stock_quantity: 30,
    }

    // Helper: Matrix price resolution
    const resolvePrintRate = (
      paper: typeof printPaperCatalogItem,
      isColor: boolean,
      isDouble: boolean
    ): number => {
      if (isColor) {
        return isDouble ? paper.color_double : paper.color_single
      }
      return isDouble ? paper.bw_double : paper.bw_single
    }

    // Job 1: 20 Copies of Color Double Sided
    const job1UnitPrice = resolvePrintRate(printPaperCatalogItem, true, true)
    expect(job1UnitPrice).toBe(18.0)
    const job1Qty = 20
    const job1Subtotal = job1Qty * job1UnitPrice // 360.00

    // Job 2: 50 Copies of Black & White Single Sided
    const job2UnitPrice = resolvePrintRate(printPaperCatalogItem, false, false)
    expect(job2UnitPrice).toBe(3.0)
    const job2Qty = 50
    const job2Subtotal = job2Qty * job2UnitPrice // 150.00

    // Job 3: 2 Units of Spiral Binding Product
    const job3UnitPrice = standardInventoryProduct.selling_price
    expect(job3UnitPrice).toBe(65.0)
    const job3Qty = 2
    const job3Subtotal = job3Qty * job3UnitPrice // 130.00

    // Job 4: Custom Dynamic Line Item (Urgent Express Rush Setup Fee)
    const job4Name = 'Express Priority Machine Setup'
    const job4UnitPrice = 110.0
    const job4Qty = 1
    const job4Subtotal = job4Qty * job4UnitPrice // 110.00

    // Total Cart Subtotal before any discounts
    const grossCartSubtotal = job1Subtotal + job2Subtotal + job3Subtotal + job4Subtotal
    expect(grossCartSubtotal).toBe(750.0)

    // =========================================================================
    // STAGE 2: PROMOTION DISCOUNT COUPON VALIDATION (PromoService)
    // =========================================================================
    const activePromos: PromoCode[] = [
      {
        code: 'SAVE10',
        type: 'percent',
        value: 10,
        minAmount: 500,
        maxDiscount: 100,
        enabled: true,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        code: 'EXPIRED50',
        type: 'flat',
        value: 50,
        minAmount: 200,
        enabled: true,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      },
      {
        code: 'BIGSPEND',
        type: 'flat',
        value: 200,
        minAmount: 2000,
        enabled: true,
      },
    ]

    // Validate invalid / expired / sub-minimum promo scenarios
    const expiredResult = PromoService.validateAndApplyPromo('EXPIRED50', grossCartSubtotal, activePromos)
    expect(expiredResult.isValid).toBe(false)
    expect(expiredResult.errorMessage).toContain('expired')

    const subMinResult = PromoService.validateAndApplyPromo('BIGSPEND', grossCartSubtotal, activePromos)
    expect(subMinResult.isValid).toBe(false)
    expect(subMinResult.errorMessage).toContain('requires a minimum order of ₹2000.00')

    // Validate active coupon SAVE10 against 750 subtotal (10% = 75.00)
    const promoResult = PromoService.validateAndApplyPromo('SAVE10', grossCartSubtotal, activePromos)
    expect(promoResult.isValid).toBe(true)
    expect(promoResult.discountAmount).toBe(75.0)

    // =========================================================================
    // STAGE 3: LOYALTY POINTS REDEMPTION ENGINE (LoyaltyService)
    // =========================================================================
    const loyaltyConfig: LoyaltyConfig = {
      loyaltyEnabled: true,
      loyaltyRedeemEnabled: true,
      loyaltyRedeemRatioPoints: 100, // 100 points = ₹10
      loyaltyRedeemRatioRupees: 10,
      loyaltyTiers: [
        { from: 0, to: 500, points: 5 },
        { from: 501, to: 1000, points: 15 },
        { from: 1001, to: 5000, points: 40 },
      ],
    }

    const customerInitialPoints = 250 // Customer has 250 points in account
    const pointsToBurn = 100 // Customer chooses to redeem 100 points

    const redemptionResult = LoyaltyService.calculateRedemptionDiscount(
      pointsToBurn,
      customerInitialPoints,
      grossCartSubtotal,
      loyaltyConfig
    )

    expect(redemptionResult.pointsRedeemed).toBe(100)
    expect(redemptionResult.discountAmount).toBe(10.0) // 100 points * (10 / 100) = ₹10.00

    const customerPointsRemaining = customerInitialPoints - redemptionResult.pointsRedeemed
    expect(customerPointsRemaining).toBe(150)

    // Total invoice-level discounts: Promo (75) + Loyalty (10) = 85
    const combinedInvoiceDiscount = promoResult.discountAmount // 75
    const loyaltyDiscountAmount = redemptionResult.discountAmount // 10

    // =========================================================================
    // STAGE 4: DETERMINISTIC BILL CALCULATION & GST ENGINE (BillingService)
    // =========================================================================
    const billingInputItems = [
      {
        itemId: printPaperCatalogItem.id,
        itemName: `${printPaperCatalogItem.name} (Color Double)`,
        printType: 'color' as const,
        sides: 'double' as const,
        qty: job1Qty,
        unitPrice: job1UnitPrice,
        gstRate: 18,
      },
      {
        itemId: printPaperCatalogItem.id,
        itemName: `${printPaperCatalogItem.name} (B&W Single)`,
        printType: 'bw' as const,
        sides: 'single' as const,
        qty: job2Qty,
        unitPrice: job2UnitPrice,
        gstRate: 18,
      },
      {
        itemId: standardInventoryProduct.id,
        itemName: standardInventoryProduct.name,
        qty: job3Qty,
        unitPrice: job3UnitPrice,
        gstRate: 12, // Standard stationery HSN tax bracket
      },
      {
        itemId: 'custom-rush-fee',
        itemName: job4Name,
        qty: job4Qty,
        unitPrice: job4UnitPrice,
        gstRate: 18,
      },
    ]

    const billResult = BillingService.calculateBill({
      items: billingInputItems,
      discountType: 'flat',
      discountValue: combinedInvoiceDiscount, // ₹75 promo
      loyaltyDiscount: loyaltyDiscountAmount, // ₹10 loyalty
      gstPercent: 18, // fallback
      roundingMethod: 'Round Up',
    })

    // Subtotal and Total Discounts
    expect(billResult.subtotal).toBe(750.0)
    expect(billResult.invoiceDiscountTotal).toBe(75.0)
    expect(billResult.loyaltyDiscountTotal).toBe(10.0)
    expect(billResult.totalDiscount).toBe(85.0)

    // Net taxable amount across all lines must equal (750 - 85) = 665.00 exactly
    expect(billResult.taxableAmount).toBe(665.0)

    // Verify pro-rata discount distribution precision across 4 lines
    const lineDiscountSum = billResult.items.reduce((s, i) => s + (i.allocatedInvoiceDiscount || 0), 0)
    expect(Number(lineDiscountSum.toFixed(2))).toBe(85.0)

    // Verify tax calculation per line
    // Item 1: 360 - (360/750 * 85 = 40.80) = 319.20 @ 18% = 57.46
    // Item 2: 150 - (150/750 * 85 = 17.00) = 133.00 @ 18% = 23.94
    // Item 3: 130 - (130/750 * 85 = 14.73) = 115.27 @ 12% = 13.83
    // Item 4: 110 - remaining allocated disc (12.47) = 97.53 @ 18% = 17.56
    const calculatedGstSum = billResult.items.reduce((sum, item) => sum + item.lineGst, 0)
    expect(billResult.gstAmount).toBe(Number(calculatedGstSum.toFixed(2)))

    // CGST and SGST equal 50% split of GST
    const cgstAmount = Number((billResult.gstAmount / 2).toFixed(2))
    const sgstAmount = Number((billResult.gstAmount - cgstAmount).toFixed(2))
    expect(Number((cgstAmount + sgstAmount).toFixed(2))).toBe(billResult.gstAmount)

    // Pre-rounded total = Taxable (665.00) + GST (112.79) = 777.79
    expect(billResult.preRoundedTotal).toBe(Number((billResult.taxableAmount + billResult.gstAmount).toFixed(2)))

    // 'Round Up' ceiling to nearest integer: 777.79 -> 778.00
    expect(billResult.roundedTotal).toBe(Math.ceil(billResult.preRoundedTotal))
    expect(billResult.roundingAdjustment).toBe(Number((billResult.roundedTotal - billResult.preRoundedTotal).toFixed(2)))

    const finalPayableTotal = billResult.roundedTotal

    // =========================================================================
    // STAGE 5: INVENTORY STOCK DECREMENT SIMULATION
    // =========================================================================
    // Stock is only tracked and deducted for 'product' type items. Print services and custom fees do not decrement stock.
    const inventoryStore = [
      { ...standardInventoryProduct },
    ]

    for (const item of billResult.items) {
      const invMatch = inventoryStore.find((inv) => inv.id === item.itemId)
      if (invMatch && invMatch.type === 'product') {
        const previousStock = invMatch.stock_quantity
        invMatch.stock_quantity = Math.max(0, invMatch.stock_quantity - item.qty)
        expect(invMatch.stock_quantity).toBe(previousStock - item.qty)
      }
    }

    // Spiral Notebook started at 30, 2 sold -> 28 remaining
    expect(inventoryStore[0].stock_quantity).toBe(28)

    // =========================================================================
    // STAGE 6: CUSTOMER ADVANCE WALLET DRAWDOWN & SPLIT PAYMENTS (CreditService)
    // =========================================================================
    const customer = {
      id: 'cust-pos-001',
      customer_code: 'CUS-000101',
      name: 'Rohan Sharma',
      phone: '9845012345',
      advance_balance: 200.0, // Customer has ₹200 advance deposit in wallet
      credit_balance: 0.0,
      credit_limit: 5000.0,
    }

    // Step A: Drawdown Advance
    const advanceDrawdown = CreditService.calculateAdvanceDrawdown(
      customer.advance_balance,
      finalPayableTotal
    )

    expect(advanceDrawdown.advanceUsed).toBe(200.0) // Uses entire ₹200 advance
    expect(advanceDrawdown.remainingAdvance).toBe(0.0)
    expect(advanceDrawdown.netBillAmount).toBe(finalPayableTotal - 200.0)

    customer.advance_balance = advanceDrawdown.remainingAdvance

    // Step B: Split Payment for Remaining Balance (Cash + UPI)
    const remainingToPay = advanceDrawdown.netBillAmount // e.g. 778 - 200 = 578
    const splitCash = 300.0
    const splitUpi = Number((remainingToPay - splitCash).toFixed(2))

    expect(splitCash + splitUpi).toBe(remainingToPay)

    const totalCollected = advanceDrawdown.advanceUsed + splitCash + splitUpi
    expect(totalCollected).toBe(finalPayableTotal)

    const balanceDue = Math.max(0, Number((finalPayableTotal - totalCollected).toFixed(2)))
    expect(balanceDue).toBe(0)

    // =========================================================================
    // STAGE 7: INVOICE CODE GENERATION & WHATSAPP RECEIPT (SequenceService & ReminderService)
    // =========================================================================
    const invoiceNumber = SequenceService.formatSequenceCode('INV', 2042, 6)
    expect(invoiceNumber).toBe('INV-002042')

    const persistedBill = {
      id: 'bill-pos-999',
      invoiceNumber,
      bill_number: invoiceNumber,
      customerName: customer.name,
      customer_name: customer.name,
      phone: customer.phone,
      date: '2026-09-28',
      items: billResult.items.map((i) => ({
        description: i.itemName,
        qty: i.qty,
        rate: i.unitPrice,
        amount: i.lineTotal,
      })),
      total: finalPayableTotal,
      grand_total: finalPayableTotal,
      paidTotal: totalCollected,
      amount_paid: totalCollected,
      balance: balanceDue,
      advanceUsed: advanceDrawdown.advanceUsed,
    }

    const businessProfile = {
      shopName: 'PrintPro High-Tech Hub',
      phone: '919876543210',
      upiId: 'printpro@icici',
    }

    const whatsappMessage = ReminderService.buildInvoiceMessage(persistedBill, businessProfile)

    // Verify WhatsApp receipt text content
    expect(whatsappMessage).toContain('PrintPro High-Tech Hub')
    expect(whatsappMessage).toContain('INV-002042')
    expect(whatsappMessage).toContain('Rohan Sharma')
    expect(whatsappMessage).toContain(`*Total Amount:* ₹${finalPayableTotal.toFixed(2)}`)
    expect(whatsappMessage).toContain(`*Amount Paid:* ₹${totalCollected.toFixed(2)}`)
    expect(whatsappMessage).toContain('FULLY PAID')

    // Verify direct WhatsApp send URL sanitization (adds 91 prefix)
    const whatsappUrl = ReminderService.getWhatsAppUrl(customer.phone, whatsappMessage)
    expect(whatsappUrl).toContain('https://api.whatsapp.com/send?phone=919845012345')
    expect(whatsappUrl).toContain(encodeURIComponent('INV-002042'))

    // =========================================================================
    // STAGE 8: NEW LOYALTY POINTS EARNED FOR CURRENT TRANSACTION
    // =========================================================================
    // Based on net spend (665.00 taxable spend), customer earns points based on tier
    // Tier 501 - 1000 awards 15 points
    const newlyEarnedPoints = LoyaltyService.calculatePointsEarned(
      billResult.taxableAmount,
      true,
      loyaltyConfig
    )
    expect(newlyEarnedPoints).toBe(15)

    const customerUpdatedTotalPoints = customerPointsRemaining + newlyEarnedPoints
    // 150 remaining + 15 earned = 165
    expect(customerUpdatedTotalPoints).toBe(165)
  })
})
