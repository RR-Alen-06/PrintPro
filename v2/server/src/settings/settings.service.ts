import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Settings } from '../schemas/settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name) private readonly settingsModel: Model<Settings>,
  ) {}

  async getSettings(businessId: string): Promise<Settings> {
    const bId = new Types.ObjectId(businessId);
    let settings = await this.settingsModel.findOne({ businessId: bId }).exec();
    if (!settings) {
      settings = new this.settingsModel({ businessId: bId });
      await settings.save();
    }
    return settings;
  }

  async updateSettings(
    businessId: string,
    updates: Partial<Settings>,
  ): Promise<Settings> {
    const bId = new Types.ObjectId(businessId);
    let settings = await this.settingsModel.findOne({ businessId: bId }).exec();
    if (!settings) {
      settings = new this.settingsModel({ businessId: bId, ...updates });
    } else {
      settings.set(updates);
    }
    return settings.save();
  }
}
