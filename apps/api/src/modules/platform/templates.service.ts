import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import {
  botSettingsSchema,
  brandingSchema,
  chatSettingsSchema,
  parseConfig,
  storefrontSchema,
  tenantSettingsSchema,
} from '../../config/tenant-config';

export interface TemplateConfig {
  branding?: unknown;
  settings?: unknown;
  chatSettings?: unknown;
  botSettings?: unknown;
  storefront?: unknown;
}

export interface TemplateContent {
  categories?: Array<{ name: string; slug: string; description?: string; sortOrder?: number }>;
  products?: Array<Record<string, unknown> & { name: string; slug: string; priceCents: number; categorySlug?: string }>;
  faqs?: Array<{ question: string; answer: string; keywords?: string[]; category?: string }>;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.industryTemplate.findMany({
      select: { id: true, code: true, name: true, description: true, isDefault: true },
      orderBy: { name: 'asc' },
    });
  }

  async getDefault() {
    return (await this.prisma.industryTemplate.findFirst({ where: { isDefault: true } })) ?? null;
  }

  async getByCodeOrId(codeOrId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codeOrId);
    const template = await this.prisma.industryTemplate.findFirst({ where: isUuid ? { id: codeOrId } : { code: codeOrId } });
    if (!template) throw new NotFoundException('Plantilla no encontrada');
    return template;
  }

  /** Configuración inicial de un tenant a partir de una plantilla (o de los defaults técnicos si no hay). */
  tenantDataFromTemplate(template: { id: string; config: Prisma.JsonValue } | null) {
    const config = (template?.config ?? {}) as TemplateConfig;
    return {
      templateId: template?.id,
      branding: parseConfig(brandingSchema, config.branding) as Prisma.InputJsonObject,
      settings: parseConfig(tenantSettingsSchema, config.settings) as Prisma.InputJsonObject,
      chatSettings: parseConfig(chatSettingsSchema, config.chatSettings) as Prisma.InputJsonObject,
      botSettings: parseConfig(botSettingsSchema, config.botSettings) as Prisma.InputJsonObject,
      storefront: parseConfig(storefrontSchema, config.storefront) as Prisma.InputJsonObject,
    };
  }

  /** Aplica contenido de ejemplo (categorías, productos, FAQs) a un tenant. Idempotente por slug. */
  async applyContent(tenantId: string, codeOrId: string) {
    const template = await this.getByCodeOrId(codeOrId);
    const content = (template.content ?? {}) as TemplateContent;
    const data = this.tenantDataFromTemplate(template);

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id: tenantId }, data });

      const categoryIds = new Map<string, string>();
      for (const category of content.categories ?? []) {
        const row = await tx.category.upsert({
          where: { tenantId_slug: { tenantId, slug: category.slug } },
          create: { ...category, tenantId },
          update: { name: category.name, description: category.description, sortOrder: category.sortOrder },
        });
        categoryIds.set(category.slug, row.id);
      }

      for (const { categorySlug, ...product } of content.products ?? []) {
        const payload = { ...product, categoryId: categorySlug ? categoryIds.get(categorySlug) : undefined } as Prisma.ProductUncheckedCreateInput;
        await tx.product.upsert({
          where: { tenantId_slug: { tenantId, slug: product.slug } },
          create: { ...payload, tenantId },
          update: payload,
        });
      }

      if (content.faqs?.length) {
        await tx.faq.deleteMany({ where: { tenantId, category: { startsWith: 'template:' } } });
        await tx.faq.createMany({
          data: content.faqs.map((faq, index) => ({
            ...faq,
            category: `template:${faq.category ?? 'general'}`,
            sortOrder: index,
            tenantId,
          })),
        });
      }
    });

    return { ok: true, template: template.code };
  }
}
