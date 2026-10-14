import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { validateEnv } from './config/env';
import { AiModule } from './modules/ai/ai.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FaqModule } from './modules/faq/faq.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlatformModule } from './modules/platform/platform.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '../../.env'],
      validate: validateEnv,
    }),
    // Límite global: 100 peticiones/min por IP. Endpoints sensibles usan @Throttle con límites más estrictos.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    PlatformModule,
    AuthModule,
    TenantsModule,
    CatalogModule,
    FaqModule,
    OrdersModule,
    ChatModule,
    AiModule,
    AssetsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
