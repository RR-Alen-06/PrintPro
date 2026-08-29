/**
 * PromoService - Centralized, robust coupon & promo code validation and computation engine.
 */

export interface PromoCode {
  code: string;
  type: 'percent' | 'flat';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  startDate?: string | null;
  endDate?: string | null;
  enabled?: boolean;
}

export interface PromoValidationResult {
  isValid: boolean;
  errorMessage?: string;
  promo?: PromoCode;
  discountAmount: number;
}

export class PromoService {
  /**
   * Validates a coupon code against order amount and date constraints.
   * Safe against case sensitivity, leading/trailing whitespace, and null/undefined values.
   */
  static validateAndApplyPromo(
    code: string,
    orderSubtotal: number,
    promoCodes: PromoCode[] = [],
    currentDate: Date = new Date()
  ): PromoValidationResult {
    const safeSubtotal = Math.max(0, Number(orderSubtotal) || 0);
    const cleanedCode = (code || '').trim().toUpperCase();

    if (!cleanedCode) {
      return { isValid: false, errorMessage: 'Coupon code is required', discountAmount: 0 };
    }

    const promo = (promoCodes || []).find((p) => (p.code || '').trim().toUpperCase() === cleanedCode);

    if (!promo) {
      return { isValid: false, errorMessage: `Invalid coupon code '${cleanedCode}'`, discountAmount: 0 };
    }

    if (promo.enabled === false) {
      return { isValid: false, errorMessage: `Coupon '${cleanedCode}' is inactive`, discountAmount: 0 };
    }

    // Date range checking
    const todayStr = currentDate.toISOString().slice(0, 10);
    if (promo.startDate && promo.startDate > todayStr) {
      return { isValid: false, errorMessage: `Coupon '${cleanedCode}' is not active yet`, discountAmount: 0 };
    }
    if (promo.endDate && promo.endDate < todayStr) {
      return { isValid: false, errorMessage: `Coupon '${cleanedCode}' has expired`, discountAmount: 0 };
    }

    // Minimum order amount threshold
    const minAmt = Math.max(0, Number(promo.minAmount) || 0);
    if (minAmt > 0 && safeSubtotal < minAmt) {
      return {
        isValid: false,
        errorMessage: `Coupon '${cleanedCode}' requires a minimum order of ₹${minAmt.toFixed(2)}`,
        discountAmount: 0,
      };
    }

    // Calculate discount amount
    const rawVal = Math.max(0, Number(promo.value) || 0);
    let discount = 0;

    if (promo.type === 'percent') {
      const safePercent = Math.min(100, rawVal);
      discount = (safeSubtotal * safePercent) / 100;
      if (promo.maxDiscount && promo.maxDiscount > 0) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else {
      // Flat discount
      discount = Math.min(rawVal, safeSubtotal);
    }

    const finalDiscount = Number(Math.min(discount, safeSubtotal).toFixed(2));

    return {
      isValid: true,
      promo,
      discountAmount: finalDiscount,
    };
  }
}
