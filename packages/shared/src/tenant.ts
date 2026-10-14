export type BusinessType = 'PRODUCT' | 'SERVICE' | 'MIXED';
export type BotTone = 'formal' | 'cercano' | 'juvenil' | 'experto';

export interface Branding {
  primaryColor: string;
  secondaryColor: string;
  fontFamily?: 'system' | 'serif' | 'rounded';
  bubblePosition?: 'right' | 'left';
  placeholderImageUrl?: string;
}

export interface StorefrontConfig {
  enabled: boolean;
  announcement: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  benefits: Array<{ title: string; body: string }>;
  helpTitle: string;
  helpBody: string;
}

export interface TenantSettings {
  currency: string;
  locale: string;
  timezone: string;
}

export interface ChatSettings {
  enabled: boolean;
  aiEnabled: boolean;
  whatsappThreshold: number;
  assistantName?: string;
  welcomeMessage?: string;
  tone?: BotTone;
  quickReplies?: string[];
  offHoursMessage?: string;
  outOfStockMessage?: string;
}

export interface PaymentSettings {
  bankTransferEnabled: boolean;
  bankName?: string;
  accountType?: 'SAVINGS' | 'CHECKING';
  accountNumber?: string;
  accountHolder?: string;
  instructions?: string;
}

/** Forma de `GET /tenants/public/:slug`. */
export interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  phone: string;
  whatsappNumber: string;
  branding: Partial<Branding>;
  settings: Partial<TenantSettings>;
  chatSettings: Partial<ChatSettings>;
  storefront: Partial<StorefrontConfig>;
  paymentSettings: PaymentSettings;
}
