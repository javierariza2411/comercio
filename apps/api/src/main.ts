import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp, defaultWidgetAssetsDir } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  configureApp(app, { frontendUrls: config.get<string>('FRONTEND_URL', 'http://localhost:3000'), widgetAssetsDir: defaultWidgetAssetsDir() });

  if (nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SmartCommerce API')
        .setDescription('API multi-tenant de chat web para comercios')
        .setVersion('0.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  Logger.log(`SmartCommerce API escuchando en http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
