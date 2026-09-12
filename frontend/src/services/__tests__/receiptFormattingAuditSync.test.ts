import { describe, it, expect } from 'vitest';
import { formatReceiptForWhatsApp, getUpiPaymentLink } from '../../utils/receiptFormatter';

describe('Receipt Formatting & Audit Sync Suite', () => {
  const mockBill = {
    id: 'bill-1001',
    billNumber: 'BILL-0042',
    billSequence: 'BILL-0042',
    date: '2026-09-12T14:30:00Z',
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    customerType: 'regular',
    items: [
      {
        id: 'item-1',
        itemName: 'A4 Color Print',
        quantity: 10,
        rate: 15,
        amount: 150,
      },
      {
        id: 'item-2',
        itemName: 'Hardcover Binding',
        quantity: 2,
        rate: 100,
        amount: 200,
      },
    ],
    subtotal: 350,
    discount: 20,
    tax: 16.5,
    total: 346.5,
    amountPaid: 200,
    balance: 146.5,
    paymentMethod: {
      cash: 100,
      upi: 100,
    },
    loyaltyPointsEarned: 10,
    customerTotalLoyaltyPoints: 120,
  };

  const mockShopSettings = {
    shopName: 'PrintPro Studio',
    phone: '9888877777',
    upiId: 'printpro@upi',
    thermalWidth: '58mm',
    footerNotes: 'All print jobs inspected for high quality.',
  };

  it('formats digital WhatsApp receipt text with complete breakdown and UPI link', () => {
    const text = formatReceiptForWhatsApp(mockBill, mockShopSettings);

    expect(text).toContain('PrintPro Studio');
    expect(text).toContain('BILL-0042');
    expect(text).toContain('Aarav Sharma');
    expect(text).toContain('A4 Color Print');
    expect(text).toContain('Hardcover Binding');
    expect(text).toContain('₹346.50');
    expect(text).toContain('₹200.00');
    expect(text).toContain('₹146.50');
    expect(text).toContain('printpro@upi');
    expect(text).toContain('All print jobs inspected for high quality.');
  });

  it('handles polymorphic database properties gracefully without NaN or runtime exceptions', () => {
    const polymorphicBill = {
      id: 'bill-legacy-99',
      bill_sequence: 'BILL-0099',
      bill_number: 'BILL-0099',
      customer_name: 'Priya Verma',
      customer_phone: '9123456780',
      total_amount: '500',
      amount_paid: '300',
      balance_amount: '200',
      items: [
        {
          name: 'Poster Lamination A3',
          qty: 5,
          unit_price: 100,
          total: 500,
        },
      ],
      cash_amount: 300,
      upi_amount: 0,
    };

    const text = formatReceiptForWhatsApp(polymorphicBill, mockShopSettings);

    expect(text).toContain('BILL-0099');
    expect(text).toContain('Priya Verma');
    expect(text).toContain('Poster Lamination A3');
    expect(text).toContain('₹500.00');
    expect(text).toContain('₹300.00');
    expect(text).toContain('₹200.00');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });

  it('generates standard UPI deep links for quick scanning & settlement', () => {
    const upiLink = getUpiPaymentLink('printpro@upi', 'PrintPro Studio', 146.5, 'BILL-0042');
    expect(upiLink).toContain('upi://pay?pa=printpro%40upi');
    expect(upiLink).toContain('am=146.50');
    expect(upiLink).toContain('pn=PrintPro%20Studio');
  });

  it('handles zero balance settlement cleanly without outstanding prompt', () => {
    const fullyPaidBill = {
      ...mockBill,
      amountPaid: 346.5,
      balance: 0,
    };

    const text = formatReceiptForWhatsApp(fullyPaidBill, mockShopSettings);
    expect(text).toContain('Paid in Full');
    expect(text).not.toContain('Balance Due: ₹');
  });
});
