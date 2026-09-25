import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InteractionDocument = HydratedDocument<Interaction>;

@Schema({ timestamps: true })
export class Interaction {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, default: '' })
  visitorId: string;

  @Prop({ type: String, default: '' })
  leadId: string;

  @Prop({
    type: String,
    enum: ['PAGE_VIEW', 'SEARCH', 'FAQ_QUERY', 'ITEM_VIEW', 'PRICE_QUERY', 'STOCK_QUERY', 'CHAT_QUERY', 'PURCHASE_INTENT', 'WHATSAPP_REDIRECT', 'SALE'],
    required: true,
  })
  type: string;

  @Prop({ type: String, default: '' })
  itemId: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const InteractionSchema = SchemaFactory.createForClass(Interaction);
