import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '../../common/slugify';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/catalog.dto';

const PUBLIC_PRODUCT_SELECT = {
  id: true,
  categoryId: true,
  type: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  priceCents: true,
  compareAtPriceCents: true,
  currency: true,
  images: true,
  featured: true,
  stock: true,
  trackStock: true,
  attributes: true,
  tags: true,
  variants: {
    where: { active: true },
    select: { id: true, name: true, sku: true, priceCents: true, stock: true, attributes: true, imageUrl: true },
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  // ---------- Público ----------

  async getPublicCatalog(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');

    const [categories, products] = await Promise.all([
      this.prisma.category.findMany({
        where: { tenantId: tenant.id, active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, slug: true, description: true, parentId: true },
      }),
      this.prisma.product.findMany({
        where: { tenantId: tenant.id, active: true },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        select: PUBLIC_PRODUCT_SELECT,
      }),
    ]);
    return { categories, products };
  }

  // ---------- Categorías ----------

  listCategories(tenantId: string) {
    return this.prisma.category.findMany({ where: { tenantId }, orderBy: { sortOrder: 'asc' } });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    const slug = dto.slug ?? slugify(dto.name);
    await this.assertCategorySlugFree(tenantId, slug);
    if (dto.parentId) await this.getCategory(tenantId, dto.parentId);
    return this.prisma.category.create({ data: { ...dto, slug, tenantId } });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    await this.getCategory(tenantId, id);
    if (dto.slug) await this.assertCategorySlugFree(tenantId, dto.slug, id);
    if (dto.parentId) await this.getCategory(tenantId, dto.parentId);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async deleteCategory(tenantId: string, id: string) {
    await this.getCategory(tenantId, id);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Productos ----------

  listProducts(tenantId: string, query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = { tenantId };
    if (!query.includeInactive) where.active = true;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { tags: { has: query.search.toLowerCase() } },
      ];
    }
    return this.prisma.product.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      include: { variants: true },
    });
  }

  async getProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, tenantId }, include: { variants: true } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    const slug = dto.slug ?? slugify(dto.name);
    await this.assertProductSlugFree(tenantId, slug);
    await this.assertPlanLimits(tenantId, dto, true);
    if (dto.categoryId) await this.getCategory(tenantId, dto.categoryId);
    return this.prisma.product.create({
      data: { ...dto, ...this.jsonFields(dto), slug, tenantId },
      include: { variants: true },
    });
  }

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    await this.getProduct(tenantId, id);
    await this.assertPlanLimits(tenantId, dto, false);
    if (dto.slug) await this.assertProductSlugFree(tenantId, dto.slug, id);
    if (dto.categoryId) await this.getCategory(tenantId, dto.categoryId);
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, ...this.jsonFields(dto) },
      include: { variants: true },
    });
  }

  async deleteProduct(tenantId: string, id: string) {
    await this.getProduct(tenantId, id);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Variantes ----------

  async createVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    await this.getProduct(tenantId, productId);
    return this.prisma.productVariant.create({
      data: { ...dto, attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue, tenantId, productId },
    });
  }

  async updateVariant(tenantId: string, id: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id, tenantId } });
    if (!variant) throw new NotFoundException('Variante no encontrada');
    return this.prisma.productVariant.update({
      where: { id },
      data: { ...dto, attributes: dto.attributes as Prisma.InputJsonValue | undefined },
    });
  }

  async deleteVariant(tenantId: string, id: string) {
    const deleted = await this.prisma.productVariant.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) throw new NotFoundException('Variante no encontrada');
    return { ok: true };
  }

  // ---------- Helpers ----------

  private async assertPlanLimits(tenantId: string, dto: CreateProductDto | UpdateProductDto, creating: boolean) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } });
    const limits = await this.plans.getLimits(tenant.plan);
    if (dto.images && dto.images.length > limits.imagesPerProduct) {
      throw new ConflictException(`Tu plan permite hasta ${limits.imagesPerProduct} imágenes por producto`);
    }
    if (creating) {
      const count = await this.prisma.product.count({ where: { tenantId } });
      if (count >= limits.productsMax) throw new ConflictException(`Tu plan permite hasta ${limits.productsMax} productos`);
    }
  }

  private jsonFields(dto: CreateProductDto | UpdateProductDto) {
    return {
      attributes: dto.attributes as Prisma.InputJsonValue | undefined,
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
    };
  }

  private async getCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  private async assertCategorySlugFree(tenantId: string, slug: string, exceptId?: string) {
    const existing = await this.prisma.category.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) throw new ConflictException(`Ya existe una categoría con el slug "${slug}"`);
  }

  private async assertProductSlugFree(tenantId: string, slug: string, exceptId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) throw new ConflictException(`Ya existe un producto con el slug "${slug}"`);
  }
}
