import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RecurringBill extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Customer' })
  customerId: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  amount: number;

  @Prop({ required: true, enum: ['weekly', 'monthly'], default: 'monthly' })
  frequency: string;

  @Prop({ required: true, default: 1 })
  dayOfMonth: number;

  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ required: false })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;
}

export const RecurringBillSchema = SchemaFactory.createForClass(RecurringBill);
