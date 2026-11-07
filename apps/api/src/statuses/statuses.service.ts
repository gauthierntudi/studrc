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
  CreateStatusSlideDto,
  PresignStatusVideoDto,
  STATUS_MAX_SLIDES,
  STATUS_VIDEO_MAX_BYTES,
  UpdateStatusDto,
  UpdateStatusSlideDto,
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

const SLIDE_ORDER: Prisma.StatusSlideOrderByWithRelationInput[] = [
  { position: 'asc' },
  { createdAt: 'asc' },
];

const ADMIN_SLIDE_SELECT = {
  id: true,
  statusId: true,
  position: true,
  mediaType: true,
  mediaKey: true,
  posterKey: true,
  imageFit: true,
  caption: true,
  articleId: true,
  durationSec: true,
  article: {
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      coverKey: true,
    },
  },
} satisfies Prisma.StatusSlideSelect;

const ADMIN_STATUS_SELECT = {
  id: true,
  title: true,
  sortOrder: true,
  isPublished: true,
  publishedAt: true,
  expiresAt: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  slides: { orderBy: SLIDE_ORDER, select: ADMIN_SLIDE_SELECT },
} satisfies Prisma.StatusSelect;

const PUBLIC_STATUS_SELECT = {
  id: true,
  title: true,
  publishedAt: true,
  expiresAt: true,
  slides: {
    orderBy: SLIDE_ORDER,
    select: {
      id: true,
      mediaType: true,
      mediaKey: true,
      posterKey: true,
      imageFit: true,
      caption: true,
      durationSec: true,
      article: {
        select: { ...PUBLIC_CARD_SELECT, isPublished: true },
      },
    },
  },
} satisfies Prisma.StatusSelect;

type AdminStatusRow = Prisma.StatusGetPayload<{
  select: typeof ADMIN_STATUS_SELECT;
}>;
type AdminSlideRow = Prisma.StatusSlideGetPayload<{
  select: typeof ADMIN_SLIDE_SELECT;
}>;

export type StatusState = 'draft' | 'active' | 'expired';

