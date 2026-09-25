import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ItemDocument = HydratedDocument<Item>;

@Schema({ timestamps: true })
export class Item {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true, index: true })
  categoryId: string;

  @Prop({ type: String, enum: ['PRODUCT', 'SERVICE'], required: true })
  type: 'PRODUCT' | 'SERVICE';

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: false })
  slug: string;

  @Prop({ type: String, default: '' })
  shortDescription: string;

  @Prop({ type: String, default: '' })
  description: string;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Number, default: 0 })
  compareAtPrice: number;

  @Prop({ type: String, default: 'COP' })
  currency: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: Boolean, default: false })
  featured: boolean;

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: Boolean, default: false })
  trackStock: boolean;

  @Prop({ type: Object, default: {} })
  attributes: Record<string, any>;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const ItemSchema = SchemaFactory.createForClass(Item);
