import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ required: false, unique: true, sparse: true })
  supabaseId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Business', required: true })
  businessId: Types.ObjectId;

  @Prop({ required: true, enum: ['owner', 'staff'], default: 'owner' })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
