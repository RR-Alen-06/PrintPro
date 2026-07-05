import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inventory } from '../schemas/inventory.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<Inventory>,
  ) {}

  async getItems(businessId: string): Promise<Inventory[]> {
    const bId = new Types.ObjectId(businessId);
    return this.inventoryModel
      .find({ businessId: bId, deleted: { $ne: true } })
      .exec();
  }

  async createItem(
    businessId: string,
    data: Partial<Inventory>,
  ): Promise<Inventory> {
    const bId = new Types.ObjectId(businessId);
    const item = new this.inventoryModel({
      ...data,
      businessId: bId,
    });
    return item.save();
  }

  async updateItem(
    businessId: string,
    id: string,
    updates: Partial<Inventory>,
  ): Promise<Inventory> {
    const bId = new Types.ObjectId(businessId);
    const item = await this.inventoryModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: updates },
        { new: true },
      )
      .exec();
    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }
    return item;
  }

  async deleteItem(businessId: string, id: string): Promise<Inventory> {
    const bId = new Types.ObjectId(businessId);
    const item = await this.inventoryModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), businessId: bId },
        { $set: { deleted: true } },
        { new: true },
      )
      .exec();
    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }
    return item;
  }
}
