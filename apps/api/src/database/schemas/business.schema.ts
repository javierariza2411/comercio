import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BusinessDocument = HydratedDocument<Business>;

@Schema({ timestamps: true })
export class Business {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true })
  slug: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: String, default: '' })
  logoUrl: string;

  @Prop({ type: String, enum: ['PRODUCT', 'SERVICE', 'MIXED'], default: 'PRODUCT' })
  businessType: 'PRODUCT' | 'SERVICE' | 'MIXED';

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  whatsappNumber: string;

  @Prop({ type: String, default: '' })
  email: string;

  @Prop({ type: Object, default: {} })
  address: Record<string, any>;

  @Prop({ type: Object, default: {} })
  socialNetworks: Record<string, any>;

  @Prop({
    type: {
      primaryColor: { type: String, default: '#111827' },
      secondaryColor: { type: String, default: '#f59e0b' },
    },
    default: {},
  })
  branding: {
    primaryColor: string;
    secondaryColor: string;
  };

  @Prop({
    type: {
      currency: { type: String, default: 'COP' },
      locale: { type: String, default: 'es-CO' },
      timezone: { type: String, default: 'America/Bogota' },
    },
    default: {},
  })
  settings: {
    currency: string;
    locale: string;
    timezone: string;
  };

  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      aiEnabled: { type: Boolean, default: false },
      whatsappThreshold: { type: Number, default: 30 },
    },
    default: {},
  })
  chatSettings: {
    enabled: boolean;
    aiEnabled: boolean;
    whatsappThreshold: number;
  };
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
