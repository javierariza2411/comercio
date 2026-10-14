import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateFaqDto, SearchFaqDto, UpdateFaqDto } from './dto/faq.dto';
import { FaqService } from './faq.service';

@ApiTags('faq')
@ApiBearerAuth()
@Controller('faq')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  list(@CurrentUser('tenantId') tenantId: string, @Query('includeInactive') includeInactive?: string) {
    return this.faqService.list(tenantId, includeInactive === 'true');
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateFaqDto) {
    return this.faqService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  update(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.faqService.remove(tenantId, id);
  }

  @Post('search')
  @HttpCode(200)
  search(@CurrentUser('tenantId') tenantId: string, @Body() dto: SearchFaqDto) {
    return this.faqService.search(tenantId, dto.query);
  }
}
