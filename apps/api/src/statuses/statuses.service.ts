import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityActorType, Prisma, StatusMediaType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import {
  ArticlesService,
  PUBLIC_CARD_SELECT,
} from '../articles/articles.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  deleteR2Keys,
  deleteR2Prefix,
  headR2Object,
  presignR2PutObject,
  putR2Object,
} from '../storage/r2';
import {
  CompleteStatusVideoDto,
  CreateStatusDto,
  PresignStatusVideoDto,
  STATUS_VIDEO_MAX_BYTES,
  UpdateStatusDto,
} from './dto/admin-status.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const HOUR_MS = 3_600_000;
const DEFAULT_TTL_HOURS = 24;
const IMAGE_MAX_BYTES = 10_000_000;

/** Ordre des bulles : position choisie, puis les plus récents d’abord */
const STATUS_DISPLAY_ORDER: Prisma.StatusOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

const ADMIN_STATUS_SELECT = {
  id: true,
  mediaType: true,
  mediaKey: true,
  posterKey: true,
  imageFit: true,
  caption: true,
  articleId: true,
  durationSec: true,
  sortOrder: true,
  isPublished: true,
  publishedAt: true,
  expiresAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  article: {
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      coverKey: true,
    },
  },
} satisfies Prisma.StatusSelect;

const PUBLIC_STATUS_SELECT = {
  id: true,
  mediaType: true,
  mediaKey: true,
  posterKey: true,
  imageFit: true,
  caption: true,
  durationSec: true,
  publishedAt: true,
  expiresAt: true,
  article: {
    select: { ...PUBLIC_CARD_SELECT, isPublished: true },
  },
} satisfies Prisma.StatusSelect;

type AdminStatusRow = Prisma.StatusGetPayload<{
  select: typeof ADMIN_STATUS_SELECT;
}>;

export type StatusState = 'draft' | 'active' | 'expired';

@Injectable()
export class StatusesService {
  private readonly logger = new Logger(StatusesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly articles: ArticlesService,
  ) {}

  // ---------------------------------------------------------------- public

