import { Injectable } from '@nestjs/common';
import { ConversationStatus, Prisma } from '@prisma/client';
import { formatMoney } from '@smartcommerce/shared';
import { chatSettingsSchema, parseConfig, tenantSettingsSchema } from '../../../config/tenant-config';
import { PrismaService } from '../../../prisma/prisma.module';
import { ChatService } from '../../chat/chat.service';
import { FaqService } from '../../faq/faq.service';
import { ToolDefinition } from '../llm/provider';

export interface ToolContext {
  tenantId: string;
  conversationId: string;
  visitorId: string;
  channel: 'WEB' | 'SIMULATOR';
}

export interface ToolResult {
  /** Payload que ve el modelo. */
  data: Record<string, unknown>;
  /** Cifras verificadas (precios, costos, horarios) que la respuesta puede citar. */
  facts: string[];
  /** Mensajes enriquecidos a mostrar en el widget (tarjetas, archivos) además del texto. */
  attachments?: Array<{ type: 'PRODUCT_CARD' | 'CAROUSEL' | 'FILE' | 'FORM'; content: Record<string, unknown> }>;
  /** Fuentes de conocimiento usadas (para trazabilidad en el simulador). */
  sources?: Array<{ kind: string; id: string; title: string }>;
  /** Efectos sobre la conversación. */
  effects?: { handoff?: boolean; leadCaptured?: boolean; unknown?: boolean };
}

export interface AgentTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const WEEKDAY_ES: Record<string, string> = { mon: 'lunes', tue: 'martes', wed: 'miércoles', thu: 'jueves', fri: 'viernes', sat: 'sábado', sun: 'domingo' };

@Injectable()
export class ToolRegistry {
  constructor(
    private readonly prisma: PrismaService,
    private readonly faq: FaqService,
    private readonly chat: ChatService,
  ) {}

  all(): AgentTool[] {
    return [
      this.buscarProductos(),
      this.verPrecioYStock(),
      this.verPromociones(),
      this.enviarCatalogo(),
      this.verHorariosYSedes(),
      this.calcularEnvio(),
      this.estadoPedido(),
      this.capturarLead(),
      this.pasarAHumano(),
      this.buscarConocimiento(),
    ];
  }

  // ---------------------------------------------------------------- helpers

