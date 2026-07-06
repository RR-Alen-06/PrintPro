import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class WalletTransaction extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  amount: number; // positive for deposit/refund, negative for payment deduction

  @Prop({ required: true, enum: ['deposit', 'purchase', 'refund', 'adjustment'] })
  type: string;

  @Prop({ required: false })
  referenceId?: string; // e.g. Payment ID or Invoice ID

  @Prop({ required: false })
  notes?: string;
}

export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);
