import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'ana@mitienda.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 8, example: 'MiClaveSegura1' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'La contraseña debe incluir letras y números' })
  password: string;

  @ApiProperty({ example: 'Mi Tienda' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@mitienda.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken: string;
}
