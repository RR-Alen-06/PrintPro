import { describe, it, expect } from 'vitest';
import { ReminderService } from '../reminderService';

describe('ReminderService', () => {
  it('sanitizes 10-digit phone numbers by prepending Indian country code 91', () => {
    expect(ReminderService.cleanPhone('9876543210')).toBe('919876543210');
    expect(ReminderService.cleanPhone('+91 98765 43210')).toBe('919876543210');
    expect(ReminderService.cleanPhone('919876543210')).toBe('919876543210');
    expect(ReminderService.cleanPhone('')).toBe('');
  });

  it('builds a structured itemized invoice message with UPI pay link', () => {
    const bill = {
      id: 'bill-123',
      invoiceNumber: 'INV-000045',
      date: '2026-09-12T10:00:00Z',
      customerName: 'Rahul Sharma',
      items: [
        { name: 'A4 Color Print', qty: 10, rate: 10, amount: 100 },
        { name: 'Binding', qty: 1, rate: 50, amount: 50 }
      ],
      total: 150,
      paidTotal: 50,
      balance: 100
    };
    const business = {
      shopName: 'Speedy Prints',
      phone: '9876543210',
      upiId: 'speedy@upi'
    };
    const settings = {
      whatsappGreeting: 'Hello {customer_name}, here is your bill:',
      whatsappFooter: 'Thanks for visiting {shop_name}!',
      includeUpiInWhatsApp: true
    };

    const msg = ReminderService.buildInvoiceMessage(bill, business, settings);
    expect(msg).toContain('SPEEDY PRINTS — INVOICE');
    expect(msg).toContain('Hello Rahul Sharma, here is your bill:');
    expect(msg).toContain('• A4 Color Print × 10 = ₹100.00');
    expect(msg).toContain('• Binding × 1 = ₹50.00');
    expect(msg).toContain('💰 *Total Amount:* ₹150.00');
    expect(msg).toContain('⚠️ *Balance Due:* ₹100.00');
    expect(msg).toContain('upi://pay?pa=speedy%40upi');
    expect(msg).toContain('Thanks for visiting Speedy Prints!');
  });

  it('builds an overdue ledger reminder with closing balance and UPI collection', () => {
    const customer = { name: 'Priya Patel', phone: '9876500000' };
    const closingBalance = -450; // Due to shop
    const business = { shopName: 'PrintPro Studio', upiId: 'printpro@oksbi' };

    const msg = ReminderService.buildLedgerReminderMessage(customer, closingBalance, business);
    expect(msg).toContain('PAYMENT REMINDER — PRINTPRO STUDIO');
    expect(msg).toContain('Dear *Priya Patel*');
    expect(msg).toContain('📊 *Outstanding Balance Due:* ₹450.00');
    expect(msg).toContain('upi://pay?pa=printpro%40oksbi');
  });

  it('generates a direct WhatsApp link with encoded message', () => {
    const url = ReminderService.getWhatsAppUrl('9876543210', 'Test Hello');
    expect(url).toContain('https://api.whatsapp.com/send?phone=919876543210&text=Test%20Hello');
  });
});
