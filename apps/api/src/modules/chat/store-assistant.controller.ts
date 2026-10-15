import { Body, Controller, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.module';
import { ChatService } from './chat.service';
import { StoreAssistantService } from './store-assistant.service';

class StartStoreAssistantDto { @IsOptional() @IsString() @MinLength(8) @MaxLength(80) anonId?: string; }
class AskStoreAssistantDto { @IsString() @MinLength(1) @MaxLength(500) text: string; }

@ApiTags('store-assistant')
@Controller('store-assistant')
export class StoreAssistantController {
  private readonly secret: string;
  constructor(private readonly prisma: PrismaService, private readonly chat: ChatService, private readonly assistant: StoreAssistantService, config: ConfigService) { this.secret = config.getOrThrow<string>('JWT_SECRET'); }

  @Post(':tenantSlug/session')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia una sesión pública y firmada del asistente determinista' })
  async start(@Param('tenantSlug') tenantSlug: string, @Body() dto: StartStoreAssistantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new UnauthorizedException('Tienda no disponible');
    const session = await this.chat.startSession(tenant.id, dto.anonId, { source: 'storefront', engine: 'deterministic' });
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
    const payload = `${tenant.id}.${session.conversation.id}.${session.anonId}.${expiresAt}`;
    return { ...session, sessionToken: `${payload}.${this.sign(payload)}`, expiresAt };
  }

  @Post(':tenantSlug/message')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async message(@Param('tenantSlug') tenantSlug: string, @Headers('authorization') authorization: string | undefined, @Body() dto: AskStoreAssistantDto) {
    const session = await this.verify(tenantSlug, authorization);
    await this.chat.sendVisitorMessage(session.tenantId, session.conversationId, dto.text);
    return this.assistant.reply(session.tenantId, session.conversationId, dto.text);
  }

  private sign(payload: string) { return createHmac('sha256', this.secret).update(payload).digest('hex'); }
  private async verify(tenantSlug: string, authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const parts = token.split('.');
    if (parts.length !== 5) throw new UnauthorizedException('Sesión inválida');
    const [tenantId, conversationId, anonId, expires, signature] = parts;
    const payload = `${tenantId}.${conversationId}.${anonId}.${expires}`;
    const expected = this.sign(payload);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) || Number(expires) < Date.now()) throw new UnauthorizedException('Sesión vencida o inválida');
    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId, slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new UnauthorizedException('Sesión inválida');
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, tenantId, visitor: { anonId } }, select: { id: true } });
    if (!conversation) throw new UnauthorizedException('Sesión inválida');
    return { tenantId, conversationId };
  }
}