  private async tenantMoney(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { settings: true, chatSettings: true } });
    const settings = parseConfig(tenantSettingsSchema, tenant.settings);
    const chat = parseConfig(chatSettingsSchema, tenant.chatSettings);
    return { fmt: (cents: number) => formatMoney(cents, settings.currency, settings.locale), settings, chat };
  }

  private async searchProducts(tenantId: string, query: string, limit = 5) {
    const tokens = normalize(query).split(/[^a-z0-9ñ]+/).filter((t) => t.length > 2);
    const where: Prisma.ProductWhereInput = { tenantId, active: true };
    if (tokens.length) {
      where.OR = tokens.flatMap((token) => [
        { name: { contains: token, mode: 'insensitive' } },
        { shortDescription: { contains: token, mode: 'insensitive' } },
        { description: { contains: token, mode: 'insensitive' } },
        { tags: { has: token } },
        { category: { is: { name: { contains: token, mode: 'insensitive' } } } },
      ]);
    }
    const rows = await this.prisma.product.findMany({
      where,
      include: { variants: { where: { active: true } }, category: { select: { name: true } } },
      take: 40,
    });
    // Ranking simple por número de tokens coincidentes (nombre pesa más).
    const scored = rows
      .map((p) => {
        const name = normalize(p.name);
        const haystack = normalize(`${p.shortDescription} ${p.description} ${p.tags.join(' ')} ${p.category?.name ?? ''} ${JSON.stringify(p.attributes)}`);
        const score = tokens.reduce((sum, t) => sum + (name.includes(t) ? 3 : 0) + (haystack.includes(t) ? 1 : 0), 0) + (p.featured ? 0.5 : 0);
        return { p, score };
      })
      .filter((e) => tokens.length === 0 || e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((e) => e.p);
  }

  private productSummary(p: Awaited<ReturnType<ToolRegistry['searchProducts']>>[number], fmt: (c: number) => string) {
    const available = !p.trackStock || p.stock > 0 || p.variants.some((v) => v.stock > 0);
    return {
      id: p.id,
      slug: p.slug,
      nombre: p.name,
      categoria: p.category?.name ?? '',
      descripcion: p.shortDescription || p.description.slice(0, 200),
      precio: fmt(p.priceCents),
      precio_anterior: p.compareAtPriceCents ? fmt(p.compareAtPriceCents) : undefined,
      disponible: available,
      stock: p.trackStock ? p.stock : undefined,
      atributos: p.attributes,
      variantes: p.variants.map((v) => ({ nombre: v.name, precio: v.priceCents != null ? fmt(v.priceCents) : undefined, stock: v.stock })),
      imagen: p.images[0] ?? null,
    };
  }

  private productCard(p: Awaited<ReturnType<ToolRegistry['searchProducts']>>[number], fmt: (c: number) => string) {
    return {
      productId: p.id,
      slug: p.slug,
      title: p.name,
      subtitle: p.shortDescription,
      price: fmt(p.priceCents),
      compareAtPrice: p.compareAtPriceCents ? fmt(p.compareAtPriceCents) : null,
      imageUrl: p.images[0] ?? null,
      available: !p.trackStock || p.stock > 0,
      actions: [
        { label: 'Ver más', action: 'details' },
        { label: 'Cotizar', action: 'quote' },
      ],
    };
  }

  // ---------------------------------------------------------------- tools

  private buscarProductos(): AgentTool {
    return {
      definition: {
        name: 'buscar_productos',
        description: 'Busca productos del catálogo por nombre, categoría, características o uso. Úsala siempre que el cliente pregunte por productos o pida recomendaciones.',
        parameters: {
          type: 'object',
          properties: {
            consulta: { type: 'string', description: 'Palabras clave de lo que busca el cliente (p. ej. "reloj deportivo resistente al agua")' },
            limite: { type: 'integer', description: 'Máximo de resultados (1-5)' },
          },
          required: ['consulta'],
        },
      },
      execute: async (args, ctx) => {
        const { fmt } = await this.tenantMoney(ctx.tenantId);
        const products = await this.searchProducts(ctx.tenantId, str(args.consulta), Math.min(Number(args.limite) || 3, 5));
        const productos = products.map((p) => this.productSummary(p, fmt));
        return {
          data: { productos, total: productos.length },
          facts: productos.flatMap((p) => [p.precio, ...(p.precio_anterior ? [p.precio_anterior] : [])]),
          attachments: products.length
            ? [{ type: products.length === 1 ? 'PRODUCT_CARD' : 'CAROUSEL', content: { items: products.map((p) => this.productCard(p, fmt)) } }]
            : undefined,
          effects: { unknown: productos.length === 0 },
        };
      },
    };
  }

  private verPrecioYStock(): AgentTool {
    return {
      definition: {
        name: 'ver_precio_y_stock',
        description: 'Devuelve el precio actual y la disponibilidad exacta de un producto concreto. Obligatoria antes de afirmar cualquier precio o si hay unidades.',
        parameters: {
          type: 'object',
          properties: {
            consulta: { type: 'string', description: 'Nombre o descripción del producto' },
            slug: { type: 'string', description: 'Slug del producto si ya se conoce' },
          },
          required: ['consulta'],
        },
      },
      execute: async (args, ctx) => {
        const { fmt, chat } = await this.tenantMoney(ctx.tenantId);
        let products = [] as Awaited<ReturnType<ToolRegistry['searchProducts']>>;
        if (str(args.slug)) {
          const one = await this.prisma.product.findFirst({
            where: { tenantId: ctx.tenantId, slug: str(args.slug), active: true },
            include: { variants: { where: { active: true } }, category: { select: { name: true } } },
          });
          if (one) products = [one];
        }
        if (!products.length) products = await this.searchProducts(ctx.tenantId, str(args.consulta), 2);
        const productos = products.map((p) => this.productSummary(p, fmt));
        const agotados = productos.filter((p) => !p.disponible);
        return {
          data: { productos, mensaje_agotado: agotados.length ? chat.outOfStockMessage : undefined },
          facts: productos.flatMap((p) => [p.precio, ...(p.precio_anterior ? [p.precio_anterior] : []), ...p.variantes.map((v) => v.precio ?? '')]).filter(Boolean),
          attachments: products.length ? [{ type: 'PRODUCT_CARD', content: { items: products.slice(0, 1).map((p) => this.productCard(p, fmt)) } }] : undefined,
          effects: { unknown: productos.length === 0 },
        };
      },
    };
  }

  private verPromociones(): AgentTool {
    return {
      definition: {
        name: 'ver_promociones',
        description: 'Lista las promociones y descuentos vigentes hoy. Úsala si preguntan por ofertas, descuentos o cupones.',
        parameters: { type: 'object', properties: { cupon: { type: 'string', description: 'Código de cupón a validar, si el cliente lo menciona' } } },
      },
      execute: async (args, ctx) => {
        const now = new Date();
        const promos = await this.prisma.promotion.findMany({
          where: {
            tenantId: ctx.tenantId,
            active: true,
            OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
          },
        });
        const cupon = str(args.cupon).toUpperCase();
        const promociones = promos
          .filter((p) => !p.couponCode || !cupon || p.couponCode.toUpperCase() === cupon)
          .map((p) => ({
            nombre: p.name,
            descripcion: p.description,
            descuento: p.type === 'PERCENT' ? `${p.value}%` : formatMoney(p.value),
            requiere_cupon: Boolean(p.couponCode),
            vigente_hasta: p.endsAt?.toISOString().slice(0, 10) ?? null,
          }));
        return {
          data: { promociones, mensaje: promociones.length ? undefined : 'No hay promociones vigentes en este momento.' },
          facts: promociones.map((p) => p.descuento),
        };
      },
    };
  }

  private enviarCatalogo(): AgentTool {
    return {
      definition: {
        name: 'enviar_catalogo',
        description: 'Envía el catálogo al cliente: galería de productos destacados o por categoría, y el PDF si el comercio lo publicó.',
        parameters: { type: 'object', properties: { categoria: { type: 'string', description: 'Categoría solicitada (opcional)' } } },
      },
      execute: async (args, ctx) => {
        const { fmt } = await this.tenantMoney(ctx.tenantId);
        const categoria = str(args.categoria);
        const products = await this.prisma.product.findMany({
          where: {
            tenantId: ctx.tenantId,
            active: true,
            ...(categoria ? { category: { is: { name: { contains: categoria, mode: 'insensitive' } } } } : {}),
          },
          include: { variants: { where: { active: true } }, category: { select: { name: true } } },
          orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
          take: 8,
        });
        const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { storefront: true } });
        const catalogPdfUrl = (tenant.storefront as { catalogPdfUrl?: string } | null)?.catalogPdfUrl;
        const attachments: ToolResult['attachments'] = [];
        if (products.length) attachments.push({ type: 'CAROUSEL', content: { items: products.map((p) => this.productCard(p, fmt)) } });
        if (catalogPdfUrl) attachments.push({ type: 'FILE', content: { url: catalogPdfUrl, caption: 'Catálogo en PDF', mime: 'application/pdf' } });
        return {
          data: {
            mensaje: products.length ? `Aquí tienes ${products.length} productos${categoria ? ` de ${categoria}` : ' destacados'}.` : 'El comercio aún no tiene productos publicados.',
            productos: products.map((p) => this.productSummary(p, fmt)),
            pdf: catalogPdfUrl ?? null,
          },
          facts: products.map((p) => fmt(p.priceCents)),
          attachments,
          effects: { unknown: products.length === 0 },
        };
      },
    };
  }

  private verHorariosYSedes(): AgentTool {
    return {
      definition: {
        name: 'ver_horarios_y_sedes',
        description: 'Devuelve sedes, direcciones, teléfonos y horarios de atención, e indica si ahora está abierto.',
        parameters: { type: 'object', properties: { ciudad: { type: 'string' } } },
      },
      execute: async (args, ctx) => {
        const { settings } = await this.tenantMoney(ctx.tenantId);
        const ciudad = normalize(str(args.ciudad));
        const locations = await this.prisma.location.findMany({ where: { tenantId: ctx.tenantId, active: true }, orderBy: { isMain: 'desc' } });
        const filtered = ciudad ? locations.filter((l) => normalize(l.city).includes(ciudad)) : locations;
        const now = new Date();
        const local = new Intl.DateTimeFormat('en-US', { timeZone: settings.timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
        const weekday = local.find((p) => p.type === 'weekday')?.value.toLowerCase().slice(0, 3) ?? WEEKDAYS[now.getDay()];
        const hhmm = `${local.find((p) => p.type === 'hour')?.value}:${local.find((p) => p.type === 'minute')?.value}`;
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: settings.timezone }).format(now);

        const sedes = filtered.map((l) => {
          const hours = (l.hours as Record<string, Array<{ open: string; close: string }>>) ?? {};
          const ranges = hours[weekday] ?? [];
          const isHoliday = l.holidays.includes(today);
          const openNow = !isHoliday && ranges.some((r) => r.open <= hhmm && hhmm < r.close);
          const horario = WEEKDAYS.filter((d) => hours[d]?.length)
            .map((d) => `${WEEKDAY_ES[d]} ${hours[d].map((r) => `${r.open}-${r.close}`).join(' y ')}`)
            .join('; ');
          return { nombre: l.name, direccion: `${l.address}${l.city ? `, ${l.city}` : ''}`, telefono: l.phone, mapa: l.mapsUrl, horario: horario || 'no publicado', abierto_ahora: openNow, festivo_hoy: isHoliday };
        });
        return {
          data: { sedes, mensaje: sedes.length ? undefined : 'El comercio no ha publicado sedes ni horarios.' },
          facts: sedes.map((s) => s.horario),
          effects: { unknown: sedes.length === 0 },
        };
      },
    };
  }

  private calcularEnvio(): AgentTool {
    return {
      definition: {
        name: 'calcular_envio',
        description: 'Calcula costo y tiempo de envío a una ciudad según las zonas configuradas por el comercio.',
        parameters: {
          type: 'object',
          properties: {
            ciudad: { type: 'string', description: 'Ciudad de destino' },
            subtotal_centavos: { type: 'integer', description: 'Subtotal del pedido en centavos, si se conoce, para evaluar envío gratis' },
          },
          required: ['ciudad'],
        },
      },
      execute: async (args, ctx) => {
        const { fmt } = await this.tenantMoney(ctx.tenantId);
        const ciudad = normalize(str(args.ciudad));
        const zones = await this.prisma.shippingZone.findMany({ where: { tenantId: ctx.tenantId, active: true } });
        if (!zones.length) return { data: { mensaje: 'El comercio no ha configurado tarifas de envío. Puedo conectarte con una persona para cotizarlo.' }, facts: [], effects: { unknown: true } };
        const zone = zones.find((z) => z.cities.some((c) => normalize(c) === ciudad)) ?? zones.find((z) => z.cities.some((c) => ciudad && normalize(c).includes(ciudad))) ?? zones.find((z) => z.cities.length === 0);
        if (!zone) return { data: { mensaje: `No tenemos cobertura de envío registrada para ${str(args.ciudad)}.` }, facts: [], effects: { unknown: true } };
        const subtotal = Number(args.subtotal_centavos) || 0;
        const free = zone.freeAboveCents != null && subtotal >= zone.freeAboveCents;
        const costo = free ? 'gratis' : fmt(zone.priceCents);
        const eta = zone.etaMinDays === zone.etaMaxDays ? `${zone.etaMinDays} día(s) hábil(es)` : `${zone.etaMinDays} a ${zone.etaMaxDays} días hábiles`;
        const mensaje = `Envío a ${str(args.ciudad)} (${zone.name}): ${costo}, entrega en ${eta}${zone.freeAboveCents != null && !free ? `. Gratis en compras desde ${fmt(zone.freeAboveCents)}` : ''}.`;
        return { data: { zona: zone.name, costo, tiempo: eta, mensaje }, facts: [costo, eta, ...(zone.freeAboveCents != null ? [fmt(zone.freeAboveCents)] : [])] };
      },
    };
  }

  private estadoPedido(): AgentTool {
    return {
      definition: {
        name: 'estado_pedido',
        description: 'Consulta el estado de un pedido por su número. Pide el número si el cliente no lo dio.',
        parameters: {
          type: 'object',
          properties: {
            numero_pedido: { type: 'string', description: 'Número de pedido, p. ej. REL-1712345678901-AB12CD' },
            telefono: { type: 'string', description: 'Teléfono del cliente para verificar identidad (opcional)' },
          },
          required: ['numero_pedido'],
        },
      },
      execute: async (args, ctx) => {
        const { fmt } = await this.tenantMoney(ctx.tenantId);
        const order = await this.prisma.order.findFirst({ where: { tenantId: ctx.tenantId, orderNumber: str(args.numero_pedido).toUpperCase() } });
        if (!order) return { data: { mensaje: `No encontré el pedido ${str(args.numero_pedido)}. Verifica el número o pide ayuda a una persona.` }, facts: [], effects: { unknown: true } };
        const customer = order.customer as { phone?: string };
        const phone = str(args.telefono).replace(/\D/g, '');
        // Sin verificación de teléfono solo se revela el estado, nunca datos del cliente.
        const verified = phone.length >= 4 && (customer.phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-4));
        const estado = { PENDING_TRANSFER: 'pendiente de confirmación de pago', PAID: 'pago confirmado, en preparación', CANCELLED: 'cancelado' }[order.status];
        const mensaje = `El pedido ${order.orderNumber} está ${estado}${verified ? ` por un total de ${fmt(order.totalCents)}` : ''}.`;
        return { data: { numero: order.orderNumber, estado, total: verified ? fmt(order.totalCents) : undefined, fecha: order.createdAt.toISOString().slice(0, 10), mensaje }, facts: verified ? [fmt(order.totalCents)] : [] };
      },
    };
  }

  private capturarLead(): AgentTool {
    return {
      definition: {
        name: 'capturar_lead',
        description: 'Guarda los datos de contacto del cliente SOLO si dio consentimiento explícito para ser contactado. Antes de llamarla, pide nombre, correo o teléfono y la autorización.',
        parameters: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            correo: { type: 'string' },
            telefono: { type: 'string' },
            interes: { type: 'string', description: 'Producto o tema de interés' },
            consentimiento: { type: 'boolean', description: 'true solo si el cliente autorizó explícitamente el tratamiento de sus datos' },
          },
          required: ['consentimiento'],
        },
      },
      execute: async (args, ctx) => {
        if (args.consentimiento !== true) {
          return { data: { error: 'Falta el consentimiento explícito. Pregunta al cliente si autoriza el uso de sus datos para contactarlo (Ley 1581 de 2012).' }, facts: [] };
        }
        if (!str(args.correo) && !str(args.telefono)) return { data: { error: 'Se necesita al menos correo o teléfono.' }, facts: [] };
        const lead = await this.prisma.lead.create({
          data: {
            tenantId: ctx.tenantId,
            visitorId: ctx.visitorId,
            conversationId: ctx.conversationId,
            name: str(args.nombre),
            email: str(args.correo).toLowerCase(),
            phone: str(args.telefono),
            interest: str(args.interes),
            consentAt: new Date(),
            consentText: 'Autorizo el tratamiento de mis datos para ser contactado por el comercio (Ley 1581 de 2012).',
            source: ctx.channel === 'SIMULATOR' ? 'simulator' : 'widget',
          },
        });
        await this.prisma.visitor.update({ where: { id: ctx.visitorId }, data: { leadId: lead.id } });
        return { data: { ok: true, mensaje: '¡Gracias! Guardamos tus datos y el equipo te contactará pronto.' }, facts: [], effects: { leadCaptured: true } };
      },
    };
  }

  private pasarAHumano(): AgentTool {
    return {
      definition: {
        name: 'pasar_a_humano',
        description: 'Transfiere la conversación a una persona del equipo. Úsala si el cliente lo pide, si hay un reclamo, o si no puedes resolver la consulta con las otras herramientas.',
        parameters: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] },
      },
      execute: async (args, ctx) => {
        if (ctx.channel === 'SIMULATOR') {
          return { data: { ok: true, mensaje: '[Simulador] La conversación se transferiría a un agente.', motivo: str(args.motivo) }, facts: [], effects: { handoff: true } };
        }
        const conversation = await this.chat.requestHandoff(ctx.tenantId, ctx.conversationId, str(args.motivo) || 'bot');
        return {
          data: { ok: conversation.status !== ConversationStatus.BOT, mensaje: 'Te estoy conectando con una persona del equipo; en breve te atenderán por aquí mismo.' },
          facts: [],
          effects: { handoff: true },
        };
      },
    };
  }

  private buscarConocimiento(): AgentTool {
    return {
      definition: {
        name: 'buscar_conocimiento',
        description: 'Busca en las políticas, garantías, preguntas frecuentes, guías y documentos escritos del comercio. NO sirve para precios, stock ni horarios (usa las otras herramientas).',
        parameters: { type: 'object', properties: { pregunta: { type: 'string' } }, required: ['pregunta'] },
      },
      execute: async (args, ctx) => {
        // Fase 1 bloque 3: aquí se añade la búsqueda vectorial sobre KnowledgeChunk; hoy responde con FAQs.
        const results = await this.faq.search(ctx.tenantId, str(args.pregunta), 4);
        const fragmentos = results.map((f) => ({ id: f.id, titulo: f.question, texto: f.answer, relevancia: f.score }));
        return {
          data: { fragmentos, mensaje: fragmentos.length ? undefined : 'No hay información publicada sobre ese tema.' },
          facts: [],
          sources: results.map((f) => ({ kind: 'faq', id: f.id, title: f.question })),
          effects: { unknown: fragmentos.length === 0 },
        };
      },
    };
  }
}
