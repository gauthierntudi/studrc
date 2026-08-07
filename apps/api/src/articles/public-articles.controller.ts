import { Controller, Get, Param, Query } from '@nestjs/common';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class PublicArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get('home')
  home() {
    return this.articles.getHomeFeed();
  }

  @Get('recent')
  recent(@Query('take') take?: string) {
    const n = take ? Number(take) : 3;
    return this.articles.listRecentPublished(Number.isFinite(n) ? n : 3);
  }

  @Get('random')
  random(@Query('take') take?: string) {
    const n = take ? Number(take) : 10;
    return this.articles.listRandomPublished(Number.isFinite(n) ? n : 10);
  }

  @Get('related')
  related(
    @Query('slug') slug?: string,
    @Query('take') take?: string,
  ) {
    const n = take ? Number(take) : 6;
    return this.articles.listRelatedPublished(
      slug?.trim() || '',
      Number.isFinite(n) ? n : 6,
    );
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('category') category?: string,
  ) {
    const n = take ? Number(take) : 10;
    const s = skip ? Number(skip) : 0;
    return this.articles.searchPublished(
      q ?? '',
      Number.isFinite(n) ? n : 10,
      category,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get('most-read')
  mostRead(@Query('take') take?: string) {
    const n = take ? Number(take) : 5;
    return this.articles.listMostReadPublished(Number.isFinite(n) ? n : 5);
  }

  @Get('category/:slug')
  byCategory(
    @Param('slug') slug: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const t = take ? Number(take) : 12;
    const s = skip ? Number(skip) : 0;
    return this.articles.listByCategory(
      slug,
      Number.isFinite(t) ? t : 12,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.articles.getPublishedBySlug(slug);
  }
}
