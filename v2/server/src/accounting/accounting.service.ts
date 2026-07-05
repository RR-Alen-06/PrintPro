import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment } from '../schemas/payment.schema';
import { Expense } from '../schemas/expense.schema';
import { Bill } from '../schemas/bill.schema';

interface CustomerPopulated {
  _id: string;
  name: string;
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
  ) {}

  async getTransactions(
    businessId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const bId = new Types.ObjectId(businessId);
    const dateFilter: Record<string, string> = {};
    if (startDate) {
      dateFilter['$gte'] = startDate;
    }
    if (endDate) {
      dateFilter['$lte'] = endDate;
    }

    const queryFilter: Record<string, any> = { businessId: bId };
    if (startDate || endDate) {
      queryFilter['date'] = dateFilter;
    }

    // Fetch payments and expenses
    const payments = await this.paymentModel
      .find(queryFilter)
      .populate<{ customerId: CustomerPopulated }>('customerId', 'name')
      .exec();
    const expenses = await this.expenseModel.find(queryFilter).exec();

    // Map payments to generic transactions
    const paymentTx = payments.map((p) => {
      const customer = p.customerId;
      return {
        _id: p._id,
        id: p.paymentNo,
        date: p.date,
        type: p.paymentType || 'payment',
        title: customer ? customer.name : 'Client Payment',
        amount: p.totalPaid,
        cashAmount: p.cashAmount,
        upiAmount: p.upiAmount,
        notes: p.notes,
      };
    });

    // Map expenses to generic transactions
    const expenseTx = expenses.map((e) => ({
      _id: e._id,
      id: e.expenseNo,
      date: e.date,
      type: 'expense',
      title: e.title,
      amount: e.amount,
      cashAmount: e.cashAmount,
      upiAmount: e.upiAmount,
      notes: e.notes,
    }));

    // Combine and sort descending by date
    const combined = [...paymentTx, ...expenseTx];
    combined.sort((a, b) => b.date.localeCompare(a.date));

    return combined;
  }

  async getPeriodSummary(
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

    const queryFilter: Record<string, any> = { businessId: bId };
    if (startDate || endDate) {
      queryFilter['date'] = dateFilter;
    }

    // Fetch payments, expenses and bills
    const payments = await this.paymentModel.find(queryFilter).exec();
    const expenses = await this.expenseModel.find(queryFilter).exec();
    const bills = await this.billModel.find(queryFilter).exec();

    let cashInflow = 0;
    let upiInflow = 0;
    let refundsCash = 0;
    let refundsUpi = 0;

    payments.forEach((p) => {
      if (p.paymentType === 'refund') {
        refundsCash += p.cashAmount;
        refundsUpi += p.upiAmount;
      } else {
        // payment or advance
        cashInflow += p.cashAmount;
        upiInflow += p.upiAmount;
      }
    });

    let expensesCash = 0;
    let expensesUpi = 0;
    expenses.forEach((e) => {
      expensesCash += e.cashAmount;
      expensesUpi += e.upiAmount;
    });

    const revenue = bills.reduce((sum, b) => sum + b.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalRefunds = refundsCash + refundsUpi;

    const profit = Number((revenue - totalExpenses).toFixed(2));
    const netInflow = Number(
      (cashInflow + upiInflow - totalRefunds - totalExpenses).toFixed(2),
    );

    return {
      revenue,
      cashInflow,
      upiInflow,
      totalRefunds,
      totalExpenses,
      netInflow,
      profit,
      splits: {
        cashInflow,
        upiInflow,
        refundsCash,
        refundsUpi,
        expensesCash,
        expensesUpi,
      },
    };
  }
}
