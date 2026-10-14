import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsHexColor,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BrandingDto {
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsIn(['system', 'serif', 'rounded']) fontFamily?: 'system' | 'serif' | 'rounded';
  @IsOptional() @IsIn(['right', 'left']) bubblePosition?: 'right' | 'left';
  @IsOptional() @IsString() @MaxLength(500) placeholderImageUrl?: string;
}

export class TenantSettingsDto {
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsString() @MaxLength(8) orderPrefix?: string;
  @IsOptional() @IsBoolean() taxIncluded?: boolean;
}

export class ChatSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) whatsappThreshold?: number;
  @IsOptional() @IsString() @MaxLength(80) assistantName?: string;
  @IsOptional() @IsString() @MaxLength(500) welcomeMessage?: string;
  @IsOptional() @IsIn(['formal', 'cercano', 'juvenil', 'experto']) tone?: 'formal' | 'cercano' | 'juvenil' | 'experto';
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true }) @MaxLength(60, { each: true }) quickReplies?: string[];
  @IsOptional() @IsString() @MaxLength(500) offHoursMessage?: string;
  @IsOptional() @IsString() @MaxLength(300) outOfStockMessage?: string;
}


export class BotExampleDto {
  @IsString() @MaxLength(300) question: string;
  @IsString() @MaxLength(1000) answer: string;
}

export class EscalationDto {
  @IsOptional() @IsBoolean() onRequest?: boolean;
  @IsOptional() @IsBoolean() onComplaint?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) afterUnknownAnswers?: number;
}

export class BotSettingsDto {
  @IsOptional() @IsString() @MaxLength(2000) personality?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) allowedTopics?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(80, { each: true }) forbiddenTopics?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => BotExampleDto) examples?: BotExampleDto[];
  @IsOptional() @ValidateNested() @Type(() => EscalationDto) escalation?: EscalationDto;
  @IsOptional() @IsInt() @Min(1) @Max(100) maxBotTurnsPerConversation?: number;
  @IsOptional() @IsIn(['auto', 'small', 'large']) modelTier?: 'auto' | 'small' | 'large';
}

export class BenefitDto {
  @IsString() @MaxLength(60) title: string;
  @IsString() @MaxLength(160) body: string;
}

export class StorefrontDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() @MaxLength(160) announcement?: string;
  @IsOptional() @IsString() @MaxLength(80) heroKicker?: string;
  @IsOptional() @IsString() @MaxLength(120) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(300) heroSubtitle?: string;
  @IsOptional() @IsString() @MaxLength(500) heroImageUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => BenefitDto) benefits?: BenefitDto[];
  @IsOptional() @IsString() @MaxLength(80) helpTitle?: string;
  @IsOptional() @IsString() @MaxLength(200) helpBody?: string;
}

export class PaymentSettingsDto {
  @IsBoolean()
  bankTransferEnabled: boolean;

  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
  @IsOptional() @IsIn(['SAVINGS', 'CHECKING']) accountType?: 'SAVINGS' | 'CHECKING';
  @IsOptional() @IsString() @MinLength(4) @MaxLength(40) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) accountHolder?: string;
  @IsOptional() @IsString() @MaxLength(500) instructions?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['PRODUCT', 'SERVICE', 'MIXED']) businessType?: 'PRODUCT' | 'SERVICE' | 'MIXED';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) whatsappNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() address?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() socialNetworks?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => BrandingDto) branding?: BrandingDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => TenantSettingsDto) settings?: TenantSettingsDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => ChatSettingsDto) chatSettings?: ChatSettingsDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => BotSettingsDto) botSettings?: BotSettingsDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => StorefrontDto) storefront?: StorefrontDto;
}
