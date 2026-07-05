import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ required: true })
  paymentNo: string;

  @Prop({ required: false, type: Types.ObjectId, ref: 'Bill' })
  billId?: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Customer' })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: true, default: 0 })
  totalPaid: number;

  @Prop({ required: true, default: 0 })
  cashAmount: number;

  @Prop({ required: true, default: 0 })
  upiAmount: number;

  @Prop({ required: false, default: 0 })
  excessCredit?: number;

  @Prop({ required: false })
  notes?: string;

  @Prop({ required: false, default: false })
  isRefund?: boolean;

  @Prop({
    required: false,
    enum: ['payment', 'refund', 'advance'],
    default: 'payment',
  })
  paymentType?: string;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
