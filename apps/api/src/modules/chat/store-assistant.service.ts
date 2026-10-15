import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageRole, MessageType, Prisma } from '@prisma/client';
import { formatMoney } from '@smartcommerce/shared';
import { parseConfig, chatSettingsSchema, tenantSettingsSchema } from '../../config/tenant-config';
import { PrismaService } from '../../prisma/prisma.module';
import { FaqService, normalizeText, tokenize } from '../faq/faq.service';
import { ChatService } from './chat.service';

export type AssistantReply = {
  text: string;
  intent: string;
  resolved: boolean;
  replies: string[];
  products?: Array<{ name: string; slug: string; description: string; priceCents: number; compareAtPriceCents: number | null; currency: string; imageUrl: string | null }>;
  handoff?: boolean;
};

const DEFAULT_REPLIES = ['Recomiéndame un producto', 'Ofertas vigentes', 'Envíos', 'Garantía y devoluciones', 'Medios de pago'];

@Injectable()
export class StoreAssistantService {
  constructor(private readonly prisma: PrismaService, private readonly faq: FaqService, private readonly chat: ChatService) {}

  async reply(tenantId: string, conversationId: string, rawText: string): Promise<AssistantReply> {
    const text = rawText.trim();
    const normalized = normalizeText(text);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, settings: true, chatSettings: true, paymentSettings: true, whatsappNumber: true } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    const chatSettings = parseConfig(chatSettingsSchema, tenant.chatSettings);
    const settings = parseConfig(tenantSettingsSchema, tenant.settings);
    const replies = chatSettings.quickReplies.length ? chatSettings.quickReplies : DEFAULT_REPLIES;

    let result: AssistantReply;
    if (/^(hola|buenas|buenos dias|buenas tardes|hey|inicio)$/.test(normalized)) {
      result = { text: chatSettings.welcomeMessage, intent: 'GREETING', resolved: true, replies };
    } else if (/asesor|persona|humano|whatsapp|hablar con/.test(normalized)) {
      result = { text: tenant.whatsappNumber ? 'Claro. Te conecto con un asesor por WhatsApp.' : 'Solicité atención de una persona del equipo. Te responderán tan pronto como sea posible.', intent: 'HUMAN_HANDOFF', resolved: true, replies: ['Seguir consultando productos'], handoff: true };
      await this.chat.requestHandoff(tenantId, conversationId, 'deterministic_assistant');
    } else if (/pago|pagar|tarjeta|pse|transferencia|cuenta bancaria|mercado pago/.test(normalized)) {
      const payment = tenant.paymentSettings as { bankTransferEnabled?: boolean } | null;
      result = { text: payment?.bankTransferEnabled ? 'Puedes crear el pedido y pagar mediante transferencia bancaria. Los datos oficiales de la cuenta aparecen únicamente después de confirmar el pedido.' : 'Los medios de pago todavía no están publicados. Puedes solicitar ayuda de un asesor.', intent: 'PAYMENT_METHODS', resolved: true, replies: ['Crear un pedido', 'Envíos', 'Hablar con un asesor'] };
    } else if (/oferta|ofertas|descuento|promocion|rebaja/.test(normalized)) {
      const products = await this.products(tenantId, '', true);
      result = products.length
        ? { text: `Encontré ${products.length} producto${products.length === 1 ? '' : 's'} con precio promocional:`, intent: 'ACTIVE_OFFERS', resolved: true, replies: ['Ver más productos', 'Envíos'], products }
        : { text: 'No hay ofertas publicadas en este momento.', intent: 'ACTIVE_OFFERS', resolved: true, replies: ['Recomiéndame un producto', 'Hablar con un asesor'] };
    } else if (/envio|entrega|domicilio|cuanto tarda|demora|llega/.test(normalized)) {
      const zones = await this.prisma.shippingZone.findMany({ where: { tenantId, active: true }, orderBy: { priceCents: 'asc' }, take: 5 });
      result = zones.length
        ? { text: zones.map((zone) => `${zone.name}: ${zone.priceCents ? formatMoney(zone.priceCents, settings.currency, settings.locale) : 'gratis'}, de ${zone.etaMinDays} a ${zone.etaMaxDays} días hábiles.`).join('\n'), intent: 'SHIPPING', resolved: true, replies: ['Medios de pago', 'Recomiéndame un producto'] }
        : { text: 'La tarifa y el tiempo de entrega se coordinan directamente con el comercio antes del pago.', intent: 'SHIPPING', resolved: true, replies: ['Hablar con un asesor', 'Medios de pago'] };
    } else {
      const faqMatches = await this.faq.search(tenantId, text, 1);
      if (faqMatches[0]?.score >= 2) {
        result = { text: faqMatches[0].answer, intent: `FAQ:${faqMatches[0].category}`, resolved: true, replies: ['Otra pregunta', 'Hablar con un asesor'] };
      } else {
        const products = await this.products(tenantId, text, false);
        result = products.length
          ? { text: 'Estas opciones coinciden con lo que buscas:', intent: 'PRODUCT_SEARCH', resolved: true, replies: ['Ofertas vigentes', 'Envíos', 'Hablar con un asesor'], products }
          : { text: 'No encontré una respuesta exacta. Puedes intentar con el nombre, tipo, característica o presupuesto del producto, o hablar con un asesor.', intent: 'UNKNOWN', resolved: false, replies: ['Recomiéndame un producto', 'Ofertas vigentes', 'Hablar con un asesor'] };
      }
    }

    await this.chat.append({
      tenantId,
      conversationId,
      role: MessageRole.BOT,
      type: result.products?.length ? MessageType.CAROUSEL : MessageType.QUICK_REPLIES,
      content: { text: result.text, replies: result.replies, items: result.products as Array<Record<string, unknown>> | undefined },
      meta: { engine: 'deterministic', intent: result.intent, resolved: result.resolved },
    });
    return result;
  }

  private async products(tenantId: string, query: string, offersOnly: boolean) {
    const tokens = tokenize(query);
    const rows = await this.prisma.product.findMany({ where: { tenantId, active: true }, orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }], take: 50 });
    const now = Date.now();
    return rows
      .map((product) => {
        const offer = (product.metadata as { offer?: { enabled?: boolean; startsAt?: string; endsAt?: string } } | null)?.offer;
        const offerActive = Boolean(offer?.enabled && product.compareAtPriceCents && now >= (offer.startsAt ? Date.parse(offer.startsAt) : -Infinity) && now <= (offer.endsAt ? Date.parse(offer.endsAt) : Infinity));
        const haystack = normalizeText(`${product.name} ${product.shortDescription} ${product.description} ${product.tags.join(' ')} ${JSON.stringify(product.attributes)}`);
        const score = tokens.reduce((sum, token) => sum + (normalizeText(product.name).includes(token) ? 3 : 0) + (haystack.includes(token) ? 1 : 0), 0);
        return { product, offerActive, score };
      })
      .filter(({ offerActive, score }) => offersOnly ? offerActive : tokens.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ product, offerActive }) => {
        const managedOffer = Boolean((product.metadata as { offer?: unknown } | null)?.offer);
        const inactiveBasePrice = managedOffer && !offerActive && product.compareAtPriceCents;
        return {
          name: product.name,
          slug: product.slug,
          description: product.shortDescription || product.description.slice(0, 180),
          priceCents: inactiveBasePrice ? product.compareAtPriceCents! : product.priceCents,
          compareAtPriceCents: inactiveBasePrice ? null : product.compareAtPriceCents,
          currency: product.currency,
          imageUrl: product.images[0] ?? null,
        };
      });
  }
}
