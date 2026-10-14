import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.module';
import { AuthService } from './auth.service';

function buildPrismaMock() {
  return {
    user: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    tenant: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AuthService;
  const jwt = { signAsync: vi.fn().mockResolvedValue('access.jwt') } as unknown as JwtService;
  const config = { get: vi.fn().mockReturnValue(7) } as unknown as ConfigService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  });

  it('rechaza login con contraseña incorrecta sin revelar si el usuario existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'x@x.com', password: 'nope12345' })).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'ACTIVE', passwordHash: await bcrypt.hash('otra12345', 4) });
    await expect(service.login({ email: 'x@x.com', password: 'nope12345' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('emite access + refresh y guarda solo el hash del refresh', async () => {
    const user = { id: 'u1', email: 'a@a.com', tenantId: 't1', role: 'OWNER', status: 'ACTIVE', name: 'A', passwordHash: await bcrypt.hash('clave12345', 4), tenant: { id: 't1' } };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login({ email: 'A@a.com', password: 'clave12345' });

    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toHaveLength(96);
    const stored = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).not.toBe(result.refreshToken);
    expect(stored.tokenHash).toHaveLength(64);
  });

  it('rota el refresh token y rechaza tokens revocados o expirados', async () => {
    const user = { id: 'u1', email: 'a@a.com', tenantId: 't1', role: 'OWNER', status: 'ACTIVE' };
    prisma.refreshToken.findUnique.mockResolvedValueOnce({ id: 'r1', revokedAt: null, expiresAt: new Date(Date.now() + 1000), user });
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const rotated = await service.refresh('a'.repeat(96));
    expect(rotated.accessToken).toBe('access.jwt');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1' } }));

    prisma.refreshToken.findUnique.mockResolvedValueOnce({ id: 'r2', revokedAt: new Date(), expiresAt: new Date(Date.now() + 1000), user });
    await expect(service.refresh('b'.repeat(96))).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.refreshToken.findUnique.mockResolvedValueOnce({ id: 'r3', revokedAt: null, expiresAt: new Date(Date.now() - 1000), user });
    await expect(service.refresh('c'.repeat(96))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('no permite registrar dos cuentas con el mismo correo', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.register({ name: 'A', email: 'a@a.com', password: 'clave12345', businessName: 'Tienda' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
