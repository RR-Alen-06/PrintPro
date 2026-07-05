import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Customer extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  email?: string;

  @Prop({ required: true, default: 0 })
  advanceBalance: number;

  @Prop({ required: true, default: 0 })
  creditBalance: number;

  @Prop({ required: true, default: 0 })
  loyaltyPoints: number;

  @Prop({ required: true, enum: ['regular', 'random'], default: 'regular' })
  type: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Business' })
  businessId: Types.ObjectId;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
