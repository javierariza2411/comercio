import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatEvents } from './chat-events';
import { ChatService } from './chat.service';
import { InboxController } from './inbox.controller';
import { WidgetController } from './widget.controller';
import { WidgetGuard } from './widget-auth';

/**
 * El módulo de IA (AiModule) provee `BotOrchestrator`; ChatModule solo declara la dependencia.
 * Se registra con forwardRef desde AiModule para evitar ciclos.
 */
@Module({
  imports: [forwardRef(() => AiModule)],
  providers: [ChatEvents, ChatService, WidgetGuard],
  controllers: [WidgetController, InboxController],
  exports: [ChatEvents, ChatService],
})
export class ChatModule {}
