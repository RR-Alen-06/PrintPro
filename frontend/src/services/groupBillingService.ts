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
  advanceBalance?: number;
  custCredit?: number;
  creditBalance?: number;
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
    aggregateAdvanceUsed: number;
    aggregateCashPaid: number;
    aggregateUpiPaid: number;
    aggregateBalanceDue: number;
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
    let aggregateAdvanceUsed = 0;
    let aggregateCashPaid = 0;
    let aggregateUpiPaid = 0;
    let aggregateBalanceDue = 0;

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

      // Advance drawdown calculation
      const useAdvance = Boolean(m.useAdvance);
      const rawAdvBal = Number(m.advanceBalance ?? m.custCredit ?? m.creditBalance ?? 0) || 0;
      const availableAdv = useAdvance ? Math.max(0, rawAdvBal) : 0;
      const advanceUsed = Number(Math.min(availableAdv, memberTotal).toFixed(2));

      const cash = Math.max(0, Number(m.cashPaid) || 0);
      const upi = Math.max(0, Number(m.upiPaid) || 0);
      const totalPaid = Number((advanceUsed + cash + upi).toFixed(2));
      const balanceDue = Number(Math.max(0, memberTotal - totalPaid).toFixed(2));

      aggregateAdvanceUsed = Number((aggregateAdvanceUsed + advanceUsed).toFixed(2));
      aggregateCashPaid = Number((aggregateCashPaid + cash).toFixed(2));
      aggregateUpiPaid = Number((aggregateUpiPaid + upi).toFixed(2));
      aggregateBalanceDue = Number((aggregateBalanceDue + balanceDue).toFixed(2));

      return {
        memberId: m.id,
        customerId: m.customerId,
        subtotal: memberBase,
        discountAmount: discAmount,
        taxableAmount: taxable,
        gstAmount: tax.totalGstAmount,
        total: memberTotal,
        advanceUsed,
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
      aggregateAdvanceUsed,
      aggregateCashPaid,
      aggregateUpiPaid,
      aggregateBalanceDue,
    };
  }

  /**
   * Computes single-payer settlement breakdown for group invoices.
   */
  static calculateSinglePayerSettlement({
    aggregateTotal,
    payerAdvance = 0,
    useAdvance = false,
    cashPaid = 0,
    upiPaid = 0,
  }: {
    aggregateTotal: number;
    payerAdvance?: number;
    useAdvance?: boolean;
    cashPaid?: number;
    upiPaid?: number;
  }): {
    advanceUsed: number;
    cashPaid: number;
    upiPaid: number;
    totalPaid: number;
    balanceDue: number;
    isFullyPaid: boolean;
  } {
    const total = Math.max(0, Number(aggregateTotal) || 0);
    const availableAdv = useAdvance ? Math.max(0, Number(payerAdvance) || 0) : 0;
    const advanceUsed = Number(Math.min(availableAdv, total).toFixed(2));

    const cash = Math.max(0, Number(cashPaid) || 0);
    const upi = Math.max(0, Number(upiPaid) || 0);
    const totalPaid = Number((advanceUsed + cash + upi).toFixed(2));
    const balanceDue = Number(Math.max(0, total - totalPaid).toFixed(2));

    return {
      advanceUsed,
      cashPaid: cash,
      upiPaid: upi,
      totalPaid,
      balanceDue,
      isFullyPaid: balanceDue <= 0 && total > 0,
    };
  }

  /**
   * Deterministically distributes a payment across child member bills in order.
   */
  static distributePaymentAcrossMemberBills({
    memberBills,
    paymentAmount,
  }: {
    memberBills: Array<{ id: string; balance: number; total?: number; customerName?: string }>;
    paymentAmount: number;
  }): {
    settlements: Array<{ billId: string; appliedAmount: number; newBalance: number; isFullyPaid: boolean }>;
    remainingPayment: number;
    totalSettled: number;
  } {
    let remainingPayment = Math.max(0, Number(paymentAmount) || 0);
    let totalSettled = 0;

    const settlements = (memberBills || []).map((bill) => {
      const currentBalance = Math.max(0, Number(bill.balance) || 0);
      const applied = Number(Math.min(remainingPayment, currentBalance).toFixed(2));
      remainingPayment = Number((remainingPayment - applied).toFixed(2));
      totalSettled = Number((totalSettled + applied).toFixed(2));
      const newBalance = Number(Math.max(0, currentBalance - applied).toFixed(2));

      return {
        billId: bill.id,
        appliedAmount: applied,
        newBalance,
        isFullyPaid: newBalance <= 0,
      };
    });

    return {
      settlements,
      remainingPayment,
      totalSettled,
    };
  }
}
