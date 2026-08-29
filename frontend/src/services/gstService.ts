/**
 * GstService - Centralized, mathematically sound GST tax calculation engine.
 * Supports Intra-state (CGST + SGST) and Inter-state (IGST) tax rules.
 */

export interface TaxBreakdown {
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGstAmount: number;
  grossAmount: number;
}

export interface LineTaxInput {
  amount: number;
  gstRate?: number;
  isInterState?: boolean;
}

export class GstService {
  /**
   * Calculates GST breakdown for a given taxable amount and tax rate.
   * Safe against NaN, null/undefined, negative rates, and division by zero.
   */
  static calculateTax(
    taxableAmount: number,
    gstRate: number = 0,
    isInterState: boolean = false
  ): TaxBreakdown {
    const safeAmount = Math.max(0, Number(taxableAmount) || 0);
    const safeRate = Math.max(0, Number(gstRate) || 0);

    if (safeAmount === 0 || safeRate === 0) {
      return {
        taxableAmount: safeAmount,
        gstRate: safeRate,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalGstAmount: 0,
        grossAmount: safeAmount,
      };
    }

    const totalGst = Number(((safeAmount * safeRate) / 100).toFixed(2));

    if (isInterState) {
      return {
        taxableAmount: safeAmount,
        gstRate: safeRate,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: safeRate,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: totalGst,
        totalGstAmount: totalGst,
        grossAmount: Number((safeAmount + totalGst).toFixed(2)),
      };
    }

    const halfRate = safeRate / 2;
    const halfGst = Number((totalGst / 2).toFixed(2));
    const remainder = Number((totalGst - halfGst).toFixed(2));

    return {
      taxableAmount: safeAmount,
      gstRate: safeRate,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,
      cgstAmount: halfGst,
      sgstAmount: remainder,
      igstAmount: 0,
      totalGstAmount: totalGst,
      grossAmount: Number((safeAmount + totalGst).toFixed(2)),
    };
  }

  /**
   * Aggregates tax across multiple line items.
   */
  static calculateAggregateTax(
    lines: LineTaxInput[],
    isInterState: boolean = false
  ): {
    totalTaxable: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    totalGst: number;
    grandTotal: number;
    lineBreakdowns: TaxBreakdown[];
  } {
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalGst = 0;

    const lineBreakdowns = (lines || []).map((line) => {
      const breakdown = this.calculateTax(line.amount, line.gstRate, isInterState || line.isInterState);
      totalTaxable = Number((totalTaxable + breakdown.taxableAmount).toFixed(2));
      totalCgst = Number((totalCgst + breakdown.cgstAmount).toFixed(2));
      totalSgst = Number((totalSgst + breakdown.sgstAmount).toFixed(2));
      totalIgst = Number((totalIgst + breakdown.igstAmount).toFixed(2));
      totalGst = Number((totalGst + breakdown.totalGstAmount).toFixed(2));
      return breakdown;
    });

    return {
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      grandTotal: Number((totalTaxable + totalGst).toFixed(2)),
      lineBreakdowns,
    };
  }
}
