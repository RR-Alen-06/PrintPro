import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bill } from '../schemas/bill.schema';
import { Payment } from '../schemas/payment.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  async getSummary(
    businessId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    const bId = new Types.ObjectId(businessId);
    const dateFilter: Record<string, string> = {};
    if (startDate) {
      dateFilter['$gte'] = startDate;
    }
    if (endDate) {
      dateFilter['$lte'] = endDate;
    }

    const queryFilter: Record<string, any> = {
      businessId: bId,
      deleted: { $ne: true },
    };
    if (startDate || endDate) {
      queryFilter['date'] = dateFilter;
    }

    const bills = await this.billModel.find(queryFilter).exec();

    // 1. Sales Summary
    const count = bills.length;
    const totalRevenue = bills.reduce((sum, b) => sum + b.total, 0);
    const avgInvoice =
      count > 0 ? Number((totalRevenue / count).toFixed(2)) : 0;
    const totalDiscounts = bills.reduce((sum, b) => sum + b.discountAmount, 0);

    // 2. Customer Contribution Leaderboard
    const customerMap: Record<string, number> = {};
    bills.forEach((b) => {
      customerMap[b.customerName] =
        (customerMap[b.customerName] || 0) + b.total;
    });
    const customerContribution = Object.entries(customerMap)
      .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // 3. Payment Method Breakdown (Cash vs UPI)
    const paymentQueryFilter: Record<string, any> = { businessId: bId };
    if (startDate || endDate) {
      paymentQueryFilter['date'] = dateFilter;
    }
    const payments = await this.paymentModel.find(paymentQueryFilter).exec();
    let cashPayments = 0;
    let upiPayments = 0;
    payments.forEach((p) => {
      if (p.paymentType !== 'refund') {
        cashPayments += p.cashAmount;
        upiPayments += p.upiAmount;
      }
    });

    // 4. Print Item Volumes Breakdown
    const itemMap: Record<string, number> = {};
    bills.forEach((b) => {
      b.items.forEach((item) => {
        itemMap[item.name] = (itemMap[item.name] || 0) + item.qty;
      });
    });
    const itemsSold = Object.entries(itemMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    return {
      salesSummary: {
        revenue: Number(totalRevenue.toFixed(2)),
        count,
        avgInvoice,
        discounts: Number(totalDiscounts.toFixed(2)),
      },
      customerContribution,
      paymentSplits: {
        cash: Number(cashPayments.toFixed(2)),
        upi: Number(upiPayments.toFixed(2)),
      },
      itemsSold,
    };
  }
}
