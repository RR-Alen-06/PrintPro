import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment } from '../schemas/payment.schema';
import { Customer } from '../schemas/customer.schema';

export class CreateRefundDto {
  customerId!: string;
  amount!: number;
  paymentMethod?: string;
  date?: string;
  notes?: string;
}

@Injectable()
export class RefundsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
  ) {}

  async getRefunds(businessId: string): Promise<Payment[]> {
    const bId = new Types.ObjectId(businessId);
    return this.paymentModel
      .find({ businessId: bId, paymentType: 'refund' })
      .sort({ date: -1 })
      .populate('customerId', 'name')
      .exec();
  }

  async createRefund(
    businessId: string,
    data: CreateRefundDto,
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

    const amount = Number(data.amount);
    if (customer.advanceBalance < amount) {
      throw new BadRequestException(
        'Refund amount exceeds client advance balance.',
      );
    }

    // 2. Generate sequential Payment No
    const pCount = await this.paymentModel
      .countDocuments({ businessId: bId })
      .exec();
    const paymentNo = `PAY-${String(pCount + 1).padStart(4, '0')}`;

    const method = data.paymentMethod || 'cash';
    const cashAmount = method === 'cash' ? amount : 0;
    const upiAmount = method === 'upi' ? amount : 0;

    // 3. Create Payment document of type 'refund'
    const refund = new this.paymentModel({
      paymentNo,
      customerId: cId,
      date: data.date || new Date().toISOString().slice(0, 10),
      totalPaid: amount,
      cashAmount,
      upiAmount,
      isRefund: true,
      paymentType: 'refund',
      businessId: bId,
      notes: data.notes || 'Customer refund issued',
    });
    const savedRefund = await refund.save();

    // 4. Deduct Customer's advance balance
    customer.advanceBalance = Number(
      (customer.advanceBalance - amount).toFixed(2),
    );
    customer.creditBalance = customer.advanceBalance;
    await customer.save();

    return savedRefund;
  }
}
