import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateVariantDto,
  ProductQueryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './dto/catalog.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('public/:tenantSlug')
  @ApiOperation({ summary: 'Catálogo público de un comercio' })
  getPublicCatalog(@Param('tenantSlug') tenantSlug: string) {
    return this.catalogService.getPublicCatalog(tenantSlug);
  }

  // ---- Categorías (gestión) ----

  @Get('categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listCategories(@CurrentUser('tenantId') tenantId: string) {
    return this.catalogService.listCategories(tenantId);
  }

  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  createCategory(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(tenantId, dto);
  }

  @Patch('categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  deleteCategory(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deleteCategory(tenantId, id);
  }

  // ---- Productos (gestión) ----

  @Get('products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listProducts(@CurrentUser('tenantId') tenantId: string, @Query() query: ProductQueryDto) {
    return this.catalogService.listProducts(tenantId, query);
  }

  @Get('products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getProduct(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.getProduct(tenantId, id);
  }

  @Post('products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  createProduct(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateProductDto) {
    return this.catalogService.createProduct(tenantId, dto);
  }

  @Patch('products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateProduct(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(tenantId, id, dto);
  }

  @Delete('products/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  deleteProduct(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deleteProduct(tenantId, id);
  }

  // ---- Variantes ----

  @Post('products/:productId/variants')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  createVariant(
    @CurrentUser('tenantId') tenantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.catalogService.createVariant(tenantId, productId, dto);
  }

  @Patch('variants/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  updateVariant(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.catalogService.updateVariant(tenantId, id, dto);
  }

  @Delete('variants/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  deleteVariant(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.catalogService.deleteVariant(tenantId, id);
  }
}
