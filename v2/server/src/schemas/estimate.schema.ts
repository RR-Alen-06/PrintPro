import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillItem } from './bill.schema';

@Schema({ timestamps: true })
export class Estimate extends Document {
  @Prop({ required: true, unique: true })
  estimateNo: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Customer' })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: false })
  validUntil?: string; // YYYY-MM-DD

  @Prop({ required: true, default: 0 })
  subtotal: number;

  @Prop({ required: true, default: 0 })
  discountAmount: number;

  @Prop({ required: false, enum: ['flat', 'percent'], default: 'flat' })
  discountType?: string;

  @Prop({ required: false, default: 0 })
  discountValue?: number;

  @Prop({ required: true, default: 0 })
  gstAmount: number;

  @Prop({ required: true, default: 0 })
  total: number;

  @Prop({
    required: true,
    enum: ['draft', 'sent', 'accepted', 'declined', 'invoiced'],
    default: 'draft',
  })
  status: string;

  @Prop({ required: true, type: [BillItem] })
  items: BillItem[];

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ required: false, default: false })
  deleted?: boolean;

  @Prop({ required: false })
  notes?: string;

  @Prop({ required: false })
  convertedBillId?: string; // ID of the generated Bill when accepted/converted
}

export const EstimateSchema = SchemaFactory.createForClass(Estimate);
