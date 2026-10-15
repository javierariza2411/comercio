import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { parseConfig, tenantSettingsSchema } from '../../config/tenant-config';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';
import { isBankTransferConfigured, PaymentSettings } from '../tenants/tenants.service';
import { CreateOrderDto } from './dto/order.dto';

export interface OrderLine {
  productId: string;
  productSlug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async createBankTransferOrder(tenantSlug: string, dto: CreateOrderDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');

    const payment = tenant.paymentSettings as PaymentSettings | null;
    if (!isBankTransferConfigured(payment)) {
      throw new BadRequestException('Este comercio todavía no ha configurado transferencias bancarias');
    }

    const limits = await this.plans.getLimits(tenant.plan);
    if (dto.items.length > limits.orderMaxItems) {
      throw new BadRequestException(`Un pedido admite máximo ${limits.orderMaxItems} productos distintos`);
    }

    // Agrupa cantidades por slug para que el descuento de stock sea correcto si se repite un producto.
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(item.productSlug, (quantities.get(item.productSlug) ?? 0) + item.quantity);
    }
    for (const [slug, quantity] of quantities) {
      if (quantity > limits.orderMaxQtyPerItem) {
        throw new BadRequestException(`Máximo ${limits.orderMaxQtyPerItem} unidades de ${slug} por pedido`);
      }
    }
    const settings = parseConfig(tenantSettingsSchema, tenant.settings);
    const shippingZone = dto.shippingZoneId
      ? await this.prisma.shippingZone.findFirst({ where: { id: dto.shippingZoneId, tenantId: tenant.id, active: true } })
      : null;
    if (dto.shippingZoneId && !shippingZone) throw new BadRequestException('La opción de envío ya no está disponible');

    const order = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, slug: { in: [...quantities.keys()] }, active: true },
      });
      const bySlug = new Map(products.map((p) => [p.slug, p]));

      const lines: OrderLine[] = [];
      for (const [slug, quantity] of quantities) {
        const product = bySlug.get(slug);
        if (!product) throw new BadRequestException(`El producto ${slug} ya no está disponible`);
        const unitPriceCents = effectiveProductPrice(product);
        if (unitPriceCents <= 0) throw new BadRequestException(`El precio de ${product.name} no es válido`);

        if (product.trackStock) {
          // Decremento condicional: si otra transacción agotó el stock, count = 0 y se revierte todo.
          const updated = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (updated.count === 0) throw new BadRequestException(`${product.name} no tiene unidades suficientes`);
        }

        lines.push({
          productId: product.id,
          productSlug: slug,
          name: product.name,
          unitPriceCents,
          quantity,
          lineTotalCents: unitPriceCents * quantity,
        });
      }

      const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const shippingCents = shippingZone && (!shippingZone.freeAboveCents || subtotalCents < shippingZone.freeAboveCents) ? shippingZone.priceCents : 0;
      const totalCents = subtotalCents + shippingCents;
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new BadRequestException('El total del pedido no es válido');

      return tx.order.create({
        data: {
          tenantId: tenant.id,
          orderNumber: `${settings.orderPrefix}-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
          items: lines as unknown as Prisma.InputJsonValue,
          customer: {
            name: dto.name,
            email: dto.email ?? '',
            phone: dto.phone,
            city: dto.city,
            address: dto.address,
            lastName: dto.lastName ?? '',
            document: dto.document ?? '',
            addressComplement: dto.addressComplement ?? '',
            region: dto.region ?? '',
            postalCode: dto.postalCode ?? '',
          },
          shipping: shippingZone ? { zoneId: shippingZone.id, name: shippingZone.name, etaMinDays: shippingZone.etaMinDays, etaMaxDays: shippingZone.etaMaxDays } : { name: 'Entrega acordada con el comercio' },
          subtotalCents,
          shippingCents,
          totalCents,
          currency: settings.currency,
        } as Prisma.OrderUncheckedCreateInput,
      });
    });

    const orderWithCheckout = order as typeof order & { subtotalCents: number; shippingCents: number };

    return {
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
      subtotalCents: orderWithCheckout.subtotalCents,
      shippingCents: orderWithCheckout.shippingCents,
      currency: order.currency,
      status: order.status,
      bankTransfer: {
        bankName: payment.bankName,
        accountType: payment.accountType,
        accountNumber: payment.accountNumber,
        accountHolder: payment.accountHolder,
        instructions: payment.instructions,
      },
    };
  }

  async shippingZones(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Comercio no encontrado');
    return this.prisma.shippingZone.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ priceCents: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, cities: true, priceCents: true, freeAboveCents: true, etaMinDays: true, etaMaxDays: true },
    });
  }

  list(tenantId: string, limit = 100) {
    return this.prisma.order.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async confirmTransfer(tenantId: string, orderNumber: string) {
    const updated = await this.prisma.order.updateMany({
      where: { tenantId, orderNumber, status: OrderStatus.PENDING_TRANSFER },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundException('Pedido pendiente no encontrado');
    return this.prisma.order.findUnique({ where: { orderNumber } });
  }

  async updateStatus(tenantId: string, orderNumber: string, status: 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED') {
    const order = await this.prisma.order.findFirst({ where: { tenantId, orderNumber } });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        paidAt: status === 'PAID' && !order.paidAt ? new Date() : undefined,
        shippedAt: status === 'SHIPPED' ? new Date() : undefined,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      } as Prisma.OrderUncheckedUpdateInput,
    });
  }
}

function effectiveProductPrice(product: { priceCents: number; compareAtPriceCents: number | null; metadata: unknown }) {
  if (!product.compareAtPriceCents) return product.priceCents;
  const offer = (product.metadata as { offer?: { enabled?: boolean; startsAt?: string; endsAt?: string } } | null)?.offer;
  // Productos antiguos ya usaban compareAtPriceCents como referencia visual sin vigencia administrada.
  if (!offer) return product.priceCents;
  if (!offer?.enabled) return product.compareAtPriceCents;
  const now = Date.now();
  const startsAt = offer.startsAt ? Date.parse(offer.startsAt) : Number.NEGATIVE_INFINITY;
  const endsAt = offer.endsAt ? Date.parse(offer.endsAt) : Number.POSITIVE_INFINITY;
  return now >= startsAt && now <= endsAt ? product.priceCents : product.compareAtPriceCents;
}
