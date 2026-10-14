import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class StartSessionDto {
  @ApiPropertyOptional({ description: 'Identificador anónimo persistido en localStorage. Si falta, se genera.' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(80) anonId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class SendMessageDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) text: string;
  @ApiPropertyOptional({ description: 'Si el texto viene de un botón de respuesta rápida' }) @IsOptional() @IsString() @MaxLength(60) quickReply?: string;
}

export class AgentMessageDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) text: string;
  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'FILE'] }) @IsOptional() @IsIn(['TEXT', 'IMAGE', 'FILE']) type?: 'TEXT' | 'IMAGE' | 'FILE';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) url?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ enum: ['BOT', 'WAITING_AGENT', 'WITH_AGENT', 'CLOSED'] })
  @IsOptional() @IsIn(['BOT', 'WAITING_AGENT', 'WITH_AGENT', 'CLOSED']) status?: 'BOT' | 'WAITING_AGENT' | 'WITH_AGENT' | 'CLOSED';
  @ApiPropertyOptional({ description: 'UUID del agente o "me" para asignarse a sí mismo; null para desasignar' })
  @IsOptional() @IsString() @MaxLength(40) assigneeId?: string | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
}

export class TypingDto {
  @ApiProperty() @IsBoolean() typing: boolean;
}

export class ConversationIdParam {
  @IsUUID() id: string;
}
