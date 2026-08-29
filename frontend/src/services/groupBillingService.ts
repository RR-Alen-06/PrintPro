import { GstService } from './gstService';
import { CreditService } from './creditService';
import { PromoService, PromoCode } from './promoService';
import { LoyaltyService, LoyaltyConfig } from './loyaltyService';

export interface GroupMemberInput {
  id: string;
  customerId: string;
  customerName?: string;
  hasAddons?: boolean;
  addonRows?: any[];
  discountType?: 'flat' | 'percent';
  discountValue?: number;
  promoCode?: string;
  appliedPromo?: PromoCode;
  loyaltyPointsRedeemed?: number;
  useAdvance?: boolean;
  cashPaid?: number;
  upiPaid?: number;
}

export interface SplitMemberCalculation {
  memberId: string;
  customerId: string;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  total: number;
  advanceUsed: number;
  cashPaid: number;
  upiPaid: number;
  balanceDue: number;
}

export class GroupBillingService {
  /**
   * Calculates deterministic split shares across N members with exact penny reconciliation.
   */
  static calculateSplitPurchase({
    totalAmount,
    members,
    gstPercent = 0,
    discountMode = 'individual',
    groupDiscount = { type: 'flat' as 'flat' | 'percent', value: 0 },
    roundingMethod = 'None',
  }: {
    totalAmount: number;
    members: GroupMemberInput[];
    gstPercent?: number;
    discountMode?: 'individual' | 'group';
    groupDiscount?: { type: 'flat' | 'percent'; value: number };
    roundingMethod?: string;
  }): {
    memberCalculations: SplitMemberCalculation[];
    aggregateSubtotal: number;
    aggregateDiscount: number;
    aggregateGst: number;
    aggregateTotal: number;
  } {
    const memberCount = Math.max(1, (members || []).length);
    const safeTotal = Math.max(0, Number(totalAmount) || 0);

    // Calculate base split per member
    const baseSplit = Number((safeTotal / memberCount).toFixed(2));
    let allocatedTotal = 0;

    let aggregateSubtotal = 0;
    let aggregateDiscount = 0;
    let aggregateGst = 0;
    let aggregateTotal = 0;

    const memberCalculations = (members || []).map((m, idx) => {
      // Last member absorbs 1-paisa rounding remainder
      let memberBase = 0;
      if (idx === memberCount - 1) {
        memberBase = Number((safeTotal - allocatedTotal).toFixed(2));
      } else {
        memberBase = baseSplit;
        allocatedTotal = Number((allocatedTotal + baseSplit).toFixed(2));
      }

      aggregateSubtotal = Number((aggregateSubtotal + memberBase).toFixed(2));

      // Calculate member discount
      let discAmount = 0;
      if (discountMode === 'group' && groupDiscount.value > 0) {
        if (groupDiscount.type === 'percent') {
          discAmount = Number(((memberBase * groupDiscount.value) / 100).toFixed(2));
        } else {
          // Group flat discount split across members
          const flatShare = Number((groupDiscount.value / memberCount).toFixed(2));
          discAmount = Math.min(flatShare, memberBase);
        }
      } else if (m.discountValue && m.discountValue > 0) {
        if (m.discountType === 'percent') {
          discAmount = Number(((memberBase * m.discountValue) / 100).toFixed(2));
        } else {
          discAmount = Math.min(m.discountValue, memberBase);
        }
      }

      aggregateDiscount = Number((aggregateDiscount + discAmount).toFixed(2));

      const taxable = Math.max(0, Number((memberBase - discAmount).toFixed(2)));
      const tax = GstService.calculateTax(taxable, gstPercent);
      const memberTotal = tax.grossAmount;

      aggregateGst = Number((aggregateGst + tax.totalGstAmount).toFixed(2));
      aggregateTotal = Number((aggregateTotal + memberTotal).toFixed(2));

      const cash = Math.max(0, Number(m.cashPaid) || 0);
      const upi = Math.max(0, Number(m.upiPaid) || 0);
      const totalPaid = Number((cash + upi).toFixed(2));
      const balanceDue = Number(Math.max(0, memberTotal - totalPaid).toFixed(2));

      return {
        memberId: m.id,
        customerId: m.customerId,
        subtotal: memberBase,
        discountAmount: discAmount,
        taxableAmount: taxable,
        gstAmount: tax.totalGstAmount,
        total: memberTotal,
        advanceUsed: 0,
        cashPaid: cash,
        upiPaid: upi,
        balanceDue,
      };
    });

    return {
      memberCalculations,
      aggregateSubtotal,
      aggregateDiscount,
      aggregateGst,
      aggregateTotal,
    };
  }
}
