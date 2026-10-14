import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationStatus, MessageType } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatEvents } from './chat-events';
import { ChatService } from './chat.service';
import { AgentMessageDto, TypingDto, UpdateConversationDto } from './dto/chat.dto';
import { openSse } from './sse';

@ApiTags('inbox')
@ApiBearerAuth()
@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(
    private readonly chat: ChatService,
    private readonly bus: ChatEvents,
  ) {}

  @Get('conversations')
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ConversationStatus,
    @Query('mine') mine?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.listConversations(user.tenantId, {
      status: status && status in ConversationStatus ? status : undefined,
      assigneeId: mine === 'true' ? user.id : undefined,
      limit: limit ? Math.min(Number(limit) || 50, 200) : undefined,
    });
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.getConversation(user.tenantId, id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Asignar, cambiar estado o etiquetar' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
    return this.chat.updateConversation(user.tenantId, user.id, id, {
      status: dto.status as ConversationStatus | undefined,
      assigneeId: dto.assigneeId,
      tags: dto.tags,
    });
  }

  @Post('conversations/:id/messages')
  reply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AgentMessageDto) {
    const type = (dto.type ?? 'TEXT') as MessageType;
    return this.chat.sendAgentMessage(user.tenantId, user.id, id, { text: dto.text, url: dto.url }, type);
  }

  @Post('conversations/:id/typing')
  async typing(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TypingDto) {
    await this.chat.getOwned(user.tenantId, id);
    this.chat.publishTyping(user.tenantId, id, 'agent', dto.typing);
    return { ok: true };
  }

  @Get('events')
  @Header('Content-Type', 'text/event-stream')
  @ApiOperation({ summary: 'Stream SSE de todas las conversaciones del comercio (para la bandeja)' })
  events(@CurrentUser() user: AuthUser, @Req() req: Request, @Res() res: Response) {
    const sse = openSse(res);
    const unsubscribe = this.bus.subscribeTenant(user.tenantId, (event) =>
      sse.write({ ...event, payload: { conversationId: event.conversationId, ...(event.payload as object) } }),
    );
    req.on('close', () => {
      unsubscribe();
      sse.close();
    });
  }
}
