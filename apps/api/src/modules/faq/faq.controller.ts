import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FaqService } from './faq.service';

@ApiTags('faq')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get('business')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  findByBusiness(@Req() req: any) {
    return this.faqService.findByBusiness(req.user.businessId);
  }

  @Post('query')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  query(@Req() req: any, @Body() body: { query: string }) {
    return this.faqService.queryByKeywords(req.user.businessId, body.query);
  }
}
