import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(300) question: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) answer: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(50, { each: true }) keywords?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class SearchFaqDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(300) query: string;
}
