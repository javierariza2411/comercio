import { forwardRef, Module } from '@nestjs/common';
import { BotOrchestrator } from '../chat/bot-orchestrator';
import { ChatModule } from '../chat/chat.module';
import { FaqModule } from '../faq/faq.module';
import { AgentOrchestrator } from './agent/agent-orchestrator';
import { AgentService } from './agent/agent.service';
import { AiController } from './ai.controller';
import { LlmService } from './llm/llm.service';
import { ToolRegistry } from './tools/tool-registry';

@Module({
  imports: [forwardRef(() => ChatModule), FaqModule],
  controllers: [AiController],
  providers: [LlmService, ToolRegistry, AgentService, AgentOrchestrator, { provide: BotOrchestrator, useExisting: AgentOrchestrator }],
  exports: [BotOrchestrator, AgentService, LlmService],
})
export class AiModule {}
