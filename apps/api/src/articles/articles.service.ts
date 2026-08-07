import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityActorType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../storage/r2';
import {
  ArticleBlockInputDto,
  CreateArticleDto,
  UpdateArticleDto,
} from './dto/admin-article.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const BLOCK_SELECT = {
  id: true,
  position: true,
  title: true,
  coverKey: true,
  coverCaption: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ArticleBlockSelect;

const MAGAZINE_SUMMARY_SELECT = {
  id: true,
  title: true,
  issueNumber: true,
  coverKey: true,
  publishedAt: true,
  isPublished: true,
  isActive: true,
  theme: true,
} satisfies Prisma.MagazineSelect;

const ARTICLE_SELECT = {
  id: true,
  legacyId: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  coverKey: true,
  coverCaption: true,
  category: true,
  viewCount: true,
  isPublished: true,
  isFeatured: true,
  authorId: true,
  magazineId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  magazine: {
    select: MAGAZINE_SUMMARY_SELECT,
  },
  blocks: {
    orderBy: { position: 'asc' as const },
    select: BLOCK_SELECT,
  },
  _count: {
    select: { comments: true },
  },
} satisfies Prisma.ArticleSelect;

const PUBLIC_CARD_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverKey: true,
  category: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  author: { select: { name: true } },
} satisfies Prisma.ArticleSelect;

