import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  CompleteStatusVideoDto,
  CreateStatusDto,
  CreateStatusSlideDto,
  MergeStatusDto,
  MoveStatusDto,
  PresignStatusVideoDto,
  ReorderStatusSlidesDto,
  UpdateStatusDto,
  UpdateStatusSlideDto,
} from './dto/admin-status.dto';
import { StatusesService } from './statuses.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const imageUpload = () =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10_000_000 },
  });

@Controller('admin/statuses')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminStatusesController {
  constructor(private readonly statuses: StatusesService) {}

  // ------------------------------------------------------------- statuts

  @Get()
  list(
    @Query('state') state?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.statuses.list({
      state,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.statuses.getById(id);
  }

  @Post()
  create(@Body() dto: CreateStatusDto, @CurrentAdmin() actor: AdminAuthUser) {
    return this.statuses.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.update(id, dto, actor.id);
  }

  /** Monte / descend un statut en ligne dans l’ordre des bulles */
  @Post(':id/move')
  move(
    @Param('id') id: string,
    @Body() dto: MoveStatusDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.move(id, dto.direction, actor.id);
  }

  /** Regroupe ce statut dans un autre (ses diapos passent à la suite) */
  @Post(':id/merge')
  merge(
    @Param('id') id: string,
    @Body() dto: MergeStatusDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.merge(id, dto.targetId, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.statuses.remove(id, actor.id);
  }

  // -------------------------------------------------------------- diapos

  @Post(':id/slides')
  createSlide(
    @Param('id') id: string,
    @Body() dto: CreateStatusSlideDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.createSlide(id, dto, actor.id);
  }

  @Put(':id/slides/order')
  reorderSlides(
    @Param('id') id: string,
    @Body() dto: ReorderStatusSlidesDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.reorderSlides(id, dto.ids, actor.id);
  }

  @Patch('slides/:slideId')
  updateSlide(
    @Param('slideId') slideId: string,
    @Body() dto: UpdateStatusSlideDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.updateSlide(slideId, dto, actor.id);
  }

  @Delete('slides/:slideId')
  removeSlide(
    @Param('slideId') slideId: string,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.removeSlide(slideId, actor.id);
  }

  @Post('slides/:slideId/image')
  @UseInterceptors(imageUpload())
  uploadImage(
    @Param('slideId') slideId: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.statuses.uploadImage(slideId, file, actor.id);
  }

  @Post('slides/:slideId/poster')
  @UseInterceptors(imageUpload())
  uploadPoster(
    @Param('slideId') slideId: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.statuses.uploadPoster(slideId, file, actor.id);
  }

  @Post('slides/:slideId/video/presign')
  presignVideo(
    @Param('slideId') slideId: string,
    @Body() dto: PresignStatusVideoDto,
  ) {
    return this.statuses.presignVideo(slideId, dto);
  }

  @Post('slides/:slideId/video/complete')
  completeVideo(
    @Param('slideId') slideId: string,
    @Body() dto: CompleteStatusVideoDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.statuses.completeVideo(slideId, dto, actor.id);
  }
}
