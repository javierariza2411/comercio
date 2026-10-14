import { Global, Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { TemplatesService } from './templates.service';

@Global()
@Module({
  providers: [PlansService, TemplatesService],
  exports: [PlansService, TemplatesService],
})
export class PlatformModule {}
