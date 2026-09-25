import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, enum: ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'SELLER'], default: 'BUSINESS_ADMIN' })
  role: 'SUPER_ADMIN' | 'BUSINESS_ADMIN' | 'SELLER';

  @Prop({ type: String, default: 'ACTIVE' })
  status: string;

  @Prop({ type: String, required: true, index: true })
  businessId: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
