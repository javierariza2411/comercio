import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';

/** Configuración común de la app HTTP, compartida por `main.ts` y las pruebas e2e. */
export interface AppSetupOptions {
  frontendUrls: string;
  /** Carpeta con embed.js / widget.html compilados (packages/widget/dist). Si no existe, no se sirve. */
  widgetAssetsDir?: string;
}

export function configureApp(app: NestExpressApplication, options: AppSetupOptions | string) {
  const { frontendUrls, widgetAssetsDir } = typeof options === 'string' ? { frontendUrls: options, widgetAssetsDir: undefined } : options;
  // FRONTEND_URL admite varios orígenes separados por coma (panel, storefront, dominio del widget).
  const origins = frontendUrls.split(',').map((url) => url.trim()).filter(Boolean);
  // Necesario detrás de Railway/Vercel para que el throttler vea la IP real del cliente.
  app.set('trust proxy', 1);
  const WIDGET_PREFIX = '/widget-assets';
  const globalHelmet = helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } });
  // Assets del widget: deben incrustarse en cualquier sitio (iframe) y cargar imágenes externas de productos,
  // así que llevan su propio conjunto de cabeceras en lugar del helmet global.
  const widgetHelmet = helmet({
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    originAgentCluster: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ['*', 'data:', 'blob:'],
        connectSrc: ['*'],
        frameAncestors: ['*'],
        upgradeInsecureRequests: null,
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith(WIDGET_PREFIX) ? widgetHelmet(req, res, next) : globalHelmet(req, res, next),
  );
  app.use(compression());
  // Las rutas del widget se consumen desde cualquier sitio web: CORS abierto; la autorización la hace WidgetGuard.
  app.use('/widget', cors({ origin: true, allowedHeaders: ['Content-Type', 'X-Widget-Key', 'X-Widget-Host', 'Last-Event-ID'] }));
  if (widgetAssetsDir && existsSync(widgetAssetsDir)) {
    app.useStaticAssets(widgetAssetsDir, { prefix: `${WIDGET_PREFIX}/`, maxAge: '1h', setHeaders: (res) => res.setHeader('Access-Control-Allow-Origin', '*') });
  }
  app.enableCors({
    origin: (origin, callback) => {
      // Sin Origin (curl, server-to-server) o rutas del widget (validadas por WidgetKey) se permiten.
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();
}

export function defaultWidgetAssetsDir() {
  if (process.env.WIDGET_ASSETS_DIR) return process.env.WIDGET_ASSETS_DIR;
  // Busca packages/widget/dist subiendo desde dist/ o src/ (monorepo local). En producción se usa WIDGET_ASSETS_DIR o un CDN.
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'packages', 'widget', 'dist');
    if (existsSync(candidate)) return candidate;
    dir = join(dir, '..');
  }
  return undefined;
}
