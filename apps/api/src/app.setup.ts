import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';

/** Configuración común de la app HTTP, compartida por `main.ts` y las pruebas e2e. */
export function configureApp(app: NestExpressApplication, frontendUrl: string) {
  // Necesario detrás de Railway/Vercel para que el throttler vea la IP real del cliente.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
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
