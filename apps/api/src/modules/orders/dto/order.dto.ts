import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) productSlug: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name: string;
  @ApiPropertyOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  email?: string;
  @ApiProperty() @IsString() @MinLength(7) @MaxLength(30) phone: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) city: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(240) address: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) document?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) addressComplement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) region?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() shippingZoneId?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  items: OrderItemDto[];
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] })
  @IsIn(['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  status: 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
}
