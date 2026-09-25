import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

@Schema({ timestamps: true })
export class ChatSession {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ type: String, default: '' })
  visitorId: string;

  @Prop({ type: String, default: '' })
  leadId: string;

  @Prop({ type: [Object], default: [] })
  messages: Array<Record<string, any>>;

  @Prop({ type: Boolean, default: false })
  resolved: boolean;

  @Prop({ type: String, default: 'UNKNOWN' })
  finalIntent: string;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
