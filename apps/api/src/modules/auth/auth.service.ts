import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.module';
import { slugify } from '../../common/slugify';
import { TemplatesService } from '../platform/templates.service';
import { AcceptInviteDto, LoginDto, RegisterDto } from './dto/auth.dto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const BCRYPT_ROUNDS = 12;
// Hash válido de bcrypt usado para igualar el tiempo de respuesta cuando el correo no existe.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Yd0sD8kqGzN5kL1HJ0rG8Y5Q6xw2Qe';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly templates: TemplatesService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const slug = await this.uniqueSlug(dto.businessName);
    // Los defaults de negocio (colores, moneda, textos) salen de la plantilla, no del código.
    const template = dto.templateCode ? await this.templates.getByCodeOrId(dto.templateCode) : await this.templates.getDefault();
    const templateData = this.templates.tenantDataFromTemplate(template);

    const { tenant, user } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.businessName.trim(),
          slug,
          ...templateData,
          paymentSettings: { bankTransferEnabled: false },
        },
      });
      const user = await tx.user.create({
        data: { tenantId: tenant.id, name: dto.name.trim(), email, passwordHash, role: UserRole.OWNER },
      });
      return { tenant, user };
    });

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user), tenant };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { tenant: true },
    });
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user), tenant: user.tenant };
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    // Rotación: el token usado se revoca y se emite uno nuevo.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user);
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const tokenHash = this.hashToken(dto.token);
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash }, include: { tenant: true } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new UnauthorizedException('Invitación inválida o expirada');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new ConflictException('Ya existe una cuenta con ese correo');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { tenantId: invitation.tenantId, name: dto.name.trim(), email: invitation.email, passwordHash, role: invitation.role },
      });
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      return user;
    });
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user), tenant: invitation.tenant };
  }

  findActiveUser(id: string) {
    return this.prisma.user.findFirst({ where: { id, status: 'ACTIVE' } });
  }

  publicUser(user: User) {
    return { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, tenantId: user.tenantId, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(48).toString('hex');
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS', 7));
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name) || 'comercio';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
      const taken = await this.prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    throw new ConflictException('No fue posible generar un identificador único para el comercio');
  }
}
