import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
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
  read(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('refresh') refresh?: string,
  ) {
    return this.magazines.getReaderSession(id, user.id, {
      refresh: refresh === '1' || refresh === 'true',
    });
  }

  /**
   * Proxy image page (WebP) — pas d’URL R2 exposée.
   * Cookie JWT optionnel : requis au-delà de l’aperçu (15 pages).
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/pages/:pageNumber')
  async pageImage(
    @Param('id') id: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Query('thumb') thumb: string | undefined,
    @CurrentUser() user: AuthUser | null,
    @Res() res: Response,
  ) {
    const stream = await this.magazines.streamMagazinePage(id, pageNumber, {
      thumb: thumb === '1' || thumb === 'true',
      subscriberId: user?.id ?? null,
    });

    res.setHeader('Content-Type', stream.contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (stream.contentLength != null) {
      res.setHeader('Content-Length', String(stream.contentLength));
    }

    stream.body.on('error', () => {
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.destroy();
      }
    });
    stream.body.pipe(res);
  }
}
