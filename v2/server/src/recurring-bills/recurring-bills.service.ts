import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecurringBill } from '../schemas/recurring-bill.schema';

export class CreateRecurringBillDto {
  customerId!: string;
  amount!: number;
  frequency!: string;
  dayOfMonth!: number;
  startDate!: string;
  active!: boolean;
  description?: string;
}

@Injectable()
export class RecurringBillsService {
  constructor(
    @InjectModel(RecurringBill.name)
    private readonly recurringBillModel: Model<RecurringBill>,
  ) {}

  async getRecurringBills(businessId: string): Promise<RecurringBill[]> {
    const bId = new Types.ObjectId(businessId);
    return this.recurringBillModel
      .find({ businessId: bId })
      .populate('customerId', 'name type')
      .exec();
  }

  async createRecurringBill(
    businessId: string,
    data: CreateRecurringBillDto,
  ): Promise<RecurringBill> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(data.customerId);

    const recurring = new this.recurringBillModel({
      ...data,
      customerId: cId,
      businessId: bId,
    });
    return recurring.save();
  }

  async deleteRecurringBill(businessId: string, id: string): Promise<any> {
    const bId = new Types.ObjectId(businessId);
    const rId = new Types.ObjectId(id);

    const result = await this.recurringBillModel
      .deleteOne({ _id: rId, businessId: bId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Recurring bill profile not found.');
    }
    return { success: true };
  }
}
