import {
  Controller,
  Delete,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssetsService } from './assets.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post('images')
  @ApiOperation({ summary: 'Subir una imagen al almacenamiento del comercio' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: MAX_IMAGE_BYTES } }))
  uploadImage(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp|image\/gif)$/ })
        .addMaxSizeValidator({ maxSize: MAX_IMAGE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    return this.assets.uploadImage(tenantId, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un archivo propio' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.remove(tenantId, id);
  }
}
