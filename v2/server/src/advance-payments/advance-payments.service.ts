import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment } from '../schemas/payment.schema';
import { Customer } from '../schemas/customer.schema';

export class CreateAdvanceDto {
  customerId!: string;
  totalPaid!: number;
  cashAmount?: number;
  upiAmount?: number;
  date?: string;
  notes?: string;
}

@Injectable()
export class AdvancePaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
  ) {}

  async getAdvances(businessId: string): Promise<Payment[]> {
    const bId = new Types.ObjectId(businessId);
    return this.paymentModel
      .find({ businessId: bId, paymentType: 'advance' })
      .sort({ date: -1 })
      .populate('customerId', 'name')
      .exec();
  }

  async createAdvance(
    businessId: string,
    data: CreateAdvanceDto,
  ): Promise<Payment> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(data.customerId);

    // 1. Verify Customer exists
    const customer = await this.customerModel
      .findOne({ _id: cId, businessId: bId })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    // 2. Generate sequential Payment No
    const pCount = await this.paymentModel
      .countDocuments({ businessId: bId })
      .exec();
    const paymentNo = `PAY-${String(pCount + 1).padStart(4, '0')}`;

    const totalPaid = Number(data.totalPaid);
    const cashAmount = Number(data.cashAmount || 0);
    const upiAmount = Number(data.upiAmount || 0);

    // 3. Create Payment document of type 'advance'
    const advance = new this.paymentModel({
      paymentNo,
      customerId: cId,
      date: data.date || new Date().toISOString().slice(0, 10),
      totalPaid,
      cashAmount,
      upiAmount,
      paymentType: 'advance',
      businessId: bId,
      notes: data.notes || 'Advance deposit received',
    });
    const savedAdvance = await advance.save();

    // 4. Update Customer's advance balance
    customer.advanceBalance = Number(
      (customer.advanceBalance + totalPaid).toFixed(2),
    );
    customer.creditBalance = customer.advanceBalance;
    await customer.save();

    return savedAdvance;
  }
}
