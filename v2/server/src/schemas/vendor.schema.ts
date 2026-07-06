import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Vendor extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: false })
  contactPerson?: string;

  @Prop({ required: true, default: 0 })
  outstandingBalance: number; // Accounts Payable

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
