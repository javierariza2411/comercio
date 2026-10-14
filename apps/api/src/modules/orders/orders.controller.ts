import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOrderDto } from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':tenantSlug/bank-transfer')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear pedido con pago por transferencia (público)' })
  create(@Param('tenantSlug') tenantSlug: string, @Body() dto: CreateOrderDto) {
    return this.ordersService.createBankTransferOrder(tenantSlug, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.ordersService.list(tenantId);
  }

  @Patch(':orderNumber/confirm-transfer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  confirmTransfer(@CurrentUser('tenantId') tenantId: string, @Param('orderNumber') orderNumber: string) {
    return this.ordersService.confirmTransfer(tenantId, orderNumber);
  }
}
