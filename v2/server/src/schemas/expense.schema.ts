import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Expense extends Document {
  @Prop({ required: true })
  expenseNo: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, default: 0 })
  amount: number;

  @Prop({ required: true, default: 0 })
  cashAmount: number;

  @Prop({ required: true, default: 0 })
  upiAmount: number;

  @Prop({ required: true })
  date: string; // YYYY-MM-DD

  @Prop({ required: false })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: false })
  vendorId?: Types.ObjectId;

  @Prop({ required: false })
  receiptUrl?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
