import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.module';
import { normalizeDomain } from '../tenants/tenants.service';

export interface WidgetContext {
  tenantId: string;
  widgetKeyId: string;
  origin: string;
}

/**
 * Autentica peticiones del widget por `X-Widget-Key` y valida el dominio de origen contra la allowlist.
 * El tenant resultante se expone en `req.widget` y NUNCA se toma del body.
 */
@Injectable()
export class WidgetGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { widget?: WidgetContext }>();
    const key = (req.headers['x-widget-key'] as string | undefined) ?? (req.query.key as string | undefined);
    if (!key) throw new UnauthorizedException('Falta la clave del widget');

    const widgetKey = await this.prisma.widgetKey.findUnique({ where: { key }, include: { tenant: { select: { id: true, chatSettings: true } } } });
    if (!widgetKey || !widgetKey.active) throw new UnauthorizedException('Clave de widget inválida');

    // El iframe del widget corre en nuestro origen; el sitio del comercio llega en X-Widget-Host
    // (tomado de ancestorOrigins/referrer dentro del iframe) o en ?host= para EventSource.
    // Es un control contra incrustaciones no autorizadas desde navegadores; la clave es pública por diseño
    // y el abuso directo se limita con rate limiting y cuotas por plan.
    const hostHeader =
      (req.headers['x-widget-host'] as string | undefined) ??
      (req.query.host as string | undefined) ??
      (req.headers.origin as string | undefined) ??
      (req.headers.referer as string | undefined) ??
      '';
    const origin = hostHeader ? normalizeDomain(hostHeader) : '';
    if (widgetKey.allowedDomains.length > 0) {
      const allowed = origin !== '' && widgetKey.allowedDomains.some((domain) => origin === domain || origin.endsWith(`.${domain}`));
      if (!allowed) throw new ForbiddenException('Dominio no autorizado para este widget');
    }

    req.widget = { tenantId: widgetKey.tenantId, widgetKeyId: widgetKey.id, origin };
    return true;
  }
}

export const Widget = createParamDecorator((_data: unknown, ctx: ExecutionContext): WidgetContext => {
  return ctx.switchToHttp().getRequest().widget;
});
