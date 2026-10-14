import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
}

export class TenantSettingsDto {
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() @MaxLength(10) locale?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
}

export class ChatSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() aiEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) whatsappThreshold?: number;
  @IsOptional() @IsString() @MaxLength(80) assistantName?: string;
  @IsOptional() @IsString() @MaxLength(500) welcomeMessage?: string;
  @IsOptional() @IsIn(['formal', 'cercano', 'juvenil']) tone?: 'formal' | 'cercano' | 'juvenil';
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

