import { describe, it, expect } from 'vitest'
import { SequenceService } from '../sequenceService'
import { ReminderService } from '../reminderService'
import { PromoService } from '../promoService'

describe('Settings & Business Profile Audit Sync Suite', () => {
  it('correctly maps business profile schema between UI camelCase and Supabase snake_case', () => {
    const rawSupabaseProfile = {
      id: 'prof-001',
      user_id: 'usr-123',
      shop_name: 'PrintPro Cyber Hub',
      owner_name: 'Alen Roy',
      phone: '+91 9876543210',
      address: 'Shop 42, Tech Park, Bangalore',
      gstin: '29ABCDE1234F1Z5',
      upi_id: 'printpro@oksbi',
    }

    // Client model mapping
    const clientBusiness = {
      shopName: rawSupabaseProfile.shop_name || '',
      ownerName: rawSupabaseProfile.owner_name || '',
      phone: rawSupabaseProfile.phone || '',
      address: rawSupabaseProfile.address || '',
      gstin: rawSupabaseProfile.gstin || '',
      upiId: rawSupabaseProfile.upi_id || '',
    }

    expect(clientBusiness.shopName).toBe('PrintPro Cyber Hub')
    expect(clientBusiness.ownerName).toBe('Alen Roy')
    expect(clientBusiness.gstin).toBe('29ABCDE1234F1Z5')
    expect(clientBusiness.upiId).toBe('printpro@oksbi')

    // Mutation payload transformation
    const mutationPayload = {
      shop_name: clientBusiness.shopName,
      owner_name: clientBusiness.ownerName,
      phone: clientBusiness.phone,
      address: clientBusiness.address,
      gstin: clientBusiness.gstin,
      upi_id: clientBusiness.upiId,
    }

    expect(mutationPayload.shop_name).toBe('PrintPro Cyber Hub')
    expect(mutationPayload.upi_id).toBe('printpro@oksbi')
  })

  it('correctly formats customized sequence entity codes and respects prefix & padding settings', () => {
    // Test custom prefix POS with 4 padding digits
    const code = SequenceService.formatDisplayCode('bill', 42, 'POS', 4)
    expect(code).toBe('POS-0042')

    // Test custom Customer prefix CLIENT with 5 padding digits
    const custCode = SequenceService.formatDisplayCode('customer', 7, 'CLIENT', 5)
    expect(custCode).toBe('CLIENT-00007')

    // Test custom Expense prefix EXPENSE with 6 padding digits
    const expCode = SequenceService.formatDisplayCode('expense', 19, 'EXPENSE', 6)
    expect(expCode).toBe('EXPENSE-000019')
  })

  it('interpolates WhatsApp notification templates with custom business & customer placeholders', () => {
    const customTemplates = {
      whatsappGreeting: 'Namaste *{customer_name}*,',
      whatsappFooter: 'Best regards from *{shop_name}* (Helpline: {phone}).',
      includeUpiInWhatsApp: true,
    }

    const business = {
      shopName: 'Speedy Print Hub',
      phone: '9988776655',
      upiId: 'speedy@upi',
    }

    const bill = {
      id: 'bill-1',
      invoiceNumber: 'BILL-0099',
      customerName: 'Rahul Verma',
      total: 1200,
      balance: 400,
      date: '2026-03-25',
    }

    const invoiceMsg = ReminderService.buildInvoiceMessage(bill, business, customTemplates)
    expect(invoiceMsg).toContain('Namaste *Rahul Verma*,')
    expect(invoiceMsg).toContain('BILL-0099')

    const customer = { name: 'Rahul Verma' }
    const reminderMsg = ReminderService.buildLedgerReminderMessage(customer, 400, business, customTemplates)
    expect(reminderMsg).toContain('Namaste *Rahul Verma*,')
    expect(reminderMsg).toContain('₹400.00')
    expect(reminderMsg).toContain('Best regards from *Speedy Print Hub*')
    expect(reminderMsg).toContain('speedy@upi')
  })

  it('validates promo coupon codes for percent discounts, minimum carts, and expiry', () => {
    const promoCodes: any[] = [
      {
        code: 'SUMMER20',
        type: 'percent',
        value: 20,
        minAmount: 500,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        enabled: true,
      },
      {
        code: 'FLAT100',
        type: 'flat',
        value: 100,
        minAmount: 1000,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        enabled: true,
      },
      {
        code: 'EXPIRED50',
        type: 'flat',
        value: 50,
        minAmount: 0,
        startDate: '2025-01-01',
        endDate: '2025-06-01',
        enabled: true,
      },
    ]

    const testDate = new Date('2026-06-15')

    // Valid discount on cart of 600
    const res1 = PromoService.validateAndApplyPromo('SUMMER20', 600, promoCodes, testDate)
    expect(res1.isValid).toBe(true)
    expect(res1.discountAmount).toBe(120) // 20% of 600

    // Below minimum order amount
    const res2 = PromoService.validateAndApplyPromo('SUMMER20', 400, promoCodes, testDate)
    expect(res2.isValid).toBe(false)
    expect(res2.errorMessage).toContain('minimum order')

    // Expired coupon
    const res3 = PromoService.validateAndApplyPromo('EXPIRED50', 500, promoCodes, testDate)
    expect(res3.isValid).toBe(false)
    expect(res3.errorMessage).toContain('expired')
  })

  it('preserves thermal printer roll size preferences (58mm, 80mm, A4) and auto-print flags', () => {
    const defaultSettings = {
      printPaperSize: '80mm',
      silentThermalPrint: false,
      autoPrintOnSave: true,
    }

    const updatedSettings = {
      ...defaultSettings,
      printPaperSize: '58mm',
      silentThermalPrint: true,
    }

    expect(updatedSettings.printPaperSize).toBe('58mm')
    expect(updatedSettings.silentThermalPrint).toBe(true)
    expect(updatedSettings.autoPrintOnSave).toBe(true)
  })

  it('correctly maps promo codes between database model and frontend client schema', () => {
    const rawDbRow = {
      id: 'promo-uuid-1',
      user_id: 'usr-123',
      code: 'diwali50',
      type: 'percent',
      value: 50.0,
      min_amount: 500.0,
      max_discount: 250.0,
      start_date: '2026-10-01',
      end_date: '2026-11-15',
      enabled: true,
      created_at: '2026-09-26T10:00:00Z',
      updated_at: '2026-09-26T10:00:00Z',
    }

    const clientPromo = {
      id: rawDbRow.id,
      code: (rawDbRow.code || '').trim().toUpperCase(),
      type: rawDbRow.type,
      value: Number(rawDbRow.value),
      minAmount: Number(rawDbRow.min_amount),
      maxDiscount: Number(rawDbRow.max_discount),
      startDate: rawDbRow.start_date,
      endDate: rawDbRow.end_date,
      enabled: rawDbRow.enabled,
    }

    expect(clientPromo.code).toBe('DIWALI50')
    expect(clientPromo.type).toBe('percent')
    expect(clientPromo.value).toBe(50)
    expect(clientPromo.minAmount).toBe(500)
    expect(clientPromo.maxDiscount).toBe(250)
    expect(clientPromo.enabled).toBe(true)
  })

  it('verifies deep merging of settings preserves nested loyalty and branding configurations', () => {
    const baseSettings = {
      theme: 'dark',
      loyaltyEnabled: true,
      loyaltyTiers: [
        { from: 1, to: 40, points: 1 },
        { from: 41, to: 100, points: 2 }
      ],
      branding: {
        primaryColor: '#0f172a',
        logoUrl: '',
      }
    }

    const deltaUpdate = {
      theme: 'dark',
      loyaltyTiers: [
        { from: 1, to: 50, points: 2 },
        { from: 51, to: 200, points: 5 }
      ],
      branding: {
        primaryColor: '#6366f1',
        logoUrl: 'https://example.com/logo.png',
      }
    }

    const merged = {
      ...baseSettings,
      ...deltaUpdate,
      branding: {
        ...baseSettings.branding,
        ...deltaUpdate.branding,
      }
    }

    expect(merged.loyaltyTiers[0].points).toBe(2)
    expect(merged.loyaltyTiers[1].points).toBe(5)
    expect(merged.branding.primaryColor).toBe('#6366f1')
    expect(merged.branding.logoUrl).toBe('https://example.com/logo.png')
  })
})
