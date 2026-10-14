import { Injectable, Logger } from '@nestjs/common';
import { ConversationStatus, MessageRole, MessageType } from '@prisma/client';
import { botSettingsSchema, chatSettingsSchema, parseConfig } from '../../../config/tenant-config';
import { PrismaService } from '../../../prisma/prisma.module';
import { BotOrchestrator, IncomingVisitorMessage } from '../../chat/bot-orchestrator';
import { ChatService } from '../../chat/chat.service';
import { PlansService } from '../../platform/plans.service';
import { AgentOutput, AgentService } from './agent.service';

/** Implementación real del contrato `BotOrchestrator`: ejecuta el agente y persiste su salida en la conversación. */
@Injectable()
export class AgentOrchestrator extends BotOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly agent: AgentService,
    private readonly plans: PlansService,
  ) {
    super();
  }

  async handleVisitorMessage(input: IncomingVisitorMessage): Promise<void> {
    const { tenantId, conversationId } = input;
    try {
      const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { tenant: { select: { plan: true, chatSettings: true, botSettings: true } } } });
      if (conversation.status !== ConversationStatus.BOT) return;

      const chat = parseConfig(chatSettingsSchema, conversation.tenant.chatSettings);
      const bot = parseConfig(botSettingsSchema, conversation.tenant.botSettings);
      if (!chat.aiEnabled) {
        await this.chat.requestHandoff(tenantId, conversationId, 'ai_disabled');
        return;
      }
      if (conversation.botTurns >= bot.maxBotTurnsPerConversation || !(await this.withinAiQuota(tenantId, conversation.tenant.plan))) {
        await this.chat.append({ tenantId, conversationId, role: MessageRole.BOT, content: { text: 'Para seguir ayudándote te conecto con una persona del equipo.' }, meta: { reason: 'ai_limit' } });
        await this.chat.requestHandoff(tenantId, conversationId, 'ai_limit');
        return;
      }

      this.chat.publishTyping(tenantId, conversationId, 'bot', true);
      const history = await this.chat.history(tenantId, conversationId, 20);
      const output = await this.agent.run({
        tenantId,
        conversationId,
        visitorId: conversation.visitorId,
        channel: 'WEB',
        text: input.text,
        history: history
          .filter((m) => m.id !== input.messageId && (m.role === MessageRole.VISITOR || m.role === MessageRole.BOT))
          .map((m) => ({ role: m.role, text: String((m.content as { text?: string }).text ?? '') }))
          .filter((m) => m.text),
        unknownStreak: Number((conversation.metadata as { unknownStreak?: number }).unknownStreak ?? 0),
      });
      await this.persist(tenantId, conversationId, output);
    } catch (error) {
      this.logger.error(`Fallo procesando mensaje ${input.messageId}: ${(error as Error).message}`);
      await this.chat
        .append({ tenantId, conversationId, role: MessageRole.BOT, content: { text: 'Tuve un problema técnico. ¿Quieres que te conecte con una persona?' }, meta: { error: true } })
        .catch(() => undefined);
    } finally {
      this.chat.publishTyping(tenantId, conversationId, 'bot', false);
    }
  }

  /** Guarda la respuesta del agente (texto + adjuntos) y actualiza contadores y escalamiento. */
  async persist(tenantId: string, conversationId: string, output: AgentOutput) {
    const meta = { trace: output.trace, effects: output.effects };
    await this.chat.append({ tenantId, conversationId, role: MessageRole.BOT, content: { text: output.text }, meta });
    for (const attachment of output.attachments) {
      await this.chat.append({ tenantId, conversationId, role: MessageRole.BOT, type: attachment.type as MessageType, content: attachment.content, meta: { fromTools: true } });
    }
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, select: { metadata: true } });
    const metadata = conversation.metadata as Record<string, unknown>;
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        botTurns: { increment: 1 },
        botTokensUsed: { increment: output.trace.usage.inputTokens + output.trace.usage.outputTokens },
        metadata: { ...metadata, unknownStreak: output.effects.unknown ? Number(metadata.unknownStreak ?? 0) + 1 : 0 },
      },
    });
    if (output.effects.escalate && !output.effects.handoff) {
      await this.chat.requestHandoff(tenantId, conversationId, 'unknown_streak');
    }
  }

  private async withinAiQuota(tenantId: string, plan: Parameters<PlansService['getLimits']>[0]) {
    const limits = await this.plans.getLimits(plan);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.message.count({ where: { tenantId, role: MessageRole.BOT, type: MessageType.TEXT, createdAt: { gte: monthStart }, NOT: { meta: { path: ['source'], equals: 'welcome' } } } });
    return used < Math.ceil(limits.aiMessagesPerMonth * 1.2);
  }
}
