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

    const order = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { tenantId: tenant.id, slug: { in: [...quantities.keys()] }, active: true },
      });
      const bySlug = new Map(products.map((p) => [p.slug, p]));

      const lines: OrderLine[] = [];
      for (const [slug, quantity] of quantities) {
        const product = bySlug.get(slug);
        if (!product) throw new BadRequestException(`El producto ${slug} ya no está disponible`);
        if (product.priceCents <= 0) throw new BadRequestException(`El precio de ${product.name} no es válido`);

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
          unitPriceCents: product.priceCents,
          quantity,
          lineTotalCents: product.priceCents * quantity,
        });
      }

      const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
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
          },
          totalCents,
          currency: settings.currency,
        },
      });
    });

    return {
      orderNumber: order.orderNumber,
      totalCents: order.totalCents,
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
}