@Injectable()
export class ArticlesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  async list(
    filters: {
      q?: string;
      published?: string;
      category?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const q = filters.q?.trim();
    const published = this.parseBool(filters.published);
    const category = filters.category?.trim() || undefined;
    const take = Math.min(Math.max(filters.take ?? 10, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const where: Prisma.ArticleWhereInput = {
      ...(published !== undefined ? { isPublished: published } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { excerpt: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { blocks: { some: { title: { contains: q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [items, total, summary] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        select: ARTICLE_SELECT,
      }),
      this.prisma.article.count({ where }),
      this.summaryCounts(),
    ]);

    return {
      items: items.map((a) => this.toAdmin(a)),
      total,
      take,
      skip,
      summary,
    };
  }

  async getById(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: ARTICLE_SELECT,
    });
    if (!article) {
      throw new NotFoundException('Actualité introuvable');
    }
    return this.toAdmin(article);
  }

  private static readonly CATEGORY_META: Record<
    string,
    { label: string; tone: string }
  > = {
    edito: { label: 'Édito', tone: 'dark' },
    'grandes-entrevues': { label: 'Grandes entrevues', tone: 'blue' },
    decryptages: { label: 'Décryptages', tone: 'teal' },
    zoom: { label: 'Zoom', tone: 'dark' },
    'entrevue-croisee': { label: 'Entrevue croisée', tone: 'gold' },
    'start-up': { label: 'Start-up', tone: 'teal' },
    inspirationnel: { label: 'Inspirationnel', tone: 'red' },
    'game-changers': { label: 'Game changers', tone: 'gold' },
    'vus-sur-le-net': { label: 'Vus sur le net', tone: 'orange' },
  };

  private readonly publicCardSelect = PUBLIC_CARD_SELECT;

  async getHomeFeed() {
    const published: Prisma.ArticleWhereInput = { isPublished: true };

    const [
      featured,
      recent,
      decryptages,
      startup,
      inspirationnel,
      zoom,
      gameChangers,
      plusVus,
      aNePasManquer,
    ] = await Promise.all([
      this.prisma.article.findMany({
        where: { ...published, isFeatured: true },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 3,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where: published,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 16,
        select: this.publicCardSelect,
      }),
      this.byCategory('decryptages', 4),
      this.byCategory('start-up', 5),
      this.byCategory('inspirationnel', 4),
      this.byCategory('zoom', 5),
      this.byCategory('game-changers', 4),
      this.prisma.article.findMany({
        where: published,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where: {
          ...published,
          OR: [
            { category: 'edito' },
            { category: 'grandes-entrevues' },
            { category: 'vus-sur-le-net' },
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: this.publicCardSelect,
      }),
    ]);

    const featuredIds = new Set(featured.map((a) => a.id));
    const topGrid = recent
      .filter((a) => !featuredIds.has(a.id))
      .slice(0, 4);
    const filInfo = recent.slice(0, 5);

    return {
      featured: featured.map((a) => this.toPublicCard(a)),
      topGrid: topGrid.map((a) => this.toPublicCard(a)),
      decryptages: decryptages.map((a) => this.toPublicCard(a)),
      filInfo: filInfo.map((a) => this.toPublicCard(a)),
      startup: startup.map((a) => this.toPublicCard(a)),
      inspirationnel: inspirationnel.map((a) => this.toPublicCard(a)),
      zoom: zoom.map((a) => this.toPublicCard(a)),
      gameChangers: gameChangers.map((a) => this.toPublicCard(a)),
      plusVus: plusVus.map((a) => this.toPublicCard(a)),
      aNePasManquer: aNePasManquer.map((a) => this.toPublicCard(a)),
    };
  }

  /** Derniers articles publiés (footer, widgets). */
  async listRecentPublished(take = 3) {
    const limit = Math.min(Math.max(take, 1), 12);
    const items = await this.prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: this.publicCardSelect,
    });
    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  /** Suggestions aléatoires (header search au focus). */
  async listRandomPublished(take = 10) {
    const limit = Math.min(Math.max(take, 1), 10);
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM articles
      WHERE "isPublished" = true
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    if (rows.length === 0) {
      return { items: [] };
    }

    const ids = rows.map((r) => r.id);
    const found = await this.prisma.article.findMany({
      where: { id: { in: ids }, isPublished: true },
      select: this.publicCardSelect,
    });
    const byId = new Map(found.map((a) => [a.id, a]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => Boolean(a))
      .map((a) => this.toPublicCard(a));

    return { items };
  }

  /** Recherche publique — header live (take≤10) ou page résultats (paginée). */
  async searchPublished(
    rawQ: string,
    take = 10,
    rawCategory?: string,
    skip = 0,
  ) {
    const q = rawQ.trim();
    const limit = Math.min(Math.max(take, 1), 24);
    const offset = Math.max(skip, 0);
    if (q.length < 2) {
      return {
        items: [],
        total: 0,
        q,
        category: null as string | null,
        take: limit,
        skip: offset,
      };
    }

    const category = rawCategory
      ? this.resolveCategorySlug(rawCategory)
      : null;

    const where: Prisma.ArticleWhereInput = {
      isPublished: true,
      ...(category ? { category } : {}),
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        ...(category
          ? []
          : [{ category: { contains: q, mode: 'insensitive' as const } }]),
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: this.publicCardSelect,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      items: items.map((a) => this.toPublicCard(a)),
      total,
      q,
      category,
      take: limit,
      skip: offset,
    };
  }

  /** Classement global des plus lus (sidebar recherche, widgets). */
  async listMostReadPublished(take = 5) {
    const limit = Math.min(Math.max(take, 1), 10);
    const items = await this.prisma.article.findMany({
      where: { isPublished: true },
      orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      select: this.publicCardSelect,
    });
    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  /** Catalogue public d’une rubrique (paginé). */
  async listByCategory(rawSlug: string, take = 12, skip = 0) {
    const slug = this.resolveCategorySlug(rawSlug);
    if (!slug) {
      throw new NotFoundException('Rubrique introuvable');
    }
    const meta = ArticlesService.CATEGORY_META[slug]!;
    const limit = Math.min(Math.max(take, 1), 48);
    const offset = Math.max(skip, 0);
    const where = { isPublished: true, category: slug } as const;

    const [total, items, mostRead] = await this.prisma.$transaction([
      this.prisma.article.count({ where }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: this.publicCardSelect,
      }),
      this.prisma.article.findMany({
        where,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
        select: this.publicCardSelect,
      }),
    ]);

    return {
      category: slug,
      label: meta.label,
      tone: meta.tone,
      items: items.map((a) => this.toPublicCard(a)),
      mostRead: mostRead.map((a) => this.toPublicCard(a)),
      total,
      take: limit,
      skip: offset,
    };
  }

  private resolveCategorySlug(raw: string): string | null {
    const key = raw.trim().toLowerCase();
    if (!key) return null;
    const aliases: Record<string, string> = {
      decryptage: 'decryptages',
      decryptages: 'decryptages',
      'grandes-entrevues': 'grandes-entrevues',
      'grande-entrevue': 'grandes-entrevues',
      'start-ups': 'start-up',
      startup: 'start-up',
      'game-changer': 'game-changers',
    };
    const resolved = aliases[key] ?? key;
    return ArticlesService.CATEGORY_META[resolved] ? resolved : null;
  }

  /** Autres articles (même rubrique en priorité), hors article courant. */
  async listRelatedPublished(slug: string, take = 6) {
    const limit = Math.min(Math.max(take, 1), 12);
    const current = await this.prisma.article.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, category: true },
    });
    if (!current) {
      return { items: [] };
    }

    const orderBy = [
      { publishedAt: 'desc' as const },
      { createdAt: 'desc' as const },
    ];

    let items = current.category
      ? await this.prisma.article.findMany({
          where: {
            isPublished: true,
            category: current.category,
            id: { not: current.id },
          },
          orderBy,
          take: limit,
          select: this.publicCardSelect,
        })
      : [];

    if (items.length < limit) {
      const fill = await this.prisma.article.findMany({
        where: {
          isPublished: true,
          id: { notIn: [current.id, ...items.map((a) => a.id)] },
        },
        orderBy,
        take: limit - items.length,
        select: this.publicCardSelect,
      });
      items = [...items, ...fill];
    }

    return {
      items: items.map((a) => this.toPublicCard(a)),
    };
  }

  async getPublishedBySlug(slug: string) {
    const article = await this.prisma.article.findFirst({
      where: { slug, isPublished: true },
      select: ARTICLE_SELECT,
    });
    if (!article) {
      throw new NotFoundException('Article introuvable');
    }
    // Incrémente les vues sans bloquer la réponse
    void this.prisma.article
      .update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);
    return this.toAdmin(article, { publicMagazineOnly: true });
  }

  private byCategory(category: string, take: number) {
    return this.prisma.article.findMany({
      where: { isPublished: true, category },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      select: this.publicCardSelect,
    });
  }

  private toPublicCard(
    article: Prisma.ArticleGetPayload<{ select: typeof PUBLIC_CARD_SELECT }>,
  ) {
    const key = article.category?.trim() || '';
    const meta =
      ArticlesService.CATEGORY_META[key] ??
      ({
        label: key || 'Actualité',
        tone: 'teal',
      } as const);
    const when = article.publishedAt ?? article.createdAt;

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      coverUrl: this.resolveMediaUrl(article.coverKey),
      category: article.category,
      categoryLabel: meta.label,
      categoryTone: meta.tone,
      authorName: article.author?.name?.trim() || 'Opt1mum',
      publishedAt: article.publishedAt?.toISOString() ?? null,
      dateLabel: new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(when),
      viewCount: article.viewCount,
    };
  }

  async create(dto: CreateArticleDto, actorId: string) {
    const title = dto.title.trim();
    const slug = await this.ensureUniqueSlug(
      dto.slug?.trim() || this.slugify(title),
    );
    const isPublished = Boolean(dto.isPublished);
    const isFeatured = Boolean(dto.isFeatured);
    const blocks = this.normalizeBlocks(dto.blocks);
    const content =
      dto.content?.trim() ||
      this.mirrorContentFromBlocks(blocks) ||
      '';

    const magazineId = await this.resolveMagazineId(dto.magazineId);

    const created = await this.prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          title,
          slug,
          content,
          excerpt: dto.excerpt.trim(),
          category: dto.category?.trim() || null,
          coverCaption: dto.coverCaption?.trim() || null,
          isPublished,
          isFeatured,
          publishedAt: isPublished ? new Date() : null,
          authorId: actorId,
          ...(magazineId ? { magazineId } : {}),
        },
        select: { id: true },
      });

      if (blocks.length > 0) {
        await tx.articleBlock.createMany({
          data: blocks.map((b, i) => ({
            articleId: article.id,
            position: i,
            title: b.title,
            coverCaption: b.coverCaption,
            content: b.content,
          })),
        });
      }

      return tx.article.findUniqueOrThrow({
        where: { id: article.id },
        select: ARTICLE_SELECT,
      });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_created',
      entity: 'article',
      entityId: created.id,
      meta: {
        title: created.title,
        slug: created.slug,
        isPublished: created.isPublished,
        blocks: created.blocks.length,
      },
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateArticleDto, actorId: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        isPublished: true,
        publishedAt: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Actualité introuvable');
    }

    const data: Prisma.ArticleUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.excerpt !== undefined) {
      data.excerpt = dto.excerpt?.trim() || null;
    }
    if (dto.category !== undefined) {
      data.category = dto.category?.trim() || null;
    }
    if (dto.coverCaption !== undefined) {
      data.coverCaption = dto.coverCaption?.trim() || null;
    }
    if (dto.content !== undefined && dto.blocks === undefined) {
      data.content = dto.content;
    }

    if (dto.slug !== undefined) {
      const nextSlug = await this.ensureUniqueSlug(
        dto.slug.trim() || this.slugify(dto.title?.trim() || existing.slug),
        id,
      );
      data.slug = nextSlug;
    }

    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    if (dto.isFeatured !== undefined) {
      data.isFeatured = dto.isFeatured;
    }

    if (dto.magazineId !== undefined) {
      const magazineId = await this.resolveMagazineId(dto.magazineId);
      data.magazine = magazineId
        ? { connect: { id: magazineId } }
        : { disconnect: true };
    }

    const syncBlocks = dto.blocks !== undefined;
    const blocks = syncBlocks ? this.normalizeBlocks(dto.blocks) : null;

    if (!syncBlocks && Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (syncBlocks && blocks) {
        data.content = this.mirrorContentFromBlocks(blocks);

        const keepIds = blocks
          .map((b) => b.id)
          .filter((blockId): blockId is string => Boolean(blockId));

        await tx.articleBlock.deleteMany({
          where: {
            articleId: id,
            ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
          },
        });

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]!;
          if (b.id) {
            const owned = await tx.articleBlock.findFirst({
              where: { id: b.id, articleId: id },
              select: { id: true },
            });
            if (!owned) {
              throw new BadRequestException(`Bloc introuvable: ${b.id}`);
            }
            await tx.articleBlock.update({
              where: { id: b.id },
              data: {
                position: i,
                title: b.title,
                coverCaption: b.coverCaption,
                content: b.content,
              },
            });
          } else {
            await tx.articleBlock.create({
              data: {
                articleId: id,
                position: i,
                title: b.title,
                coverCaption: b.coverCaption,
                content: b.content,
              },
            });
          }
        }
      }

      if (Object.keys(data).length > 0) {
        await tx.article.update({ where: { id }, data });
      }

      return tx.article.findUniqueOrThrow({
        where: { id },
        select: ARTICLE_SELECT,
      });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_updated',
      entity: 'article',
      entityId: updated.id,
      meta: {
        title: updated.title,
        slug: updated.slug,
        isPublished: updated.isPublished,
        blocks: updated.blocks.length,
      },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        coverKey: true,
        blocks: { select: { coverKey: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('Actualité introuvable');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({ where: { articleId: id } });
      await tx.article.delete({ where: { id } });
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_deleted',
      entity: 'article',
      entityId: id,
      meta: {
        title: existing.title,
        slug: existing.slug,
        hadCover: Boolean(existing.coverKey),
        blocks: existing.blocks.length,
      },
    });

    return { ok: true as const };
  }

  async uploadCover(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImageFile(file);

    const key = await this.putImage(`articles/${id}`, file);

    const updated = await this.prisma.article.update({
      where: { id },
      data: { coverKey: key },
      select: ARTICLE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_cover_uploaded',
      entity: 'article',
      entityId: id,
      meta: { coverKey: key, size: file.size },
    });

    return this.toAdmin(updated);
  }

  async uploadBlockCover(
    articleId: string,
    blockId: string,
    file: UploadFile,
    actorId: string,
  ) {
    const block = await this.prisma.articleBlock.findFirst({
      where: { id: blockId, articleId },
      select: { id: true },
    });
    if (!block) {
      throw new NotFoundException('Bloc introuvable');
    }

    this.assertImageFile(file);
    const key = await this.putImage(`articles/${articleId}/blocks`, file);

    await this.prisma.articleBlock.update({
      where: { id: blockId },
      data: { coverKey: key },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'article_block_cover_uploaded',
      entity: 'article',
      entityId: articleId,
      meta: { blockId, coverKey: key, size: file.size },
    });

    return this.getById(articleId);
  }

  private normalizeBlocks(input?: ArticleBlockInputDto[]) {
    if (!input?.length)
      return [] as Array<{
        id?: string;
        title: string | null;
        coverCaption: string | null;
        content: string;
      }>;

    return input.map((b) => ({
      id: b.id?.trim() || undefined,
      title: b.title?.trim() || null,
      coverCaption: b.coverCaption?.trim() || null,
      content: (b.content ?? '').trim(),
    }));
  }

  private mirrorContentFromBlocks(
    blocks: Array<{ title: string | null; content: string }>,
  ): string {
    if (!blocks.length) return '';
    return blocks
      .map((b) => {
        const heading = b.title
          ? `<h2>${escapeHtml(b.title)}</h2>`
          : '';
        return `${heading}${b.content}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }

  private async summaryCounts() {
    const [total, published, drafts, featured] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { isPublished: true } }),
      this.prisma.article.count({ where: { isPublished: false } }),
      this.prisma.article.count({ where: { isFeatured: true } }),
    ]);
    return { total, published, drafts, featured };
  }

  private async ensureUniqueSlug(base: string, excludeId?: string) {
    let slug = this.slugify(base);
    if (!slug) slug = `article-${Date.now()}`;

    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
      const found = await this.prisma.article.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!found || found.id === excludeId) return candidate;
    }
    throw new ConflictException('Impossible de générer un slug unique');
  }

  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

  private parseBool(value?: string): boolean | undefined {
    if (value == null || value === '') return undefined;
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
    return undefined;
  }

  private async assertExists(id: string) {
    const found = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Actualité introuvable');
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('La cover dépasse 5 Mo');
    }
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp';
    if (!ok) {
      throw new BadRequestException('Formats cover : JPG, PNG, WEBP');
    }
  }

  private safeExt(
    originalname: string,
    mimetype: string,
    allowed: string[],
  ): string {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!ext || !allowed.includes(ext)) {
      if (mimetype.includes('jpeg') || mimetype.includes('jpg')) ext = 'jpg';
      else if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
    }
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Extension de fichier non supportée');
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private async putImage(prefix: string, file: UploadFile) {
    const ext = this.safeExt(file.originalname, file.mimetype, [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);
    const key = `${prefix}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await this.uploadToR2(key, file, contentTypeForExt(ext));
    return key;
  }

  private async uploadToR2(
    key: string,
    file: UploadFile,
    contentType: string,
  ) {
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }
    await putR2Object(r2, {
      key,
      body: file.buffer,
      contentType,
    });
  }

  private async resolveMagazineId(
    raw: string | null | undefined,
  ): Promise<string | null> {
    if (raw === undefined) return null;
    if (raw === null || !raw.trim()) return null;
    const id = raw.trim();
    const mag = await this.prisma.magazine.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!mag) {
      throw new BadRequestException('Magazine introuvable');
    }
    return mag.id;
  }

  private toAdmin(
    article: Prisma.ArticleGetPayload<{ select: typeof ARTICLE_SELECT }>,
    opts?: { publicMagazineOnly?: boolean },
  ) {
    const {
      coverKey,
      coverCaption,
      _count,
      author,
      blocks,
      magazine,
      magazineId,
      ...rest
    } = article;
    const resolvedBlocks =
      blocks.length > 0
        ? blocks
        : article.content.trim()
          ? [
              {
                id: null as string | null,
                position: 0,
                title: null as string | null,
                coverKey: null as string | null,
                coverCaption: null as string | null,
                coverUrl: null as string | null,
                content: article.content,
                createdAt: article.createdAt.toISOString(),
                updatedAt: article.updatedAt.toISOString(),
              },
            ]
          : [];

    const magazineVisible =
      magazine &&
      (!opts?.publicMagazineOnly ||
        (magazine.isPublished && magazine.isActive));

    return {
      ...rest,
      magazineId: magazineVisible
        ? magazineId
        : opts?.publicMagazineOnly
          ? null
          : magazineId,
      coverKey,
      coverCaption,
      coverUrl: this.resolveMediaUrl(coverKey),
      magazine: magazineVisible
        ? {
            id: magazine.id,
            title: magazine.title,
            issueNumber: magazine.issueNumber,
            coverUrl: this.resolveMediaUrl(magazine.coverKey),
            publishedAt: magazine.publishedAt?.toISOString() ?? null,
            isPublished: magazine.isPublished,
            isActive: magazine.isActive,
            theme: this.parseMagazineTheme(magazine.theme),
          }
        : null,
      blocks:
        blocks.length > 0
          ? blocks.map((b) => ({
              id: b.id,
              position: b.position,
              title: b.title,
              coverKey: b.coverKey,
              coverCaption: b.coverCaption,
              coverUrl: this.resolveMediaUrl(b.coverKey),
              content: b.content,
              createdAt: b.createdAt.toISOString(),
              updatedAt: b.updatedAt.toISOString(),
            }))
          : resolvedBlocks,
      commentsCount: _count.comments,
      author: author
        ? { id: author.id, name: author.name, email: author.email }
        : null,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  private resolveMediaUrl(key: string | null): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (trimmed.includes('/')) {
      return r2 ? `${r2}/${trimmed.replace(/^\//, '')}` : null;
    }

    return `/legacy/articles/${encodeURIComponent(trimmed)}`;
  }

  private parseMagazineTheme(raw: Prisma.JsonValue | null): {
    bgColor: string;
    accentColor: string;
  } {
    const fallback = { bgColor: '#0d203d', accentColor: '#02d0d1' };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const obj = raw as Record<string, unknown>;
    const bg =
      typeof obj.bgColor === 'string'
        ? obj.bgColor
        : typeof obj.background === 'string'
          ? obj.background
          : fallback.bgColor;
    const accent =
      typeof obj.accentColor === 'string'
        ? obj.accentColor
        : typeof obj.themeColor === 'string'
          ? obj.themeColor
          : typeof obj.accent === 'string'
            ? obj.accent
            : fallback.accentColor;
    return { bgColor: bg, accentColor: accent };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
