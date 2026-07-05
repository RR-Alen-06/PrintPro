import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer } from '../schemas/customer.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
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
}
