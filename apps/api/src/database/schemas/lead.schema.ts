import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeadDocument = HydratedDocument<Lead>;

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, default: '' })
  visitorId: string;

  @Prop({ type: String, default: '' })
  name: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  email: string;

  @Prop({ type: Number, default: 0 })
  score: number;

  @Prop({
    type: String,
    enum: ['NEW', 'INTERESTED', 'HOT', 'PURCHASE_INTENT', 'SENT_TO_WHATSAPP', 'CONTACTED', 'SALE', 'LOST'],
    default: 'NEW',
  })
  status: string;

  @Prop({ type: [String], default: [] })
  interestedItems: string[];

  @Prop({ type: String, default: 'organic' })
  source: string;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
