import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class InviteUserDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ enum: ['ADMIN', 'AGENT'] }) @IsIn(['ADMIN', 'AGENT']) role: 'ADMIN' | 'AGENT';
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ['ADMIN', 'AGENT'] }) @IsOptional() @IsIn(['ADMIN', 'AGENT']) role?: 'ADMIN' | 'AGENT';
  @ApiPropertyOptional({ enum: ['ACTIVE', 'DISABLED'] }) @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: 'ACTIVE' | 'DISABLED';
}

export class CreateWidgetKeyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiProperty({ type: [String], description: 'Dominios permitidos, p. ej. ["mitienda.com", "www.mitienda.com"]. Vacío = cualquier origen (solo pruebas).' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(253, { each: true })
  allowedDomains: string[];
}

export class UpdateWidgetKeyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) allowedDomains?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
