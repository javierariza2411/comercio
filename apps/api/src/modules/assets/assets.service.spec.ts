import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';
import { AssetsService } from './assets.service';

function file(mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'image.bin',
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    stream: undefined!,
    destination: '',
    filename: '',
    path: '',
  };
}

describe('AssetsService', () => {
  const prisma = {} as PrismaService;
  const plans = {} as PlansService;

  it('rechaza la subida cuando storage no está configurado', async () => {
    const config = { get: vi.fn((_key: string, fallback?: unknown) => fallback) } as unknown as ConfigService;
    const service = new AssetsService(config, prisma, plans);

    await expect(service.uploadImage('tenant', file('image/png', Buffer.alloc(8)))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('no confía solo en el MIME declarado por el navegador', async () => {
    const values: Record<string, unknown> = {
      S3_ENDPOINT: 'https://storage.example.test',
      S3_ACCESS_KEY: 'access',
      S3_SECRET_KEY: 'secret',
    };
    const config = { get: vi.fn((key: string, fallback?: unknown) => values[key] ?? fallback) } as unknown as ConfigService;
    const service = new AssetsService(config, prisma, plans);

    await expect(service.uploadImage('tenant', file('image/png', Buffer.from('not-a-png')))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
