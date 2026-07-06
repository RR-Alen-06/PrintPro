import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Estimate } from '../schemas/estimate.schema';
import { Customer } from '../schemas/customer.schema';
import { Bill } from '../schemas/bill.schema';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class EstimatesService {
  constructor(
    @InjectModel(Estimate.name) private readonly estimateModel: Model<Estimate>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Bill.name) private readonly billModel: Model<Bill>,
    private readonly billingService: BillingService,
  ) {}

  async getEstimates(businessId: string): Promise<Estimate[]> {
    const bId = new Types.ObjectId(businessId);
    return this.estimateModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getEstimate(businessId: string, id: string): Promise<Estimate> {
    const bId = new Types.ObjectId(businessId);
    const estimate = await this.estimateModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!estimate) {
      throw new NotFoundException('Estimate not found.');
    }
    return estimate;
  }

  async createEstimate(businessId: string, data: any): Promise<Estimate> {
    const bId = new Types.ObjectId(businessId);
    const cId = new Types.ObjectId(data.customerId);

    const customer = await this.customerModel.findOne({ _id: cId, businessId: bId }).exec();
    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const count = await this.estimateModel.countDocuments({ businessId: bId }).exec();
    const estimateNo = `EST-${String(count + 1).padStart(4, '0')}`;

    const estimate = new this.estimateModel({
      ...data,
      estimateNo,
      customerName: customer.name,
      businessId: bId,
    });
    return estimate.save();
  }

  async updateEstimate(businessId: string, id: string, updates: any): Promise<Estimate> {
    const bId = new Types.ObjectId(businessId);
    const estimate = await this.estimateModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: updates },
        { new: true },
      )
      .exec();
    if (!estimate) {
      throw new NotFoundException('Estimate not found.');
    }
    return estimate;
  }

  async deleteEstimate(businessId: string, id: string): Promise<Estimate> {
    const bId = new Types.ObjectId(businessId);
    const estimate = await this.estimateModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: { deleted: true } },
        { new: true },
      )
      .exec();
    if (!estimate) {
      throw new NotFoundException('Estimate not found.');
    }
    return estimate;
  }

  async convertToInvoice(
    businessId: string,
    id: string,
    paymentDetails: { amountPaid: number; cashPaid: number; upiPaid: number; advanceUsed: number },
  ): Promise<Bill> {
    const bId = new Types.ObjectId(businessId);
    const estimate = await this.estimateModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!estimate) {
      throw new NotFoundException('Estimate not found.');
    }
    if (estimate.status === 'invoiced') {
      throw new BadRequestException('Estimate has already been converted to an invoice.');
    }

    // Call Invoicing service to create a Bill from this estimate
    const bill = await this.billingService.createInvoice(businessId, {
      customerId: estimate.customerId.toString(),
      items: estimate.items.map(item => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountValue: item.discountValue,
        discountType: item.discountType,
        gstRate: item.gstRate,
      })),
      discountValue: estimate.discountValue,
      discountType: estimate.discountType,
      amountPaid: paymentDetails.amountPaid,
      cashPaid: paymentDetails.cashPaid,
      upiPaid: paymentDetails.upiPaid,
      advanceUsed: paymentDetails.advanceUsed,
    });

    estimate.status = 'invoiced';
    estimate.convertedBillId = bill._id.toString();
    await estimate.save();

    return bill;
  }
}
