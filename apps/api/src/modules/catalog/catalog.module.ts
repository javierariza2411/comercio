import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Item, ItemSchema } from '../../database/schemas/item.schema';
import { Category, CategorySchema } from '../../database/schemas/category.schema';
import { ItemVariant, ItemVariantSchema } from '../../database/schemas/item-variant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Item.name, schema: ItemSchema },
      { name: Category.name, schema: CategorySchema },
      { name: ItemVariant.name, schema: ItemVariantSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
