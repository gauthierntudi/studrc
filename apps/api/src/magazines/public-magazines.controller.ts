import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MagazinesService } from './magazines.service';

@Controller('magazines')
export class PublicMagazinesController {
  constructor(private readonly magazines: MagazinesService) {}

  @Get()
  list(@Query('take') take?: string, @Query('skip') skip?: string) {
    const n = take ? Number(take) : 12;
    const s = skip ? Number(skip) : 0;
    return this.magazines.listPublished(
      Number.isFinite(n) ? n : 12,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get('latest')
  latest() {
    return this.magazines.getLatestPublished();
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.magazines.getPublishedById(id);
  }

  /** Aperçu public — 15 premières pages, sans authentification. */
  @Get(':id/preview')
  preview(@Param('id') id: string) {
    return this.magazines.getPreviewSession(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.magazines.getReaderSession(id, user.id);
  }
}
