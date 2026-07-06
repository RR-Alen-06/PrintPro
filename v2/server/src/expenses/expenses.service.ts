import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense } from '../schemas/expense.schema';

import { VendorsService } from '../vendors/vendors.service';

export class CreateExpenseDto {
  title!: string;
  category?: string;
  date?: string;
  cashAmount?: number;
  upiAmount?: number;
  description?: string;
  vendorId?: string;
  receiptUrl?: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    private readonly vendorsService: VendorsService,
  ) {}

  async getExpenses(businessId: string): Promise<Expense[]> {
    const bId = new Types.ObjectId(businessId);
    return this.expenseModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ date: -1 })
      .exec();
  }

  async createExpense(
    businessId: string,
    data: CreateExpenseDto,
  ): Promise<Expense> {
    const bId = new Types.ObjectId(businessId);

    // 1. Generate sequential expenseNo
    const eCount = await this.expenseModel
      .countDocuments({ businessId: bId })
      .exec();
    const expenseNo = `EXP-${String(eCount + 1).padStart(4, '0')}`;

    const cashAmount = Number(data.cashAmount || 0);
    const upiAmount = Number(data.upiAmount || 0);
    const amount = Number((cashAmount + upiAmount).toFixed(2));

    const expense = new this.expenseModel({
      expenseNo,
      title: data.title,
      category: data.category || 'other',
      amount,
      cashAmount,
      upiAmount,
      date: data.date || new Date().toISOString().slice(0, 10),
      notes: data.description || '',
      businessId: bId,
      vendorId: data.vendorId ? new Types.ObjectId(data.vendorId) : undefined,
      receiptUrl: data.receiptUrl,
    });

    const saved = await expense.save();

    // Accounts Payable: Increase vendor outstanding balance
    if (data.vendorId) {
      await this.vendorsService.adjustBalance(businessId, data.vendorId, amount);
    }

    return saved;
  }
}
