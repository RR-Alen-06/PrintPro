import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillItem } from './bill.schema';

@Schema({ timestamps: true })
export class Job extends Document {
  @Prop({ required: true, unique: true })
  jobNo: string;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ type: Types.ObjectId, ref: 'Bill', required: false })
  billId?: Types.ObjectId;

  @Prop({ required: false })
  billNo?: string;

  @Prop({
    required: true,
    enum: ['pending', 'designing', 'printing', 'finishing', 'completed', 'delivered'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true, type: [BillItem] })
  items: BillItem[];

  @Prop({ required: false })
  dueDate?: string;

  @Prop({ required: false })
  notes?: string;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const JobSchema = SchemaFactory.createForClass(Job);
