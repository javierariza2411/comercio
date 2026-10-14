import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.module';
import { PlansService } from '../platform/plans.service';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

@Injectable()
export class AssetsService {
  private readonly client?: S3Client;
  private readonly endpoint?: string;
  private readonly bucket: string;
  private readonly publicUrl?: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {
    this.endpoint = config.get<string>('S3_ENDPOINT') ?? config.get<string>('AWS_ENDPOINT_URL_S3');
    this.bucket = config.get<string>('S3_BUCKET', 'smartcommerce');
    this.publicUrl = config.get<string>('S3_PUBLIC_URL');
    const accessKeyId = config.get<string>('S3_ACCESS_KEY') ?? config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('S3_SECRET_KEY') ?? config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (this.endpoint && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        endpoint: this.endpoint,
        region: config.get<string>('S3_REGION') ?? config.get<string>('AWS_REGION') ?? 'us-east-1',
        forcePathStyle: config.get<boolean>('S3_FORCE_PATH_STYLE', true),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  async uploadImage(tenantId: string, file: Express.Multer.File) {
    if (!this.client || !this.endpoint) {
      throw new ServiceUnavailableException('El almacenamiento de imágenes no está configurado');
    }
    const extension = EXTENSIONS[file.mimetype];
    if (!extension || !this.hasValidSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('El archivo no contiene una imagen JPEG, PNG, WebP o GIF válida');
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } });
    const limits = await this.plans.getLimits(tenant.plan);
    const used = await this.prisma.asset.aggregate({ where: { tenantId }, _sum: { sizeBytes: true } });
    if ((used._sum.sizeBytes ?? 0) + file.size > limits.storageMb * 1024 * 1024) {
      throw new ConflictException(`Tu plan permite hasta ${limits.storageMb} MB de archivos`);
    }

    const key = `tenants/${tenantId}/products/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const url = this.objectUrl(key);
    try {
      return await this.prisma.asset.create({
        data: { tenantId, bucketKey: key, mime: file.mimetype, sizeBytes: file.size, kind: 'IMAGE', publicUrl: url },
        select: { id: true, publicUrl: true, mime: true, sizeBytes: true },
      });
    } catch (error) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
      throw error;
    }
  }

  async remove(tenantId: string, id: string) {
    if (!this.client) throw new ServiceUnavailableException('El almacenamiento de imágenes no está configurado');
    const asset = await this.prisma.asset.findFirst({ where: { id, tenantId } });
    if (!asset) throw new NotFoundException('Archivo no encontrado');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.bucketKey }));
    await this.prisma.asset.delete({ where: { id } });
    return { ok: true };
  }

  private objectUrl(key: string) {
    const base = (this.publicUrl ?? `${this.endpoint}/${this.bucket}`).replace(/\/$/, '');
    return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private hasValidSignature(buffer: Buffer, mime: string) {
    if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mime === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
    if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    return false;
  }
}
