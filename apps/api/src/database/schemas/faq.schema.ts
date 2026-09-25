import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FaqDocument = HydratedDocument<Faq>;

@Schema({ timestamps: true })
export class Faq {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true, trim: true })
  question: string;

  @Prop({ required: true, trim: true })
  answer: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: String, default: 'general' })
  category: string;

  @Prop({ type: Boolean, default: true })
  active: boolean;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
