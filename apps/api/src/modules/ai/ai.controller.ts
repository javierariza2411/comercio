import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChannelType, MessageRole } from '@prisma/client';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.module';
import { ChatService } from '../chat/chat.service';
import { AgentOrchestrator } from './agent/agent-orchestrator';
import { AgentService } from './agent/agent.service';
import { LlmService } from './llm/llm.service';

class SimulateDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
  @IsOptional() @IsUUID() conversationId?: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly agent: AgentService,
    private readonly orchestrator: AgentOrchestrator,
    private readonly llm: LlmService,
  ) {}

  @Get('status')
  status() {
    return { provider: this.llm.defaultProviderName, available: this.llm.availableProviders() };
  }

  @Post('simulate')
  @ApiOperation({ summary: 'Simulador del panel: ejecuta el agente con el catálogo real y devuelve la traza (herramientas, fuentes, modelo, tokens)' })
  async simulate(@CurrentUser() user: AuthUser, @Body() dto: SimulateDto) {
    const visitor = await this.prisma.visitor.upsert({
      where: { tenantId_anonId: { tenantId: user.tenantId, anonId: `simulator:${user.id}` } },
      create: { tenantId: user.tenantId, anonId: `simulator:${user.id}`, metadata: { simulator: true } },
      update: {},
    });
    const conversation = dto.conversationId
      ? await this.chat.getOwned(user.tenantId, dto.conversationId)
      : await this.prisma.conversation.create({ data: { tenantId: user.tenantId, visitorId: visitor.id, channel: ChannelType.SIMULATOR, metadata: { simulator: true } } });

    await this.chat.append({ tenantId: user.tenantId, conversationId: conversation.id, role: MessageRole.VISITOR, content: { text: dto.text }, meta: { simulator: true } });
    const history = await this.chat.history(user.tenantId, conversation.id, 20);
    const output = await this.agent.run({
      tenantId: user.tenantId,
      conversationId: conversation.id,
      visitorId: visitor.id,
      channel: 'SIMULATOR',
      text: dto.text,
      history: history
        .slice(0, -1)
        .filter((m) => m.role === MessageRole.VISITOR || m.role === MessageRole.BOT)
        .map((m) => ({ role: m.role, text: String((m.content as { text?: string }).text ?? '') }))
        .filter((m) => m.text),
      unknownStreak: Number((conversation.metadata as { unknownStreak?: number }).unknownStreak ?? 0),
    });
    await this.orchestrator.persist(user.tenantId, conversation.id, output);
    return { conversationId: conversation.id, reply: output.text, attachments: output.attachments, effects: output.effects, trace: output.trace };
  }
}
