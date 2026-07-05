import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class StaffPermissions {
  @Prop({ default: true }) billing: boolean;
  @Prop({ default: true }) customers: boolean;
  @Prop({ default: true }) advancePayments: boolean;
  @Prop({ default: false }) accounting: boolean;
  @Prop({ default: false }) analytics: boolean;
  @Prop({ default: false }) inventory: boolean;
  @Prop({ default: false }) ledger: boolean;
  @Prop({ default: false }) recurringBills: boolean;
  @Prop({ default: true }) receipt: boolean;
  @Prop({ default: true }) search: boolean;
  @Prop({ default: false }) dataManagement: boolean;
  @Prop({ default: false }) deletedBills: boolean;
  @Prop({ default: false }) settings: boolean;
}

@Schema({ _id: false })
export class LoyaltyTier {
  @Prop({ required: true }) from: number;
  @Prop({ required: true }) to: number;
  @Prop({ required: true }) points: number;
}

@Schema({ timestamps: true })
export class Settings extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Business', required: true, unique: true })
  businessId: Types.ObjectId;

  @Prop({ default: 0 })
  gstRate: number;

  @Prop({ default: 'monthly' })
  viewMode: string;

  @Prop({ type: StaffPermissions, default: () => ({}) })
  staffPermissions: StaffPermissions;

  @Prop({ default: true })
  loyaltyEnabled: boolean;

  @Prop({ default: 30 })
  loyaltyEarningRate: number;

  @Prop({ default: 150 })
  loyaltyRedeemRatioPoints: number;

  @Prop({ default: 5 })
  loyaltyRedeemRatioRupees: number;

  @Prop({
    type: [LoyaltyTier],
    default: () => [
      { from: 1, to: 40, points: 1 },
      { from: 41, to: 100, points: 2 },
    ],
  })
  loyaltyTiers: LoyaltyTier[];

  @Prop({ default: '#0f172a' })
  primaryColor: string;

  @Prop({ default: '' })
  logoUrl: string;

  @Prop({ default: '' })
  headerNotes: string;

  @Prop({ default: '' })
  footerNotes: string;

  @Prop({ default: true })
  showGstBreakdown: boolean;

  @Prop({ default: true })
  showUpiQrCode: boolean;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