const NO_CONTENT_MESSAGE =
  'Ajoutez au moins une diapo avec un média, un texte ou un article lié avant de publier';

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
        const slides = row.slides
          .map((slide) => {
            const article =
              slide.article && slide.article.isPublished
                ? this.articles.toPublicCard(slide.article)
                : null;
            const mediaUrl = this.resolveMediaUrl(slide.mediaKey);
            const caption = slide.caption?.trim() || null;
            if (!mediaUrl && !article && !caption) return null;
            return {
              id: slide.id,
              mediaType: mediaUrl ? slide.mediaType : null,
              mediaUrl,
              posterUrl: this.resolveMediaUrl(slide.posterKey),
              imageFit: slide.imageFit,
              caption,
              durationSec: slide.durationSec,
              article,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        const first = slides[0];
        if (!first) return null;
        return {
          // Compatibilité : les anciennes versions de l’app lisent la 1re diapo à plat
          ...first,
          id: row.id,
          title: row.title?.trim() || null,
          publishedAt: (row.publishedAt ?? now).toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          slides,
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

  /** Crée un statut (bulle) en brouillon : les diapos s’ajoutent ensuite. */
  async create(dto: CreateStatusDto, actorId: string) {
    if (dto.isPublished) throw new BadRequestException(NO_CONTENT_MESSAGE);
    const now = new Date();
    const ttl = dto.ttlHours ?? DEFAULT_TTL_HOURS;

    const created = await this.prisma.status.create({
      data: {
        title: dto.title ?? null,
        isPublished: false,
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
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateStatusDto, actorId: string) {
    const existing = await this.findAdmin(id);
    const data: Prisma.StatusUpdateInput = {};
    const now = new Date();

    if (dto.title !== undefined) data.title = dto.title ?? null;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.ttlHours !== undefined) {
      data.expiresAt = new Date(now.getTime() + dto.ttlHours * HOUR_MS);
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
    if (willBePublished && !existing.slides.some((s) => this.hasContent(s))) {
      throw new BadRequestException(NO_CONTENT_MESSAGE);
    }

    const updated = await this.prisma.status.update({
      where: { id },
      data,
      select: ADMIN_STATUS_SELECT,
    });

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
    const existing = await this.findAdmin(id);
    await this.prisma.status.delete({ where: { id } });

    void this.deleteKeys(existing.slides.flatMap((s) => this.slideKeys(s)));
    const r2 = createR2ClientFromEnv();
    if (r2) {
      // Anciens médias rangés par statut (avant les diapos)
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

  /**
   * Regroupe `id` dans `targetId` : ses diapos passent à la suite de celles
   * de la cible, puis le statut source (vidé) est supprimé.
   */
  async merge(id: string, targetId: string, actorId: string) {
    if (id === targetId) {
      throw new BadRequestException('Choisissez un autre statut');
    }
    const [source, target] = await Promise.all([
      this.findAdmin(id),
      this.findAdmin(targetId),
    ]);
    if (source.slides.length + target.slides.length > STATUS_MAX_SLIDES) {
      throw new BadRequestException(
        `Un statut contient au maximum ${STATUS_MAX_SLIDES} diapos`,
      );
    }
    const start = target.slides.length;
    await this.prisma.$transaction([
      ...source.slides.map((slide, i) =>
        this.prisma.statusSlide.update({
          where: { id: slide.id },
          data: { statusId: targetId, position: start + i },
        }),
      ),
      ...target.slides.map((slide, i) =>
        this.prisma.statusSlide.update({
          where: { id: slide.id },
          data: { position: i },
        }),
      ),
      // Les vues restent comptées sur la bulle conservée
      this.prisma.status.update({
        where: { id: targetId },
        data: { viewCount: { increment: source.viewCount } },
      }),
      this.prisma.status.delete({ where: { id } }),
    ]);

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'status_merged',
      entity: 'status',
      entityId: targetId,
      meta: { from: id, slides: source.slides.length },
    });

    return this.getById(targetId);
  }

  // ---------------------------------------------------------------- diapos

  async createSlide(
    statusId: string,
    dto: CreateStatusSlideDto,
    actorId: string,
  ) {
    const status = await this.findAdmin(statusId);
    if (status.slides.length >= STATUS_MAX_SLIDES) {
      throw new BadRequestException(
        `Un statut contient au maximum ${STATUS_MAX_SLIDES} diapos`,
      );
    }
    const articleId = await this.resolveArticleId(dto.articleId);
    const last = status.slides[status.slides.length - 1];
    const slide = await this.prisma.statusSlide.create({
      data: {
        statusId,
        position: last ? last.position + 1 : 0,
        caption: this.normalizeCaption(dto.caption),
        articleId,
        durationSec: dto.durationSec ?? 6,
        ...(dto.imageFit ? { imageFit: dto.imageFit } : {}),
      },
      select: ADMIN_SLIDE_SELECT,
    });
    this.logSlide(actorId, statusId, 'status_slide_created', slide.id);
    return this.toAdminSlide(slide);
  }

  async updateSlide(
    slideId: string,
    dto: UpdateStatusSlideDto,
    actorId: string,
  ) {
    const existing = await this.findSlide(slideId);
    const data: Prisma.StatusSlideUpdateInput = {};

    if (dto.caption !== undefined) {
      data.caption = this.normalizeCaption(dto.caption);
    }
    if (dto.articleId !== undefined) {
      const articleId = await this.resolveArticleId(dto.articleId);
      data.article = articleId
        ? { connect: { id: articleId } }
        : { disconnect: true };
    }
    if (dto.durationSec !== undefined) data.durationSec = dto.durationSec;
    if (dto.imageFit !== undefined) data.imageFit = dto.imageFit;
    const oldKeys: string[] = [];
    if (dto.clearMedia) {
      oldKeys.push(...this.slideKeys(existing));
      data.mediaKey = null;
      data.mediaType = null;
      data.posterKey = null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const status = await this.findAdmin(existing.statusId);
    if (status.isPublished) {
      const next = {
        mediaKey: dto.clearMedia ? null : existing.mediaKey,
        caption:
          dto.caption !== undefined
            ? this.normalizeCaption(dto.caption)
            : existing.caption,
        articleId:
          dto.articleId !== undefined
            ? dto.articleId?.trim() || null
            : existing.articleId,
      };
      const others = status.slides.filter((s) => s.id !== slideId);
      if (!this.hasContent(next) && !others.some((s) => this.hasContent(s))) {
        throw new BadRequestException(NO_CONTENT_MESSAGE);
      }
    }

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data,
      select: ADMIN_SLIDE_SELECT,
    });
    if (oldKeys.length) void this.deleteKeys(oldKeys);
    this.logSlide(actorId, existing.statusId, 'status_slide_updated', slideId);
    return this.toAdminSlide(updated);
  }

  async removeSlide(slideId: string, actorId: string) {
    const existing = await this.findSlide(slideId);
    const status = await this.findAdmin(existing.statusId);
    if (
      status.isPublished &&
      !status.slides.some((s) => s.id !== slideId && this.hasContent(s))
    ) {
      throw new BadRequestException(
        'Un statut publié doit garder au moins une diapo : masquez-le ou supprimez le statut',
      );
    }
    await this.prisma.statusSlide.delete({ where: { id: slideId } });
    void this.deleteKeys(this.slideKeys(existing));
    this.logSlide(actorId, existing.statusId, 'status_slide_deleted', slideId);
    return { ok: true as const };
  }

  /** Réordonne les diapos d’un statut (liste complète des ids, dans l’ordre). */
  async reorderSlides(statusId: string, ids: string[], actorId: string) {
    const status = await this.findAdmin(statusId);
    const current = new Set(status.slides.map((s) => s.id));
    if (
      ids.length !== current.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !current.has(id))
    ) {
      throw new BadRequestException('Liste des diapos invalide');
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.statusSlide.update({ where: { id }, data: { position } }),
      ),
    );
    this.logSlide(actorId, statusId, 'status_slides_reordered');
    return this.getById(statusId);
  }

  async uploadImage(slideId: string, file: UploadFile, actorId: string) {
    const existing = await this.findSlide(slideId);
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(slideId, 'image', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: {
        mediaType: StatusMediaType.IMAGE,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_SLIDE_SELECT,
    });

    void this.deleteKeys(this.slideKeys(existing));
    this.logMedia(actorId, existing.statusId, key, file.size);
    return this.toAdminSlide(updated);
  }

  async uploadPoster(slideId: string, file: UploadFile, actorId: string) {
    const existing = await this.findSlide(slideId);
    if (existing.mediaType !== StatusMediaType.VIDEO) {
      throw new BadRequestException('La miniature est réservée aux vidéos');
    }
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(slideId, 'poster', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: { posterKey: key },
      select: ADMIN_SLIDE_SELECT,
    });
    if (existing.posterKey) void this.deleteKeys([existing.posterKey]);
    this.logMedia(actorId, existing.statusId, key, file.size);
    return this.toAdminSlide(updated);
  }

  async presignVideo(slideId: string, dto: PresignStatusVideoDto) {
    await this.findSlide(slideId);
    if (dto.size > STATUS_VIDEO_MAX_BYTES) {
      throw new BadRequestException('La vidéo dépasse 100 Mo');
    }
    const r2 = this.requireR2();
    const ext = this.videoExt(dto.filename, dto.contentType);
    const expiresIn = 1800;
    const signed = presignR2PutObject(r2, {
      key: this.newKey(slideId, 'video', ext),
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
    slideId: string,
    dto: CompleteStatusVideoDto,
    actorId: string,
  ) {
    const existing = await this.findSlide(slideId);
    const key = dto.key.replace(/^\//, '');
    if (!key.startsWith(`${this.slidePrefix(slideId)}video_`)) {
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

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: {
        mediaType: StatusMediaType.VIDEO,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_SLIDE_SELECT,
    });

    void this.deleteKeys(this.slideKeys(existing).filter((k) => k !== key));
    this.logMedia(actorId, existing.statusId, key, head.contentLength ?? 0);
    return this.toAdminSlide(updated);
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

  private async findSlide(id: string) {
    const row = await this.prisma.statusSlide.findUnique({
      where: { id },
      select: ADMIN_SLIDE_SELECT,
    });
    if (!row) throw new NotFoundException('Diapo introuvable');
    return row;
  }

  private hasContent(row: {
    mediaKey: string | null;
    caption: string | null;
    articleId: string | null;
  }) {
    return !!row.mediaKey || !!row.caption?.trim() || !!row.articleId;
  }

  private slideKeys(slide: {
    mediaKey: string | null;
    posterKey: string | null;
  }) {
    return [slide.mediaKey, slide.posterKey].filter((k): k is string => !!k);
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

  /** Médias rangés par diapo : ils la suivent si elle change de statut. */
  private slidePrefix(slideId: string) {
    return `statuses/slides/${slideId}/`;
  }

  private newKey(slideId: string, kind: string, ext: string) {
    return `${this.slidePrefix(slideId)}${kind}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
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

  private logSlide(
    actorId: string,
    statusId: string,
    action: string,
    slideId?: string,
  ) {
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action,
      entity: 'status',
      entityId: statusId,
      meta: slideId ? { slideId } : undefined,
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

  private toAdminSlide(row: AdminSlideRow) {
    return {
      id: row.id,
      position: row.position,
      mediaType: row.mediaType,
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
    };
  }

  private toAdmin(row: AdminStatusRow) {
    return {
      id: row.id,
      title: row.title,
      state: this.stateOf(row),
      slides: row.slides.map((slide) => this.toAdminSlide(slide)),
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
