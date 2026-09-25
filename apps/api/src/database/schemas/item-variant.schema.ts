import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ItemVariantDocument = HydratedDocument<ItemVariant>;

@Schema({ timestamps: true })
export class ItemVariant {
  @Prop({ required: true, index: true })
  businessId: string;

  @Prop({ required: true, index: true })
  itemId: string;

  @Prop({ type: String, default: '' })
  sku: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, default: 0 })
  price: number;

  @Prop({ type: Number, default: 0 })
  stock: number;

  @Prop({ type: Object, default: {} })
  attributes: Record<string, any>;

  @Prop({ type: String, default: '' })
  imageUrl: string;

  @Prop({ type: Boolean, default: true })
  active: boolean;
}

export const ItemVariantSchema = SchemaFactory.createForClass(ItemVariant);
