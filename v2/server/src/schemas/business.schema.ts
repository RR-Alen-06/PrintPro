import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Business extends Document {
  @Prop({ required: true })
  shopName: string;

  @Prop({ required: true })
  ownerName: string;

  @Prop({ required: false })
  phone?: string;

  @Prop({ required: false })
  address?: string;

  @Prop({ required: false })
  gstin?: string;

  @Prop({ required: false })
  upiId?: string;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
