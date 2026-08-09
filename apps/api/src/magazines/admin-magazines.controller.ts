import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import {
  CompleteMagazinePdfDto,
  CreateMagazineDto,
  PresignMagazinePdfDto,
  UpdateMagazineDto,
} from './dto/admin-magazine.dto';
import { MagazinesService } from './magazines.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('admin/magazines')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminMagazinesController {
  constructor(private readonly magazines: MagazinesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('published') published?: string,
    @Query('active') active?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.magazines.list({
      q,
      published,
      active,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.magazines.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateMagazineDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMagazineDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.update(id, dto, actor.id);
  }

  @Post(':id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5_000_000 },
    }),
  )
  uploadCover(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.magazines.uploadCover(id, file, actor.id);
  }

  @Post(':id/pdf/presign')
  presignPdf(
    @Param('id') id: string,
    @Body() dto: PresignMagazinePdfDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.presignPdf(id, dto, actor.id);
  }

  @Post(':id/pdf/complete')
  completePdf(
    @Param('id') id: string,
    @Body() dto: CompleteMagazinePdfDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.completePdf(id, dto, actor.id);
  }

  @Post(':id/pages/reprocess')
  reprocessPages(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.reprocessPages(id, actor.id);
  }

  /** Démarre / reprend la génération (sans purge). No-op si déjà READY. */
  @Post(':id/pages/ensure')
  ensurePages(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.magazines.ensurePages(id, actor.id);
  }

  /** Fallback proxy (petits PDF / outils). Préférer /pdf/presign. */
  @Post(':id/pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 350_000_000 },
    }),
  )
  uploadPdf(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.magazines.uploadPdf(id, file, actor.id);
  }
}
