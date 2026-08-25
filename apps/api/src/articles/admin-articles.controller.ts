import {
  Body,
  Controller,
  Delete,
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
import { CreateArticleDto, UpdateArticleDto } from './dto/admin-article.dto';
import {
  CompleteArticleVideoDto,
  PresignArticleVideoDto,
} from './dto/admin-article-video.dto';
import { ArticlesService } from './articles.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('admin/articles')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('published') published?: string,
    @Query('category') category?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.articles.list({
      q,
      published,
      category,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.articles.getById(id);
  }

  @Post()
  create(
    @Body() dto: CreateArticleDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.articles.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.articles.update(id, dto, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.articles.remove(id, actor.id);
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
    return this.articles.uploadCover(id, file, actor.id);
  }

  @Post(':id/blocks/:blockId/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5_000_000 },
    }),
  )
  uploadBlockCover(
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.articles.uploadBlockCover(id, blockId, file, actor.id);
  }

  @Post(':id/video/presign')
  presignVideo(
    @Param('id') id: string,
    @Body() dto: PresignArticleVideoDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.articles.presignVideo(id, dto, actor.id);
  }

  @Post(':id/video/complete')
  completeVideo(
    @Param('id') id: string,
    @Body() dto: CompleteArticleVideoDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.articles.completeVideo(id, dto, actor.id);
  }

  @Post(':id/video/reprocess')
  reprocessVideo(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.articles.reprocessVideo(id, actor.id);
  }
}
