import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('public/:businessSlug')
  getPublicCatalogByBusinessSlug(@Param('businessSlug') businessSlug: string) {
    return this.catalogService.getPublicCatalogByBusinessSlug(businessSlug);
  }

  @Get('items')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  getItemsByBusiness(@Req() req: any) {
    return this.catalogService.getItemsByBusiness(req.user.businessId);
  }

  @Get('items/:slug')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  getItemBySlug(@Req() req: any, @Param('slug') slug: string) {
    return this.catalogService.getItemBySlug(req.user.businessId, slug);
  }

  @Post('items')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  createItem(@Body() payload: any) {
    return this.catalogService.createItem(payload);
  }

  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  createCategory(@Body() payload: any) {
    return this.catalogService.createCategory(payload);
  }
}
