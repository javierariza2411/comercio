import { MessageRole } from '@prisma/client';

export interface IncomingVisitorMessage {
  tenantId: string;
  conversationId: string;
  messageId: string;
  text: string;
  quickReply?: string;
}

/**
 * Punto de extensión: el módulo de IA registra aquí la implementación real (agente con herramientas).
 * El módulo de chat no depende del proveedor de LLM.
 */
export abstract class BotOrchestrator {
  abstract handleVisitorMessage(input: IncomingVisitorMessage): Promise<void>;
}

export const BOT_ROLE = MessageRole.BOT;
