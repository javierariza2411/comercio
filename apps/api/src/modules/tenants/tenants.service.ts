import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import {
  botSettingsSchema,
  brandingSchema,
  chatSettingsSchema,
  parseConfig,
  PaymentSettings,
  paymentSettingsSchema,
  storefrontSchema,
  tenantSettingsSchema,
} from '../../config/tenant-config';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';
import { TemplatesService } from '../platform/templates.service';
import { CreateWidgetKeyDto, InviteUserDto, UpdateMemberDto, UpdateWidgetKeyDto } from './dto/team.dto';
import { PaymentSettingsDto, UpdateTenantDto } from './dto/tenant.dto';

export type { PaymentSettings };

const PUBLIC_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  phone: true,
  whatsappNumber: true,
  branding: true,
  settings: true,
  chatSettings: true,
  storefront: true,
  paymentSettings: true,
} satisfies Prisma.TenantSelect;

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function isBankTransferConfigured(payment: PaymentSettings | null | undefined): payment is Required<PaymentSettings> {
  return Boolean(payment?.bankTransferEnabled && payment.bankName && payment.accountNumber && payment.accountHolder);
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly templates: TemplatesService,
  ) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    return this.normalize(tenant);
  }

  async findPublicBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: PUBLIC_SELECT });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    const payment = parseConfig(paymentSettingsSchema, tenant.paymentSettings);
    return {
      ...tenant,
      branding: parseConfig(brandingSchema, tenant.branding),
      settings: parseConfig(tenantSettingsSchema, tenant.settings),
      chatSettings: parseConfig(chatSettingsSchema, tenant.chatSettings),
      storefront: parseConfig(storefrontSchema, tenant.storefront),
      paymentSettings: isBankTransferConfigured(payment) ? payment : { bankTransferEnabled: false },
    };
  }

  async update(id: string, dto: UpdateTenantDto) {
    const current = await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    const merge = (key: 'branding' | 'settings' | 'chatSettings' | 'botSettings' | 'storefront' | 'address' | 'socialNetworks') =>
      dto[key] === undefined
        ? undefined
        : ({ ...(current[key] as object), ...compact(dto[key] as Record<string, unknown>) } as Prisma.InputJsonObject);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description,
        logoUrl: dto.logoUrl,
        businessType: dto.businessType,
        phone: dto.phone,
        whatsappNumber: dto.whatsappNumber,
        email: dto.email?.toLowerCase(),
        address: merge('address'),
        socialNetworks: merge('socialNetworks'),
        branding: merge('branding'),
        settings: merge('settings'),
        chatSettings: merge('chatSettings'),
        botSettings: merge('botSettings'),
        storefront: merge('storefront'),
      },
    });
    return this.normalize(updated);
  }

  async updatePaymentSettings(id: string, dto: PaymentSettingsDto): Promise<PaymentSettings> {
    const normalized: PaymentSettings = {
      bankTransferEnabled: dto.bankTransferEnabled,
      bankName: dto.bankName?.trim() ?? '',
      accountType: dto.accountType ?? 'SAVINGS',
      accountNumber: dto.accountNumber?.trim() ?? '',
      accountHolder: dto.accountHolder?.trim() ?? '',
      instructions: dto.instructions?.trim() ?? '',
    };
    if (normalized.bankTransferEnabled && !isBankTransferConfigured(normalized)) {
      throw new BadRequestException('Para activar transferencias debes registrar banco, número de cuenta y titular');
    }
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { paymentSettings: normalized as unknown as Prisma.InputJsonValue },
      select: { paymentSettings: true },
    });
    return tenant.paymentSettings as unknown as PaymentSettings;
  }

  applyTemplate(tenantId: string, codeOrId: string) {
    return this.templates.applyContent(tenantId, codeOrId);
  }

  // ---------- Equipo ----------

  listMembers(tenantId: string) {
    return Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
      }),
    ]).then(([members, invitations]) => ({ members, invitations }));
  }

  async invite(tenantId: string, dto: InviteUserDto) {
    const email = dto.email.toLowerCase();
    const [tenant, existing, agents] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } }),
      this.prisma.user.findUnique({ where: { email } }),
      this.prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
    ]);
    if (existing) throw new ConflictException('Ese correo ya tiene una cuenta');
    const limits = await this.plans.getLimits(tenant.plan);
    if (agents >= limits.agents) throw new ConflictException(`Tu plan permite hasta ${limits.agents} usuarios`);

    const token = randomBytes(32).toString('hex');
    await this.prisma.invitation.deleteMany({ where: { tenantId, email } });
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email,
        role: dto.role as UserRole,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    // El envío de correo llega con el módulo de notificaciones; mientras tanto el panel muestra el enlace.
    return { id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt, token };
  }

  async updateMember(tenantId: string, actorId: string, userId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!member) throw new NotFoundException('Usuario no encontrado');
    if (member.role === UserRole.OWNER) throw new ForbiddenException('El propietario no se puede modificar desde aquí');
    if (member.id === actorId) throw new ForbiddenException('No puedes modificar tu propio usuario');
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role as UserRole | undefined, status: dto.status },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  }

  async revokeInvitation(tenantId: string, id: string) {
    const deleted = await this.prisma.invitation.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) throw new NotFoundException('Invitación no encontrada');
    return { ok: true };
  }

  // ---------- Widget keys ----------

  listWidgetKeys(tenantId: string) {
    return this.prisma.widgetKey.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  }

  createWidgetKey(tenantId: string, dto: CreateWidgetKeyDto) {
    return this.prisma.widgetKey.create({
      data: {
        tenantId,
        name: dto.name,
        allowedDomains: dto.allowedDomains.map(normalizeDomain).filter(Boolean),
        key: `wk_${randomBytes(18).toString('base64url')}`,
      },
    });
  }

  async updateWidgetKey(tenantId: string, id: string, dto: UpdateWidgetKeyDto) {
    const key = await this.prisma.widgetKey.findFirst({ where: { id, tenantId } });
    if (!key) throw new NotFoundException('Clave de widget no encontrada');
    return this.prisma.widgetKey.update({
      where: { id },
      data: { name: dto.name, active: dto.active, allowedDomains: dto.allowedDomains?.map(normalizeDomain).filter(Boolean) },
    });
  }

  async deleteWidgetKey(tenantId: string, id: string) {
    const deleted = await this.prisma.widgetKey.deleteMany({ where: { id, tenantId } });
    if (deleted.count === 0) throw new NotFoundException('Clave de widget no encontrada');
    return { ok: true };
  }

  // ---------- Helpers ----------

  private normalize<T extends { branding: unknown; settings: unknown; chatSettings: unknown; botSettings: unknown; storefront: unknown }>(tenant: T) {
    return {
      ...tenant,
      branding: parseConfig(brandingSchema, tenant.branding),
      settings: parseConfig(tenantSettingsSchema, tenant.settings),
      chatSettings: parseConfig(chatSettingsSchema, tenant.chatSettings),
      botSettings: parseConfig(botSettingsSchema, tenant.botSettings),
      storefront: parseConfig(storefrontSchema, tenant.storefront),
    };
  }
}

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}
