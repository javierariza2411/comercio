import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UsageMetricDocument = HydratedDocument<UsageMetric>;

@Schema({ timestamps: true })
export class UsageMetric {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, required: true })
  period: string;

  @Prop({ type: Number, default: 0 })
  pageViews: number;

  @Prop({ type: Number, default: 0 })
  queries: number;

  @Prop({ type: Number, default: 0 })
  faqQueries: number;

  @Prop({ type: Number, default: 0 })
  productQueries: number;

  @Prop({ type: Number, default: 0 })
  aiQueries: number;

  @Prop({ type: Number, default: 0 })
  whatsappRedirects: number;

  @Prop({ type: Number, default: 0 })
  leads: number;

  @Prop({ type: Number, default: 0 })
  sales: number;
}

export const UsageMetricSchema = SchemaFactory.createForClass(UsageMetric);
