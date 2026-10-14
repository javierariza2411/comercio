export type Role = 'VISITOR' | 'BOT' | 'AGENT' | 'SYSTEM';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'PRODUCT_CARD' | 'CAROUSEL' | 'QUICK_REPLIES' | 'FORM';

export interface ProductCard {
  productId: string;
  slug: string;
  title: string;
  subtitle?: string;
  price: string;
  compareAtPrice?: string | null;
  imageUrl?: string | null;
  available?: boolean;
  actions?: Array<{ label: string; action: string }>;
}

export interface MessageContent {
  text?: string;
  url?: string;
  caption?: string;
  mime?: string;
  items?: ProductCard[];
  replies?: string[];
}

export interface Message {
  id: string;
  seq: number;
  role: Role;
  type: MessageType;
  content: MessageContent;
  createdAt: string;
  pending?: boolean;
}

export interface WidgetConfig {
  tenantName: string;
  logoUrl: string;
  branding: { primaryColor?: string; secondaryColor?: string; fontFamily?: string };
  assistantName: string;
  quickReplies: string[];
  whatsappNumber: string;
}

export interface Session {
  anonId: string;
  conversation: { id: string; status: string; isNew: boolean };
  config: WidgetConfig;
  messages: Message[];
}
