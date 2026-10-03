import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SequenceService } from '../sequenceService';
import { mapCustomerFromApi } from '../../api/customers';
import { mapBillFromApi } from '../../api/bills';
import { mapPaymentFromApi } from '../../api/payments';
import { mapPurchaseFromApi } from '../../hooks/useExpensesQuery';

describe('Universal Sequential ID & UUID Elimination Suite', () => {
  const sampleUuid = 'a3b84df1-689d-4c3e-953b-0123456789ab';
  const anotherUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  describe('SequenceService 4-Digit Formatting', () => {
    it('formats sequential numbers with default 4-digit zero padding', () => {
      expect(SequenceService.formatSequenceCode('CUS', 1)).toBe('CUS-0001');
      expect(SequenceService.formatSequenceCode('INV', 42)).toBe('INV-0042');
      expect(SequenceService.formatSequenceCode('PAY', 350)).toBe('PAY-0350');
      expect(SequenceService.formatSequenceCode('EXP', 9999)).toBe('EXP-9999');
    });

    it('sanitizes input values and handles non-numeric strings safely', () => {
      expect(SequenceService.formatSequenceCode('CUS', 'item-7')).toBe('CUS-0007');
      expect(SequenceService.formatSequenceCode('INV', 0)).toBe('INV-0001');
      expect(SequenceService.formatSequenceCode('EXP', -10)).toBe('EXP-0001');
    });
  });

  describe('Zero-UUID Leakage in formatDisplayCode', () => {
    it('converts raw UUIDs to clean sequential codes and never returns raw UUID strings', () => {
      const code1 = SequenceService.formatDisplayCode('customer', sampleUuid, 'CUS');
      const code2 = SequenceService.formatDisplayCode('bill', anotherUuid, 'INV');
      const code3 = SequenceService.formatDisplayCode('payment', sampleUuid, 'PAY');
      const code4 = SequenceService.formatDisplayCode('expense', anotherUuid, 'EXP');

      expect(code1).toMatch(/^CUS-\d{4}$/);
      expect(code2).toMatch(/^INV-\d{4}$/);
      expect(code3).toMatch(/^PAY-\d{4}$/);
      expect(code4).toMatch(/^EXP-\d{4}$/);

      expect(code1).not.toContain(sampleUuid);
      expect(code2).not.toContain(anotherUuid);
    });

    it('preserves existing valid non-UUID sequence codes', () => {
      const existingCustomer = { id: sampleUuid, customerCode: 'CUS-0042' };
      const existingBill = { id: anotherUuid, invoiceNumber: 'INV-0128' };

      expect(SequenceService.formatDisplayCode('customer', existingCustomer)).toBe('CUS-0042');
      expect(SequenceService.formatDisplayCode('bill', existingBill)).toBe('INV-0128');
    });

    it('rejects UUID strings placed inside customerCode or invoiceNumber properties', () => {
      const corruptCustomer = { id: sampleUuid, customerCode: sampleUuid };
      const corruptBill = { id: anotherUuid, invoiceNumber: anotherUuid };

      const resolvedCust = SequenceService.formatDisplayCode('customer', corruptCustomer);
      const resolvedBill = SequenceService.formatDisplayCode('bill', corruptBill);

      expect(resolvedCust).not.toBe(sampleUuid);
      expect(resolvedCust).toMatch(/^CUS-\d{4}$/);

      expect(resolvedBill).not.toBe(anotherUuid);
      expect(resolvedBill).toMatch(/^INV-\d{4}$/);
    });
  });

  describe('API Layer Zero-UUID Sanitization', () => {
    it('mapCustomerFromApi sanitizes customers without valid codes into clean CUS-XXXX', () => {
      const rawApiCustomer = {
        id: sampleUuid,
        name: 'Alpha Printing Corp',
        customer_code: null,
      };

      const mapped = mapCustomerFromApi(rawApiCustomer);
      expect(mapped.customerCode).toMatch(/^CUS-\d{4}$/);
      expect(mapped.customerCode).not.toBe(sampleUuid);
      expect(String(mapped.customerCode).startsWith('CUS-')).toBe(true);
    });

    it('mapBillFromApi sanitizes bills without invoice numbers into clean INV-XXXX', () => {
      const rawApiBill = {
        id: sampleUuid,
        bill_number: null,
        invoice_number: null,
        items: [{ qty: 10, unit_price: 5 }],
      };

      const mapped = mapBillFromApi(rawApiBill);
      expect(mapped.invoiceNumber).toMatch(/^INV-\d{4}$/);
      expect(mapped.invoiceNumber).not.toBe(sampleUuid);
    });

    it('mapPaymentFromApi sanitizes paymentCode and invoiceNumber', () => {
      const rawApiPayment = {
        id: sampleUuid,
        bill_id: anotherUuid,
        payment_code: null,
      };

      const mapped = mapPaymentFromApi(rawApiPayment);
      expect(mapped.paymentCode).toMatch(/^PAY-\d{4}$/);
      expect(mapped.invoiceNumber).toMatch(/^INV-\d{4}$/);
      expect(mapped.paymentCode).not.toBe(sampleUuid);
      expect(mapped.invoiceNumber).not.toBe(anotherUuid);
    });

    it('mapPurchaseFromApi generates clean sequential expenseCode', () => {
      const rawApiExpense = {
        id: sampleUuid,
        item_name: 'Glossy Photo Paper Roll',
        total: 1850,
      };

      const mapped = mapPurchaseFromApi(rawApiExpense);
      expect(mapped.expenseCode).toMatch(/^EXP-\d{4}$/);
      expect(mapped.expenseCode).not.toBe(sampleUuid);
    });
  });

  describe('Sequential Progression Peeking', () => {
    it('calculates the next sequential code based on the highest existing record', () => {
      const existingBills = [
        { invoiceNumber: 'INV-0001' },
        { invoiceNumber: 'INV-0004' },
        { invoiceNumber: 'INV-0002' },
      ];

      const nextCode = SequenceService.peekNextSequence('bill', existingBills, 'INV', 4);
      expect(nextCode).toBe('INV-0005');
    });

    it('handles empty arrays by defaulting to sequence 0001', () => {
      const nextCust = SequenceService.peekNextSequence('customer', [], 'CUS', 4);
      expect(nextCust).toBe('CUS-0001');
    });
  });
});
