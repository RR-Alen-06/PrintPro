import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Bill } from '../schemas/bill.schema';
import { Business } from '../schemas/business.schema';
import { Customer } from '../schemas/customer.schema';
import { Expense } from '../schemas/expense.schema';
import { Inventory } from '../schemas/inventory.schema';
import { Payment } from '../schemas/payment.schema';
import { Settings } from '../schemas/settings.schema';

@Injectable()
export class DataManagementService {
  constructor(
    @InjectModel(Bill.name) private billModel: Model<Bill>,
    @InjectModel(Business.name) private businessModel: Model<Business>,
    @InjectModel(Customer.name) private customerModel: Model<Customer>,
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    @InjectModel(Inventory.name) private inventoryModel: Model<Inventory>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Settings.name) private settingsModel: Model<Settings>,
  ) {}

  async exportData(businessId: string) {
    const bills = await this.billModel.find({ businessId }).lean().exec();
    const customers = await this.customerModel.find({ businessId }).lean().exec();
    const expenses = await this.expenseModel.find({ businessId }).lean().exec();
    const inventory = await this.inventoryModel.find({ businessId }).lean().exec();
    const payments = await this.paymentModel.find({ businessId }).lean().exec();
    const settings = await this.settingsModel.findOne({ businessId }).lean().exec();
    const business = await this.businessModel.findById(businessId).lean().exec();

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        business,
        settings,
        customers,
        inventory,
        bills,
        payments,
        expenses,
      },
    };
  }

  async importData(businessId: string, payload: any) {
    if (!payload || !payload.data) {
      throw new BadRequestException('Invalid payload format');
    }

    const { settings, customers, inventory, bills, payments, expenses } = payload.data;

    // We typically want to do this in a transaction, but for simplicity we will just clear and insert
    // Note: in a real production environment, you might want a more sophisticated merge/restore strategy
    // To ensure atomicity, using a session would be ideal if using a replica set
    
    // Clear existing data for this business
    await this.billModel.deleteMany({ businessId });
    await this.customerModel.deleteMany({ businessId });
    await this.expenseModel.deleteMany({ businessId });
    await this.inventoryModel.deleteMany({ businessId });
    await this.paymentModel.deleteMany({ businessId });
    if (settings) {
      await this.settingsModel.deleteMany({ businessId });
    }

    // Insert new data
    const mapWithBusinessId = (arr: any[]) => (arr || []).map(item => ({ ...item, businessId }));
    
    if (customers && customers.length) await this.customerModel.insertMany(mapWithBusinessId(customers));
    if (inventory && inventory.length) await this.inventoryModel.insertMany(mapWithBusinessId(inventory));
    if (bills && bills.length) await this.billModel.insertMany(mapWithBusinessId(bills));
    if (payments && payments.length) await this.paymentModel.insertMany(mapWithBusinessId(payments));
    if (expenses && expenses.length) await this.expenseModel.insertMany(mapWithBusinessId(expenses));
    
    if (settings) {
      await this.settingsModel.create({ ...settings, businessId });
    }

    return { success: true, message: 'Data imported successfully' };
  }
}
