import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Inventory extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 0 })
  colorSingle: number;

  @Prop({ required: true, default: 0 })
  colorDouble: number;

  @Prop({ required: true, default: 0 })
  bwSingle: number;

  @Prop({ required: true, default: 0 })
  bwDouble: number;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ required: false, default: false })
  deleted?: boolean;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
