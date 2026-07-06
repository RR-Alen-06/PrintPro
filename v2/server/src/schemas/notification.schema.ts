import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Customer', required: true })
  customerId: Types.ObjectId;

  @Prop({ required: true })
  customerName: string;

  @Prop({ required: true, enum: ['job_status', 'wallet_alert'] })
  type: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: false, default: false })
  read?: boolean;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
