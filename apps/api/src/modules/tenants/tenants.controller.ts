import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../common/auth-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TemplatesService } from '../platform/templates.service';
import { CreateWidgetKeyDto, InviteUserDto, UpdateMemberDto, UpdateWidgetKeyDto } from './dto/team.dto';
import { PaymentSettingsDto, UpdateTenantDto } from './dto/tenant.dto';
import { TenantsService } from './tenants.service';

const MANAGERS = [UserRole.OWNER, UserRole.ADMIN];

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly templates: TemplatesService,
  ) {}

  @Get('public/:slug')
  @ApiOperation({ summary: 'Datos públicos de un comercio (storefront / widget)' })
  findPublic(@Param('slug') slug: string) {
    return this.tenantsService.findPublicBySlug(slug);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Plantillas de industria disponibles' })
  listTemplates() {
    return this.templates.list();
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.findById(tenantId);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(user.tenantId, dto);
  }

  @Patch('me/payment-settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  updatePaymentSettings(@CurrentUser() user: AuthUser, @Body() dto: PaymentSettingsDto) {
    return this.tenantsService.updatePaymentSettings(user.tenantId, dto);
  }

  @Post('me/apply-template/:code')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Aplica configuración y contenido de ejemplo de una plantilla de industria' })
  applyTemplate(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.tenantsService.applyTemplate(user.tenantId, code);
  }

  // ---- Equipo ----

  @Get('me/team')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  team(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.listMembers(tenantId);
  }

  @Post('me/team/invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  invite(@CurrentUser('tenantId') tenantId: string, @Body() dto: InviteUserDto) {
    return this.tenantsService.invite(tenantId, dto);
  }

  @Delete('me/team/invitations/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  revokeInvitation(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.revokeInvitation(tenantId, id);
  }

  @Patch('me/team/:userId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  updateMember(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateMemberDto) {
    return this.tenantsService.updateMember(user.tenantId, user.id, userId, dto);
  }

  // ---- Widget keys ----

  @Get('me/widget-keys')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  widgetKeys(@CurrentUser('tenantId') tenantId: string) {
    return this.tenantsService.listWidgetKeys(tenantId);
  }

  @Post('me/widget-keys')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  createWidgetKey(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateWidgetKeyDto) {
    return this.tenantsService.createWidgetKey(tenantId, dto);
  }

  @Patch('me/widget-keys/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  updateWidgetKey(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWidgetKeyDto) {
    return this.tenantsService.updateWidgetKey(tenantId, id, dto);
  }

  @Delete('me/widget-keys/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  deleteWidgetKey(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deleteWidgetKey(tenantId, id);
  }
}
