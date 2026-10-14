import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

const STOPWORDS = new Set(['de', 'la', 'el', 'los', 'las', 'un', 'una', 'que', 'por', 'para', 'con', 'en', 'y', 'o', 'a', 'es', 'se', 'su', 'me', 'mi', 'al', 'del', 'lo', 'le', 'hay', 'como', 'cual', 'cuales', 'tienen', 'tiene']);

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9ñ]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, includeInactive = false) {
    return this.prisma.faq.findMany({
      where: includeInactive ? { tenantId } : { tenantId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(tenantId: string, dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: { ...dto, keywords: this.normalizeKeywords(dto.keywords), tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdateFaqDto) {
    await this.get(tenantId, id);
    return this.prisma.faq.update({
      where: { id },
      data: { ...dto, keywords: dto.keywords ? this.normalizeKeywords(dto.keywords) : undefined },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.get(tenantId, id);
    await this.prisma.faq.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Búsqueda léxica simple (sin regex sobre la entrada del usuario).
   * En Fase 1 se complementa con embeddings; esta función sigue siendo el "camino rápido" sin LLM.
   */
  async search(tenantId: string, query: string, limit = 5) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const faqs = await this.prisma.faq.findMany({ where: { tenantId, active: true } });
    return faqs
      .map((faq) => {
        const question = tokenize(faq.question);
        const answer = tokenize(faq.answer);
        const keywords = faq.keywords.map(normalizeText);
        let score = 0;
        for (const token of tokens) {
          if (keywords.includes(token)) score += 3;
          if (question.includes(token)) score += 2;
          if (answer.includes(token)) score += 1;
        }
        return { faq, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ faq, score }) => ({ ...faq, score }));
  }

  private async get(tenantId: string, id: string) {
    const faq = await this.prisma.faq.findFirst({ where: { id, tenantId } });
    if (!faq) throw new NotFoundException('FAQ no encontrada');
    return faq;
  }

  private normalizeKeywords(keywords?: string[]) {
    return [...new Set((keywords ?? []).map((k) => normalizeText(k.trim())).filter(Boolean))];
  }
}
