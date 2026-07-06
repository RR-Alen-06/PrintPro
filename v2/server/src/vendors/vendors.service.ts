import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vendor } from '../schemas/vendor.schema';

@Injectable()
export class VendorsService {
  constructor(
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
  ) {}

  async getVendors(businessId: string): Promise<Vendor[]> {
    const bId = new Types.ObjectId(businessId);
    return this.vendorModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .sort({ name: 1 })
      .exec();
  }

  async getVendor(businessId: string, id: string): Promise<Vendor> {
    const bId = new Types.ObjectId(businessId);
    const vendor = await this.vendorModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }
    return vendor;
  }

  async createVendor(businessId: string, data: Partial<Vendor>): Promise<Vendor> {
    const bId = new Types.ObjectId(businessId);
    const vendor = new this.vendorModel({
      ...data,
      businessId: bId,
    });
    return vendor.save();
  }

  async updateVendor(businessId: string, id: string, updates: Partial<Vendor>): Promise<Vendor> {
    const bId = new Types.ObjectId(businessId);
    const vendor = await this.vendorModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: updates },
        { new: true },
      )
      .exec();
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }
    return vendor;
  }

  async deleteVendor(businessId: string, id: string): Promise<Vendor> {
    const bId = new Types.ObjectId(businessId);
    const vendor = await this.vendorModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: { deleted: true } },
        { new: true },
      )
      .exec();
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }
    return vendor;
  }

  async adjustBalance(businessId: string, id: string, amount: number): Promise<Vendor> {
    const bId = new Types.ObjectId(businessId);
    const vendor = await this.vendorModel
      .findOne({ _id: new Types.ObjectId(id), businessId: bId })
      .exec();
    if (!vendor) {
      throw new NotFoundException('Vendor not found.');
    }
    vendor.outstandingBalance = (vendor.outstandingBalance || 0) + amount;
    return vendor.save();
  }
}
