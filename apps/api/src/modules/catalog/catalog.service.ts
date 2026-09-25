import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Item, ItemDocument } from '../../database/schemas/item.schema';
import { Category, CategoryDocument } from '../../database/schemas/category.schema';
import { ItemVariant, ItemVariantDocument } from '../../database/schemas/item-variant.schema';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Item.name) private readonly itemModel: Model<ItemDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(ItemVariant.name) private readonly itemVariantModel: Model<ItemVariantDocument>,
  ) {}

  async getPublicCatalogByBusinessSlug(businessSlug: string) {
    const items = await this.itemModel.find({ active: true }).lean().exec();
    return items;
  }

  async getItemsByBusiness(businessId: string) {
    return this.itemModel.find({ businessId, active: true }).exec();
  }

  async getItemBySlug(businessId: string, slug: string) {
    const item = await this.itemModel.findOne({ businessId, slug, active: true }).exec();
    if (!item) {
      throw new NotFoundException('Producto o servicio no encontrado');
    }

    const variants = await this.itemVariantModel.find({ businessId, itemId: item._id.toString(), active: true }).exec();
    return { item, variants };
  }

  async createItem(payload: any) {
    return this.itemModel.create(payload);
  }

  async createCategory(payload: any) {
    return this.categoryModel.create(payload);
  }
}