  async listPublic() {
    const now = new Date();
    const rows = await this.prisma.status.findMany({
      where: {
        isPublished: true,
        publishedAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: STATUS_DISPLAY_ORDER,
      take: 50,
      select: PUBLIC_STATUS_SELECT,
    });

    const items = rows
      .map((row) => {
        const article =
          row.article && row.article.isPublished
            ? this.articles.toPublicCard(row.article)
            : null;
        const mediaUrl = this.resolveMediaUrl(row.mediaKey);
        const caption = row.caption?.trim() || null;
        if (!mediaUrl && !article && !caption) return null;
        return {
          id: row.id,
          mediaType: mediaUrl ? row.mediaType : null,
          mediaUrl,
          posterUrl: this.resolveMediaUrl(row.posterKey),
          imageFit: row.imageFit,
          caption,
          durationSec: row.durationSec,
          publishedAt: (row.publishedAt ?? now).toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          article,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { items };
  }

  async registerView(id: string) {
    await this.prisma.status.updateMany({
      where: { id, isPublished: true },
      data: { viewCount: { increment: 1 } },
    });
    return { ok: true as const };
  }

  // ----------------------------------------------------------------- admin

  async list(filters: { state?: string; take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(filters.take ?? 50, 1), 200);
    const skip = Math.max(filters.skip ?? 0, 0);
    const now = new Date();

    let where: Prisma.StatusWhereInput = {};
    if (filters.state === 'draft') where = { isPublished: false };
    else if (filters.state === 'active')
      where = { isPublished: true, expiresAt: { gt: now } };
    else if (filters.state === 'expired')
      where = { isPublished: true, expiresAt: { lte: now } };

    const [items, total] = await Promise.all([
      this.prisma.status.findMany({
        where,
        // « En ligne » : même ordre que l’app ; sinon les plus récents
        orderBy:
          filters.state === 'active'
            ? STATUS_DISPLAY_ORDER
            : { createdAt: 'desc' },
        take,
        skip,
        select: ADMIN_STATUS_SELECT,
      }),
      this.prisma.status.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
    };
  }

  /**
   * Échange un statut en ligne avec son voisin, puis renumérote toute la
   * rangée (1…n) pour garder un ordre stable. Les nouveaux statuts (0)
   * arrivent en tête.
   */
  async move(id: string, direction: 'up' | 'down', actorId: string) {
    const now = new Date();
    const active = await this.prisma.status.findMany({
      where: { isPublished: true, expiresAt: { gt: now } },
      orderBy: STATUS_DISPLAY_ORDER,
      select: { id: true },
    });
    const index = active.findIndex((row) => row.id === id);
    if (index < 0) {
      throw new BadRequestException(
        'Seuls les statuts en ligne peuvent être réordonnés',
      );
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < active.length) {
      const ids = active.map((row) => row.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await this.prisma.$transaction(
        ids.map((rowId, i) =>
          this.prisma.status.update({
            where: { id: rowId },
            data: { sortOrder: i + 1 },
          }),
        ),
      );
      void this.activity.log({
        actorType: ActivityActorType.ADMIN,
        adminId: actorId,
        action: 'status_reordered',
        entity: 'status',
        entityId: id,
        meta: { direction, position: target + 1 },
      });
    }
    return { ok: true };
  }

  async getById(id: string) {
    return this.toAdmin(await this.findAdmin(id));
  }

  async create(dto: CreateStatusDto, actorId: string) {
    const articleId = await this.resolveArticleId(dto.articleId);
    const caption = this.normalizeCaption(dto.caption);
    const now = new Date();
    const ttl = dto.ttlHours ?? DEFAULT_TTL_HOURS;
    const publish = dto.isPublished === true;

    if (publish && !articleId && !caption) {
      throw new BadRequestException(
        'Ajoutez un média, un texte ou un article lié avant de publier',
      );
    }

    const created = await this.prisma.status.create({
      data: {
        caption,
        articleId,
        durationSec: dto.durationSec ?? 6,
        ...(dto.imageFit ? { imageFit: dto.imageFit } : {}),
        isPublished: publish,
        publishedAt: publish ? now : null,
        expiresAt: new Date(now.getTime() + ttl * HOUR_MS),
        authorId: actorId,
      },
      select: ADMIN_STATUS_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'status_created',
      entity: 'status',
      entityId: created.id,
      meta: { articleId, published: publish },
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateStatusDto, actorId: string) {
    const existing = await this.findAdmin(id);
    const data: Prisma.StatusUpdateInput = {};
    const now = new Date();

    let nextCaption = existing.caption;
    let nextArticleId = existing.articleId;
    if (dto.caption !== undefined) {
      nextCaption = this.normalizeCaption(dto.caption);
      data.caption = nextCaption;
    }
    if (dto.articleId !== undefined) {
      nextArticleId = await this.resolveArticleId(dto.articleId);
      data.article = nextArticleId
        ? { connect: { id: nextArticleId } }
        : { disconnect: true };
    }
    if (dto.durationSec !== undefined) data.durationSec = dto.durationSec;
    if (dto.imageFit !== undefined) data.imageFit = dto.imageFit;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.ttlHours !== undefined) {
      data.expiresAt = new Date(now.getTime() + dto.ttlHours * HOUR_MS);
    }

    const oldMediaKeys: string[] = [];
    if (dto.clearMedia) {
      if (existing.mediaKey) oldMediaKeys.push(existing.mediaKey);
      if (existing.posterKey) oldMediaKeys.push(existing.posterKey);
      data.mediaKey = null;
      data.mediaType = null;
      data.posterKey = null;
    }

    let publishedNow = false;
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.isPublished) {
        publishedNow = true;
        data.publishedAt = now;
        // La durée de vie démarre à la publication (pas à la création du brouillon)
        if (dto.ttlHours === undefined && dto.expiresAt === undefined) {
          const ttlMs =
            existing.expiresAt.getTime() - existing.createdAt.getTime();
          data.expiresAt = new Date(now.getTime() + Math.max(ttlMs, HOUR_MS));
        }
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const willBePublished = dto.isPublished ?? existing.isPublished;
    const nextContent = {
      mediaKey: dto.clearMedia ? null : existing.mediaKey,
      caption: nextCaption,
      articleId: nextArticleId,
    };
    if (willBePublished && !this.hasContent(nextContent)) {
      throw new BadRequestException(
        'Ajoutez un média, un texte ou un article lié avant de publier',
      );
    }

    const updated = await this.prisma.status.update({
      where: { id },
      data,
      select: ADMIN_STATUS_SELECT,
    });

    if (oldMediaKeys.length) void this.deleteKeys(oldMediaKeys);

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: publishedNow ? 'status_published' : 'status_updated',
      entity: 'status',
      entityId: id,
      meta: { fields: Object.keys(dto) },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    await this.findAdmin(id);
    await this.prisma.status.delete({ where: { id } });

    const r2 = createR2ClientFromEnv();
    if (r2) {
      void deleteR2Prefix(r2, `statuses/${id}/`).catch((err) =>
        this.logger.warn(`R2 cleanup statut ${id}: ${String(err)}`),
      );
    }

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'status_deleted',
      entity: 'status',
      entityId: id,
    });

    return { ok: true as const };
  }

  async uploadImage(id: string, file: UploadFile, actorId: string) {
    const existing = await this.findAdmin(id);
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(id, 'image', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.status.update({
      where: { id },
      data: {
        mediaType: StatusMediaType.IMAGE,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_STATUS_SELECT,
    });

    void this.deleteKeys(
      [existing.mediaKey, existing.posterKey].filter((k): k is string => !!k),
    );
    this.logMedia(actorId, id, key, file.size);
    return this.toAdmin(updated);
  }

  async uploadPoster(id: string, file: UploadFile, actorId: string) {
    const existing = await this.findAdmin(id);
    if (existing.mediaType !== StatusMediaType.VIDEO) {
      throw new BadRequestException('La miniature est réservée aux vidéos');
    }
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(id, 'poster', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.status.update({
      where: { id },
      data: { posterKey: key },
      select: ADMIN_STATUS_SELECT,
    });
    if (existing.posterKey) void this.deleteKeys([existing.posterKey]);
    this.logMedia(actorId, id, key, file.size);
    return this.toAdmin(updated);
  }

  async presignVideo(id: string, dto: PresignStatusVideoDto) {
    await this.findAdmin(id);
    if (dto.size > STATUS_VIDEO_MAX_BYTES) {
      throw new BadRequestException('La vidéo dépasse 100 Mo');
    }
    const r2 = this.requireR2();
    const ext = this.videoExt(dto.filename, dto.contentType);
    const expiresIn = 1800;
    const signed = presignR2PutObject(r2, {
      key: this.newKey(id, 'video', ext),
      contentType: contentTypeForExt(ext),
      expiresInSeconds: expiresIn,
    });
    return {
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers,
      expiresIn,
      maxSize: STATUS_VIDEO_MAX_BYTES,
    };
  }

  async completeVideo(
    id: string,
    dto: CompleteStatusVideoDto,
    actorId: string,
  ) {
    const existing = await this.findAdmin(id);
    const key = dto.key.replace(/^\//, '');
    if (!key.startsWith(`statuses/${id}/video_`)) {
      throw new BadRequestException('Clé vidéo invalide');
    }
    const r2 = this.requireR2();
    const head = await headR2Object(r2, key);
    if (!head) {
      throw new BadRequestException('Vidéo introuvable sur le stockage');
    }
    if ((head.contentLength ?? 0) > STATUS_VIDEO_MAX_BYTES) {
      void this.deleteKeys([key]);
      throw new BadRequestException('La vidéo dépasse 100 Mo');
    }

    const updated = await this.prisma.status.update({
      where: { id },
      data: {
        mediaType: StatusMediaType.VIDEO,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_STATUS_SELECT,
    });

    void this.deleteKeys(
      [existing.mediaKey, existing.posterKey].filter(
        (k): k is string => !!k && k !== key,
      ),
    );
    this.logMedia(actorId, id, key, head.contentLength ?? 0);
    return this.toAdmin(updated);
  }

  // --------------------------------------------------------------- helpers

  private async findAdmin(id: string) {
    const row = await this.prisma.status.findUnique({
      where: { id },
      select: ADMIN_STATUS_SELECT,
    });
    if (!row) throw new NotFoundException('Statut introuvable');
    return row;
  }

  private hasContent(row: {
    mediaKey: string | null;
    caption: string | null;
    articleId: string | null;
  }) {
    return !!row.mediaKey || !!row.caption?.trim() || !!row.articleId;
  }

  private stateOf(row: AdminStatusRow): StatusState {
    if (!row.isPublished) return 'draft';
    return row.expiresAt.getTime() > Date.now() ? 'active' : 'expired';
  }

  private async resolveArticleId(raw: string | null | undefined) {
    const id = raw?.trim();
    if (!id) return null;
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!article) throw new BadRequestException('Article introuvable');
    return article.id;
  }

  private normalizeCaption(raw: string | null | undefined) {
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  }

  private newKey(id: string, kind: string, ext: string) {
    return `statuses/${id}/${kind}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  }

  private logMedia(actorId: string, id: string, key: string, size: number) {
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'status_media_uploaded',
      entity: 'status',
      entityId: id,
      meta: { key, size },
    });
  }

  private requireR2() {
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }
    return r2;
  }

  private async putToR2(key: string, file: UploadFile, contentType: string) {
    await putR2Object(this.requireR2(), {
      key,
      body: file.buffer,
      contentType,
    });
  }

  private async deleteKeys(keys: string[]) {
    const r2 = createR2ClientFromEnv();
    const own = keys.filter((k) => k.startsWith('statuses/'));
    if (!r2 || own.length === 0) return;
    try {
      await deleteR2Keys(r2, own);
    } catch (err) {
      this.logger.warn(`R2 delete statut: ${String(err)}`);
    }
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new BadRequestException("L'image dépasse 10 Mo");
    }
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
      file.mimetype,
    );
    if (!ok) {
      throw new BadRequestException('Formats image : JPG, PNG, WEBP');
    }
  }

  private imageExt(originalname: string, mimetype: string): string {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
      else ext = 'jpg';
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private videoExt(filename: string, contentType: string | undefined) {
    const name = filename.toLowerCase();
    const mime = (contentType ?? '').toLowerCase();
    if (name.endsWith('.mov') || mime.includes('quicktime')) return 'mov';
    if (
      name.endsWith('.mp4') ||
      name.endsWith('.m4v') ||
      mime.includes('mp4')
    ) {
      return 'mp4';
    }
    throw new BadRequestException('Formats vidéo : MP4 ou MOV (max 100 Mo)');
  }

  private toAdmin(row: AdminStatusRow) {
    return {
      id: row.id,
      state: this.stateOf(row),
      mediaType: row.mediaType,
      mediaKey: row.mediaKey,
      mediaUrl: this.resolveMediaUrl(row.mediaKey),
      posterUrl: this.resolveMediaUrl(row.posterKey),
      imageFit: row.imageFit,
      caption: row.caption,
      articleId: row.articleId,
      article: row.article
        ? {
            id: row.article.id,
            title: row.article.title,
            slug: row.article.slug,
            isPublished: row.article.isPublished,
            coverUrl: this.resolveMediaUrl(row.article.coverKey),
          }
        : null,
      durationSec: row.durationSec,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      viewCount: row.viewCount,
      author: row.author,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private resolveMediaUrl(key: string | null): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (!r2) return null;
    return `${r2}/${trimmed.replace(/^\//, '')}`;
  }
}
