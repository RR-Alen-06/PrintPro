import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bill } from '../schemas/bill.schema';
import { Payment } from '../schemas/payment.schema';
import { Expense } from '../schemas/expense.schema';
import { Customer } from '../schemas/customer.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
  ) {}

  async getDashboardSummary(businessId: string) {
    const bId = new Types.ObjectId(businessId);

    // 1. Fetch active bills (excluding deleted and group parent bills)
    const activeBills = await this.billModel
      .find({
        businessId: bId,
        deleted: { $ne: true },
        isGroupParent: { $ne: true },
      })
      .exec();

    // 2. Fetch payments (excluding those containing 'from advance deposit')
    const payments = await this.paymentModel
      .find({
        businessId: bId,
        notes: { $not: /from advance deposit/i },
      })
      .exec();

    // 3. Fetch expenses
    const expenses = await this.expenseModel
      .find({
        businessId: bId,
      })
      .exec();

    // 4. Fetch customers
    const customers = await this.customerModel
      .find({
        businessId: bId,
        deleted: { $ne: true },
      })
      .exec();

    // Calculations:
    // Revenue = SUM(Finalized Invoice Grand Totals)
    const revenue = activeBills.reduce(
      (sum, b) => sum + Number(b.total || 0),
      0,
    );

    // Cash Inflow = SUM(CustomerPayments) [excluding FIFO payment lines containing 'from advance deposit']
    const cashInflow = payments
      .filter(
        (p) => !p.isRefund && p.paymentType !== 'refund' && p.totalPaid > 0,
      )
      .reduce((sum, p) => sum + Number(p.totalPaid || 0), 0);

    // Pending Dues = SUM(max(0, Invoice Total - Invoice Paid))
    const pendingDues = activeBills.reduce(
      (sum, b) =>
        sum + Math.max(0, Number(b.total || 0) - Number(b.amountPaid || 0)),
      0,
    );

    // Refunds = SUM(Refunds)
    const refunds = payments
      .filter(
        (p) => p.isRefund || p.paymentType === 'refund' || p.totalPaid < 0,
      )
      .reduce((sum, p) => sum + Math.abs(Number(p.totalPaid || 0)), 0);

    // Total Customer Advance
    const totalCustomerAdvance = customers.reduce(
      (sum, c) => sum + Number(c.advanceBalance || c.creditBalance || 0),
      0,
    );

    // Net Profit = Revenue - Expenses
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0,
    );
    const netProfit = revenue - totalExpenses;

    // Net Cash Flow = Cash Inflow - Refunds - Expenses
    const netCashFlow = cashInflow - refunds - totalExpenses;

    // Get overdue bills count
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueBillsCount = activeBills.filter(
      (b) => b.balance > 0 && b.dueDate && b.dueDate < todayStr,
    ).length;

    // Recent bills (limit 6)
    const recentBills = await this.billModel
      .find({
        businessId: bId,
        deleted: { $ne: true },
        isGroupParent: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .exec();

    return {
      revenue,
      cashInflow,
      pendingDues,
      refunds,
      totalCustomerAdvance,
      netProfit,
      netCashFlow,
      overdueBillsCount,
      recentBills: recentBills.map((b) => ({
        id: b.billNo,
        customerName: b.customerName,
        date: b.date,
        total: b.total,
        amountPaid: b.amountPaid,
        balance: b.balance,
        status: b.status,
      })),
      totalCustomers: customers.length,
      paidBillsCount: activeBills.filter((b) => b.status === 'paid').length,
      partialBillsCount: activeBills.filter((b) => b.status === 'partial')
        .length,
      unpaidBillsCount: activeBills.filter((b) => b.status === 'unpaid').length,
    };
  }
}
