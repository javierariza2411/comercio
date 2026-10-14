import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.module';
import { OrdersService } from './orders.service';

describe('OrdersService.createBankTransferOrder', () => {
  const tenant = {
    id: 't1',
    slug: 'demo',
    settings: { currency: 'COP' },
    paymentSettings: { bankTransferEnabled: true, bankName: 'B', accountNumber: '123456', accountHolder: 'Demo SAS', accountType: 'SAVINGS', instructions: '' },
  };
  const product = { id: 'p1', slug: 'reloj', name: 'Reloj', priceCents: 10_000, trackStock: true, stock: 3, active: true };

  function buildService(updateCount: number) {
    const tx = {
      product: { findMany: vi.fn().mockResolvedValue([product]), updateMany: vi.fn().mockResolvedValue({ count: updateCount }) },
      order: { create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, status: 'PENDING_TRANSFER' })) },
    };
    const prisma = {
      tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
      $transaction: vi.fn().mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    return { service: new OrdersService(prisma as unknown as PrismaService), tx, prisma };
  }

  const dto = { name: 'Cliente', phone: '3001234567', city: 'Bogotá', address: 'Calle 1 # 2-3', items: [{ productSlug: 'reloj', quantity: 2 }, { productSlug: 'reloj', quantity: 1 }] };

  it('agrupa cantidades repetidas y decrementa stock de forma condicional', async () => {
    const { service, tx } = buildService(1);
    const result = await service.createBankTransferOrder('demo', dto);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(result.totalCents).toBe(30_000);
    expect(result.bankTransfer.accountNumber).toBe('123456');
  });

  it('falla (y la transacción se revierte) si el stock condicional no alcanza', async () => {
    const { service, tx } = buildService(0);
    await expect(service.createBankTransferOrder('demo', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rechaza pedidos si el comercio no configuró transferencias', async () => {
    const { service, prisma } = buildService(1);
    prisma.tenant.findUnique.mockResolvedValue({ ...tenant, paymentSettings: { bankTransferEnabled: false } });
    await expect(service.createBankTransferOrder('demo', dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
