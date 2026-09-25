import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, enum: ['FREE_DEMO', 'STARTER', 'BUSINESS', 'PRO'], default: 'FREE_DEMO' })
  plan: 'FREE_DEMO' | 'STARTER' | 'BUSINESS' | 'PRO';

  @Prop({ type: String, default: 'ACTIVE' })
  status: string;

  @Prop({ type: Date, default: Date.now })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate?: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
