import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class BillItem {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 0 })
  qty: number;

  @Prop({ required: true, default: 0 })
  unitPrice: number;

  @Prop({ required: true, default: 0 })
  subtotal: number;

  @Prop({ required: false, default: 0 })
  discountValue?: number;

  @Prop({ required: false, enum: ['flat', 'percent'], default: 'flat' })
  discountType?: string;

  @Prop({ required: false, default: 0 })
  discountAmount?: number;

  @Prop({ required: false, default: 0 })
  netSubtotal?: number;

  @Prop({ required: false, default: 0 })
  gstRate?: number;

  @Prop({ required: false, default: 0 })
  lineGst?: number;

  @Prop({ required: false, default: 0 })
  lineTotal?: number;
}

@Schema({ timestamps: true })
export class Bill extends Document {
  @Prop({ required: true, unique: true })
  billNo: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Customer' })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: false })
  dueDate?: string;

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

  @Prop({ required: true, default: 0 })
  amountPaid: number;

  @Prop({ required: true, default: 0 })
  balance: number;

  @Prop({
    required: true,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'unpaid',
  })
  status: string;

  @Prop({ required: true, type: [BillItem] })
  items: BillItem[];

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ required: false, default: false })
  isGroupParent?: boolean;

  @Prop({ required: false })
  groupBillId?: string;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const BillSchema = SchemaFactory.createForClass(Bill);
