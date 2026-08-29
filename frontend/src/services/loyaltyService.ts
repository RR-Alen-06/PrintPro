/**
 * LoyaltyService - Centralized, deterministic loyalty points earn and burn engine.
 */

export interface LoyaltyTier {
  from: number;
  to: number;
  points: number;
}

export interface LoyaltyRedeemOption {
  points: number;
  rupees: number;
}

export interface LoyaltyConfig {
  loyaltyEnabled?: boolean;
  loyaltyForRandomCustomers?: boolean;
  loyaltyRedeemEnabled?: boolean;
  loyaltyRedeemRatioPoints?: number;
  loyaltyRedeemRatioRupees?: number;
  loyaltyTiers?: LoyaltyTier[];
  loyaltyRedeemOptions?: LoyaltyRedeemOption[];
}

export interface LoyaltyCalculationResult {
  pointsEarned: number;
  pointsRedeemed: number;
  discountAmount: number;
  remainingPoints: number;
}

export class LoyaltyService {
  /**
   * Calculates loyalty points earned on a bill based on net eligible spend.
   */
  static calculatePointsEarned(
    netSpend: number,
    isRegularCustomer: boolean = true,
    config: LoyaltyConfig = {}
  ): number {
    if (config.loyaltyEnabled === false) return 0;
    if (!isRegularCustomer && !config.loyaltyForRandomCustomers) return 0;

    const safeSpend = Math.max(0, Number(netSpend) || 0);
    if (safeSpend <= 0) return 0;

    const tiers = config.loyaltyTiers || [];
    if (tiers.length > 0) {
      // Find matching tier
      const matchedTier = tiers.find(
        (t) => safeSpend >= Number(t.from) && safeSpend <= Number(t.to)
      );
      if (matchedTier) {
        return Math.floor(Number(matchedTier.points) || 0);
      }
      // If higher than max tier, use the highest tier's point rule
      const maxTier = [...tiers].sort((a, b) => b.to - a.to)[0];
      if (maxTier && safeSpend > maxTier.to) {
        return Math.floor(Number(maxTier.points) || 0);
      }
    }

    // Default: 1 point per 100 spent
    return Math.floor(safeSpend / 100);
  }

  /**
   * Converts loyalty points to rupee discount value.
   * Safe against non-integer, negative points, and division by zero.
   */
  static calculateRedemptionDiscount(
    pointsToRedeem: number,
    availablePoints: number,
    billTotal: number,
    config: LoyaltyConfig = {}
  ): { pointsRedeemed: number; discountAmount: number } {
    if (config.loyaltyEnabled === false || config.loyaltyRedeemEnabled === false) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    const safePoints = Math.max(0, Math.floor(Number(pointsToRedeem) || 0));
    const safeAvailable = Math.max(0, Math.floor(Number(availablePoints) || 0));
    const safeBillTotal = Math.max(0, Number(billTotal) || 0);

    const actualPoints = Math.min(safePoints, safeAvailable);
    if (actualPoints <= 0 || safeBillTotal <= 0) {
      return { pointsRedeemed: 0, discountAmount: 0 };
    }

    // Check predefined redeem options first
    const options = config.loyaltyRedeemOptions || [];
    const matchedOption = options.find((o) => o.points === actualPoints);
    if (matchedOption) {
      const discount = Math.min(matchedOption.rupees, safeBillTotal);
      return { pointsRedeemed: actualPoints, discountAmount: Number(discount.toFixed(2)) };
    }

    // Use ratio (e.g. 150 points = ₹5)
    const ratioPoints = Math.max(1, Number(config.loyaltyRedeemRatioPoints) || 150);
    const ratioRupees = Math.max(0, Number(config.loyaltyRedeemRatioRupees) || 5);

    const rawDiscount = (actualPoints / ratioPoints) * ratioRupees;
    const cappedDiscount = Math.min(rawDiscount, safeBillTotal);

    return {
      pointsRedeemed: actualPoints,
      discountAmount: Number(cappedDiscount.toFixed(2)),
    };
  }
}
