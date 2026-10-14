import { z } from 'zod';

/**
 * Esquemas de la configuración por tenant (columnas JSON). Única fuente de verdad para
 * defaults técnicos; los defaults DE NEGOCIO (colores, moneda, textos) vienen de IndustryTemplate.
 */
export const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#111827'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#f59e0b'),
  fontFamily: z.enum(['system', 'serif', 'rounded']).default('system'),
  bubblePosition: z.enum(['right', 'left']).default('right'),
  placeholderImageUrl: z.string().default(''),
});

export const tenantSettingsSchema = z.object({
  currency: z.string().length(3).default('COP'),
  locale: z.string().max(10).default('es-CO'),
  timezone: z.string().max(64).default('America/Bogota'),
  orderPrefix: z.string().max(8).default('PED'),
  taxIncluded: z.boolean().default(true),
});

export const chatSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  aiEnabled: z.boolean().default(true),
  whatsappThreshold: z.number().int().min(0).max(100).default(30),
  assistantName: z.string().max(80).default('Asistente'),
  welcomeMessage: z.string().max(500).default('¡Hola! ¿En qué puedo ayudarte hoy?'),
  tone: z.enum(['formal', 'cercano', 'juvenil', 'experto']).default('cercano'),
  quickReplies: z.array(z.string().max(60)).max(8).default([]),
  offHoursMessage: z.string().max(500).default('En este momento estamos fuera de horario. Déjanos tus datos y te contactaremos.'),
  outOfStockMessage: z.string().max(300).default('Ese producto está agotado por ahora. ¿Quieres que te avisemos cuando vuelva?'),
});

export const botSettingsSchema = z.object({
  personality: z.string().max(2000).default(''),
  allowedTopics: z.array(z.string().max(80)).max(30).default([]),
  forbiddenTopics: z.array(z.string().max(80)).max(30).default([]),
  examples: z.array(z.object({ question: z.string().max(300), answer: z.string().max(1000) })).max(10).default([]),
  escalation: z
    .object({
      onRequest: z.boolean().default(true),
      onComplaint: z.boolean().default(true),
      afterUnknownAnswers: z.number().int().min(0).max(10).default(2),
    })
    .prefault({}),
  maxBotTurnsPerConversation: z.number().int().min(1).max(100).default(30),
  modelTier: z.enum(['auto', 'small', 'large']).default('auto'),
});

export const storefrontSchema = z.object({
  enabled: z.boolean().default(true),
  announcement: z.string().max(160).default(''),
  heroKicker: z.string().max(80).default(''),
  heroTitle: z.string().max(120).default(''),
  heroSubtitle: z.string().max(300).default(''),
  heroImageUrl: z.string().default(''),
  benefits: z.array(z.object({ title: z.string().max(60), body: z.string().max(160) })).max(4).default([]),
  helpTitle: z.string().max(80).default('¿Tienes dudas?'),
  helpBody: z.string().max(200).default('Pregúntale a nuestro asistente antes de comprar.'),
});

export const paymentSettingsSchema = z.object({
  bankTransferEnabled: z.boolean().default(false),
  bankName: z.string().default(''),
  accountType: z.enum(['SAVINGS', 'CHECKING']).default('SAVINGS'),
  accountNumber: z.string().default(''),
  accountHolder: z.string().default(''),
  instructions: z.string().default(''),
});

export const planLimitsSchema = z.object({
  conversationsPerMonth: z.number().int().default(200),
  aiMessagesPerMonth: z.number().int().default(1000),
  agents: z.number().int().default(1),
  storageMb: z.number().int().default(200),
  productsMax: z.number().int().default(200),
  imagesPerProduct: z.number().int().default(4),
  orderMaxItems: z.number().int().default(20),
  orderMaxQtyPerItem: z.number().int().default(10),
  knowledgeSourcesMax: z.number().int().default(10),
});

export type Branding = z.infer<typeof brandingSchema>;
export type TenantSettings = z.infer<typeof tenantSettingsSchema>;
export type ChatSettings = z.infer<typeof chatSettingsSchema>;
export type BotSettings = z.infer<typeof botSettingsSchema>;
export type StorefrontConfig = z.infer<typeof storefrontSchema>;
export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;
export type PlanLimits = z.infer<typeof planLimitsSchema>;

/** Parsea un JSON de BD aplicando defaults; nunca lanza (los datos inválidos caen al default). */
export function parseConfig<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value ?? {});
  return result.success ? result.data : schema.parse({});
}
