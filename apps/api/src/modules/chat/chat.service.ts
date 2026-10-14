import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageRole, MessageType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { chatSettingsSchema, parseConfig } from '../../config/tenant-config';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';
import { ChatEvents } from './chat-events';

export interface MessageContent {
  text?: string;
  url?: string;
  caption?: string;
  items?: Array<Record<string, unknown>>;
  replies?: string[];
  fields?: Array<{ name: string; label: string; type: string; required?: boolean }>;
}

export interface AppendMessageInput {
  tenantId: string;
  conversationId: string;
  role: MessageRole;
  type?: MessageType;
  content: MessageContent;
  meta?: Record<string, unknown>;
}

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  seq: true,
  role: true,
  type: true,
  content: true,
  meta: true,
  createdAt: true,
} satisfies Prisma.MessageSelect;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly events: ChatEvents,
  ) {}

  // ---------- Widget ----------

  async startSession(tenantId: string, anonId: string | undefined, metadata: Record<string, unknown> = {}) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, logoUrl: true, whatsappNumber: true, branding: true, chatSettings: true, plan: true },
    });
    const chat = parseConfig(chatSettingsSchema, tenant.chatSettings);
    if (!chat.enabled) throw new ForbiddenException('El chat está desactivado para este comercio');

    const resolvedAnonId = anonId ?? `v_${randomBytes(12).toString('hex')}`;
    const visitor = await this.prisma.visitor.upsert({
      where: { tenantId_anonId: { tenantId, anonId: resolvedAnonId } },
      create: { tenantId, anonId: resolvedAnonId, metadata: metadata as Prisma.InputJsonObject },
      update: { metadata: metadata as Prisma.InputJsonObject },
    });

    let conversation = await this.prisma.conversation.findFirst({
      where: { tenantId, visitorId: visitor.id, status: { not: ConversationStatus.CLOSED } },
      orderBy: { lastMessageAt: 'desc' },
    });
    let isNew = false;
    if (!conversation) {
      await this.assertConversationQuota(tenantId, tenant.plan);
      conversation = await this.prisma.conversation.create({ data: { tenantId, visitorId: visitor.id } });
      isNew = true;
      await this.append({
        tenantId,
        conversationId: conversation.id,
        role: MessageRole.BOT,
        type: chat.quickReplies.length ? MessageType.QUICK_REPLIES : MessageType.TEXT,
        content: { text: chat.welcomeMessage, replies: chat.quickReplies },
        meta: { source: 'welcome' },
      });
    }

    const messages = await this.history(tenantId, conversation.id);
    return {
      anonId: resolvedAnonId,
      conversation: { id: conversation.id, status: conversation.status, isNew },
      config: {
        tenantName: tenant.name,
        logoUrl: tenant.logoUrl,
        branding: tenant.branding,
        assistantName: chat.assistantName,
        quickReplies: chat.quickReplies,
        whatsappNumber: tenant.whatsappNumber,
      },
      messages,
    };
  }

  async sendVisitorMessage(tenantId: string, conversationId: string, text: string, quickReply?: string) {
    const conversation = await this.getOwned(tenantId, conversationId);
    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('La conversación está cerrada. Inicia una nueva.');
    }
    const message = await this.append({
      tenantId,
      conversationId,
      role: MessageRole.VISITOR,
      content: { text: text.trim() },
      meta: quickReply ? { quickReply } : {},
    });
    return { message, status: conversation.status };
  }

  history(tenantId: string, conversationId: string, limit = 50) {
    return this.prisma.message
      .findMany({ where: { tenantId, conversationId }, orderBy: { seq: 'desc' }, take: limit, select: MESSAGE_SELECT })
      .then((rows) => rows.reverse());
  }

  async requestHandoff(tenantId: string, conversationId: string, reason = 'visitor_request') {
    const conversation = await this.getOwned(tenantId, conversationId);
    if (conversation.status === ConversationStatus.WITH_AGENT || conversation.status === ConversationStatus.WAITING_AGENT) {
      return conversation;
    }
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: ConversationStatus.WAITING_AGENT, metadata: { ...(conversation.metadata as object), handoffReason: reason } },
    });
    await this.append({
      tenantId,
      conversationId,
      role: MessageRole.SYSTEM,
      content: { text: 'Te estamos conectando con una persona del equipo.' },
      meta: { event: 'handoff', reason },
    });
    this.events.publish({ type: 'status', tenantId, conversationId, payload: { status: updated.status } });
    return updated;
  }

  publishTyping(tenantId: string, conversationId: string, who: 'bot' | 'agent' | 'visitor', typing: boolean) {
    this.events.publish({ type: 'typing', tenantId, conversationId, payload: { who, typing } });
  }

  // ---------- Inbox (agentes) ----------

  listConversations(tenantId: string, filter: { status?: ConversationStatus; assigneeId?: string; limit?: number }) {
    return this.prisma.conversation.findMany({
      where: { tenantId, status: filter.status, assigneeId: filter.assigneeId },
      orderBy: { lastMessageAt: 'desc' },
      take: filter.limit ?? 50,
      include: {
        visitor: { select: { id: true, anonId: true, leadId: true, metadata: true } },
        messages: { orderBy: { seq: 'desc' }, take: 1, select: MESSAGE_SELECT },
      },
    });
  }

  async getConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { visitor: true, messages: { orderBy: { seq: 'asc' }, select: MESSAGE_SELECT } },
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    return conversation;
  }

  async updateConversation(
    tenantId: string,
    actorId: string,
    conversationId: string,
    patch: { status?: ConversationStatus; assigneeId?: string | null; tags?: string[] },
  ) {
    await this.getOwned(tenantId, conversationId);
    const assigneeId = patch.assigneeId === 'me' ? actorId : patch.assigneeId;
    if (assigneeId) {
      const agent = await this.prisma.user.findFirst({ where: { id: assigneeId, tenantId, status: 'ACTIVE' } });
      if (!agent) throw new BadRequestException('Agente no válido');
    }
    const status = patch.status ?? (assigneeId ? ConversationStatus.WITH_AGENT : undefined);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status,
        assigneeId: patch.assigneeId === undefined ? undefined : assigneeId,
        tags: patch.tags,
        closedAt: status === ConversationStatus.CLOSED ? new Date() : undefined,
      },
    });
    this.events.publish({
      type: 'status',
      tenantId,
      conversationId,
      payload: { status: updated.status, assigneeId: updated.assigneeId },
    });
    return updated;
  }

  async sendAgentMessage(tenantId: string, agentId: string, conversationId: string, content: MessageContent, type: MessageType = MessageType.TEXT) {
    const conversation = await this.getOwned(tenantId, conversationId);
    if (conversation.status !== ConversationStatus.WITH_AGENT || conversation.assigneeId !== agentId) {
      // Responder implica tomar la conversación: evita que el bot y el agente contesten a la vez.
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: ConversationStatus.WITH_AGENT, assigneeId: agentId },
      });
      this.events.publish({ type: 'status', tenantId, conversationId, payload: { status: ConversationStatus.WITH_AGENT, assigneeId: agentId } });
    }
    return this.append({ tenantId, conversationId, role: MessageRole.AGENT, type, content, meta: { agentId } });
  }

  // ---------- Núcleo ----------

  /** Inserta un mensaje con `seq` consecutivo por conversación y lo publica por SSE. */
  async append(input: AppendMessageInput) {
    const message = await this.prisma.$transaction(async (tx) => {
      const last = await tx.message.findFirst({
        where: { conversationId: input.conversationId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });
      const created = await tx.message.create({
        data: {
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          seq: (last?.seq ?? 0) + 1,
          role: input.role,
          type: input.type ?? MessageType.TEXT,
          content: input.content as Prisma.InputJsonObject,
          meta: (input.meta ?? {}) as Prisma.InputJsonObject,
        },
        select: MESSAGE_SELECT,
      });
      await tx.conversation.update({ where: { id: input.conversationId }, data: { lastMessageAt: created.createdAt } });
      return created;
    });
    this.events.publish({
      type: 'message',
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      payload: message,
      id: String(message.seq),
    });
    return message;
  }

  async getOwned(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new NotFoundException('Conversación no encontrada');
    return conversation;
  }

  private async assertConversationQuota(tenantId: string, plan: Parameters<PlansService['getLimits']>[0]) {
    const limits = await this.plans.getLimits(plan);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.conversation.count({ where: { tenantId, createdAt: { gte: monthStart } } });
    // Bloqueo duro al 120 % del plan; entre 100 % y 120 % se permite y el panel avisa (Fase 2).
    if (used >= Math.ceil(limits.conversationsPerMonth * 1.2)) {
      throw new ForbiddenException('Este comercio alcanzó el límite de conversaciones de su plan');
    }
  }
}
