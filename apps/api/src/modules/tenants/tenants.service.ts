import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.module';
import { PaymentSettingsDto, UpdateTenantDto } from './dto/tenant.dto';

export interface PaymentSettings {
  bankTransferEnabled: boolean;
  bankName?: string;
  accountType?: 'SAVINGS' | 'CHECKING';
  accountNumber?: string;
  accountHolder?: string;
  instructions?: string;
}

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
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    return tenant;
  }

  async findPublicBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug }, select: PUBLIC_SELECT });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    const payment = tenant.paymentSettings as PaymentSettings | null;
    return {
      ...tenant,
      paymentSettings: isBankTransferConfigured(payment) ? payment : { bankTransferEnabled: false },
    };
  }

  async update(id: string, dto: UpdateTenantDto) {
    const current = await this.findById(id);
    // Los DTOs anidados traen como `undefined` las propiedades no enviadas; se descartan antes de mezclar.
    const merge = (key: 'branding' | 'settings' | 'chatSettings' | 'address' | 'socialNetworks') =>
      dto[key] === undefined
        ? undefined
        : ({ ...(current[key] as object), ...compact(dto[key] as Record<string, unknown>) } as Prisma.InputJsonObject);

    return this.prisma.tenant.update({
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
      },
    });
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
}
