import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer } from '../schemas/customer.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(WalletTransaction.name) private readonly walletTransactionModel: Model<WalletTransaction>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getCustomers(businessId: string): Promise<Customer[]> {
    const bId = new Types.ObjectId(businessId);
    return this.customerModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .exec();
  }

  async getCustomer(businessId: string, id: string): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const customer = await this.customerModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return customer;
  }

  async createCustomer(
    businessId: string,
    data: Partial<Customer>,
  ): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const customer = new this.customerModel({
      ...data,
      businessId: bId,
    });
    return customer.save();
  }

  async updateCustomer(
    businessId: string,
    id: string,
    updates: Partial<Customer>,
  ): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const customer = await this.customerModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: updates },
        { new: true },
      )
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return customer;
  }

  async deleteCustomer(businessId: string, id: string): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const customer = await this.customerModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: { deleted: true } },
        { new: true },
      )
      .exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }
    return customer;
  }

  async getWalletTransactions(businessId: string, customerId: string): Promise<WalletTransaction[]> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);
    return this.walletTransactionModel
      .find({ businessId: bId, customerId: cId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async depositToWallet(
    businessId: string,
    customerId: string,
    amount: number,
    notes?: string,
  ): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);

    const customer = await this.customerModel.findOne({ _id: cId, businessId: bId }).exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    customer.advanceBalance = (customer.advanceBalance || 0) + amount;
    await customer.save();

    const transaction = new this.walletTransactionModel({
      businessId: bId,
      customerId: cId,
      amount,
      type: 'deposit',
      notes,
    });
    await transaction.save();

    return customer;
  }

  async deductFromWallet(
    businessId: string,
    customerId: string,
    amount: number,
    referenceId?: string,
    notes?: string,
  ): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);

    const customer = await this.customerModel.findOne({ _id: cId, businessId: bId }).exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    // Allow overdraft? Usually no. Let's prevent it or allow it based on creditBalance
    if ((customer.advanceBalance || 0) < amount) {
      throw new Error('Insufficient wallet balance.');
    }

    customer.advanceBalance = (customer.advanceBalance || 0) - amount;
    const saved = await customer.save();

    // Trigger Notification for low balance alert
    if (saved.advanceBalance < 100) {
      try {
        await this.notificationsService.createNotification(
          businessId,
          customerId,
          'wallet_alert',
          `Your wallet balance has dropped below threshold: ₹${saved.advanceBalance.toFixed(2)}. Please recharge soon.`,
        );
      } catch (e) {
        console.error('Failed to trigger wallet low balance alert:', e);
      }
    }

    const transaction = new this.walletTransactionModel({
      businessId: bId,
      customerId: cId,
      amount: -amount,
      type: 'purchase',
      referenceId,
      notes,
    });
    await transaction.save();

    return saved;
  }

  async updateLoyaltyPoints(
    businessId: string,
    customerId: string,
    points: number,
  ): Promise<Customer> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(customerId);

    const customer = await this.customerModel.findOne({ _id: cId, businessId: bId }).exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    customer.loyaltyPoints = (customer.loyaltyPoints || 0) + points;
    await customer.save();
    return customer;
  }
}
