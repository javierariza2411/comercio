import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ChatEvents } from './chat-events';
import { ChatService } from './chat.service';
import { InboxController } from './inbox.controller';
import { WidgetController } from './widget.controller';
import { WidgetGuard } from './widget-auth';
import { StoreAssistantController } from './store-assistant.controller';
import { StoreAssistantService } from './store-assistant.service';
import { FaqModule } from '../faq/faq.module';

/**
 * El módulo de IA (AiModule) provee `BotOrchestrator`; ChatModule solo declara la dependencia.
 * Se registra con forwardRef desde AiModule para evitar ciclos.
 */
@Module({
  imports: [forwardRef(() => AiModule), FaqModule],
  providers: [ChatEvents, ChatService, WidgetGuard, StoreAssistantService],
  controllers: [WidgetController, InboxController, StoreAssistantController],
  exports: [ChatEvents, ChatService],
})
export class ChatModule {}
