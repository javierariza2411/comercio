import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { BotOrchestrator } from './bot-orchestrator';
import { ChatEvents } from './chat-events';
import { ChatService } from './chat.service';
import { SendMessageDto, StartSessionDto, TypingDto } from './dto/chat.dto';
import { openSse } from './sse';
import { Widget, WidgetContext, WidgetGuard } from './widget-auth';

@ApiTags('widget')
@ApiHeader({ name: 'X-Widget-Key', required: true })
@Controller('widget')
@UseGuards(WidgetGuard)
export class WidgetController {
  constructor(
    private readonly chat: ChatService,
    private readonly bus: ChatEvents,
    private readonly bot: BotOrchestrator,
  ) {}

  @Post('session')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia o recupera la sesión del visitante y devuelve config + historial' })
  start(@Widget() widget: WidgetContext, @Body() dto: StartSessionDto, @Req() req: Request) {
    const metadata = { ...(dto.metadata ?? {}), userAgent: req.headers['user-agent'], origin: widget.origin };
    return this.chat.startSession(widget.tenantId, dto.anonId, metadata);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Envía un mensaje del visitante; el bot responde de forma asíncrona vía SSE' })
  async send(@Widget() widget: WidgetContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
    const { message, status } = await this.chat.sendVisitorMessage(widget.tenantId, id, dto.text, dto.quickReply);
    if (status === 'BOT') {
      // No se espera la respuesta del bot: llega por SSE. Los errores se registran dentro del orquestador.
      void this.bot.handleVisitorMessage({ tenantId: widget.tenantId, conversationId: id, messageId: message.id, text: dto.text, quickReply: dto.quickReply });
    }
    return message;
  }

  @Get('conversations/:id/messages')
  history(@Widget() widget: WidgetContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.history(widget.tenantId, id);
  }

  @Post('conversations/:id/handoff')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  handoff(@Widget() widget: WidgetContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.requestHandoff(widget.tenantId, id);
  }

  @Post('conversations/:id/typing')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async typing(@Widget() widget: WidgetContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: TypingDto) {
    await this.chat.getOwned(widget.tenantId, id);
    this.chat.publishTyping(widget.tenantId, id, 'visitor', dto.typing);
    return { ok: true };
  }

  @Get('conversations/:id/events')
  @Header('Content-Type', 'text/event-stream')
  @ApiOperation({ summary: 'Stream SSE de la conversación (mensajes, escritura, estado). Soporta Last-Event-ID.' })
  async events(
    @Widget() widget: WidgetContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('lastEventId') lastEventIdQuery?: string,
  ) {
    await this.chat.getOwned(widget.tenantId, id);
    const sse = openSse(res);

    // Recuperación tras reconexión: reenvía lo que el cliente no vio.
    const lastSeq = Number(req.headers['last-event-id'] ?? lastEventIdQuery ?? 0);
    if (lastSeq > 0) {
      const missed = (await this.chat.history(widget.tenantId, id, 200)).filter((m) => m.seq > lastSeq);
      for (const message of missed) sse.write({ type: 'message', payload: message, id: String(message.seq) });
    }

    const unsubscribe = this.bus.subscribeConversation(id, (event) => sse.write(event));
    req.on('close', () => {
      unsubscribe();
      sse.close();
    });
  }
}
