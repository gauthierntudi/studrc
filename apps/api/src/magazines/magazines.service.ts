import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessType,
  ActivityActorType,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  headR2Object,
  putR2Object,
  presignR2PutObject,
} from '../storage/r2';
import {
  CompleteMagazinePdfDto,
  CreateMagazineDto,
  PresignMagazinePdfDto,
  UpdateMagazineDto,
} from './dto/admin-magazine.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};
const MAGAZINE_SELECT = {
  id: true,
  legacyId: true,
  title: true,
  description: true,
  issueNumber: true,
  accessType: true,
  priceCents: true,
  currency: true,
  theme: true,
  coverKey: true,
  pdfKey: true,
  previewKey: true,
  downloadKey: true,
  viewCount: true,
  isPublished: true,
  isActive: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MagazineSelect;

@Injectable()
export class MagazinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    filters: {
      q?: string;
      published?: string;
      active?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const q = filters.q?.trim();
    const published =
      filters.published === '1' || filters.published === 'true'
        ? true
        : filters.published === '0' || filters.published === 'false'
          ? false
          : undefined;
    const active =
      filters.active === '1' || filters.active === 'true'
        ? true
        : filters.active === '0' || filters.active === 'false'
          ? false
          : undefined;

    const take = Math.min(Math.max(filters.take ?? 10, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const where: Prisma.MagazineWhereInput = {
      ...(published !== undefined ? { isPublished: published } : {}),
      ...(active !== undefined ? { isActive: active } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { issueNumber: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.magazine.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        select: MAGAZINE_SELECT,
      }),
      this.prisma.magazine.count({ where }),
    ]);

    return {
      items: items.map((m) => this.toAdminMagazine(m)),
      total,
      take,
      skip,
    };
  }

  async getById(id: string) {
    const magazine = await this.prisma.magazine.findUnique({
      where: { id },
      select: MAGAZINE_SELECT,
    });
    if (!magazine) {
      throw new NotFoundException('Magazine introuvable');
    }
    return this.toAdminMagazine(magazine);
  }

  /** Dernier numéro publié — page abonnement / kiosque. */
  async getLatestPublished() {
    const magazine = await this.prisma.magazine.findFirst({
      where: { isPublished: true, isActive: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        issueNumber: true,
        coverKey: true,
        publishedAt: true,
        theme: true,
      },
    });
    if (!magazine) return null;
    return {
      id: magazine.id,
      title: magazine.title,
      issueNumber: magazine.issueNumber,
      coverUrl: this.resolveCoverUrl(magazine.coverKey),
      publishedAt: magazine.publishedAt?.toISOString() ?? null,
      theme: this.parseTheme(magazine.theme),
    };
  }

  /** Catalogue public — carousel kiosque / vitrine (paginé). */
  async listPublished(take = 12, skip = 0) {
    const limit = Math.min(Math.max(take, 1), 48);
    const offset = Math.max(skip, 0);
    const where = { isPublished: true, isActive: true } as const;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.magazine.count({ where }),
      this.prisma.magazine.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          issueNumber: true,
          coverKey: true,
          publishedAt: true,
          priceCents: true,
          currency: true,
          accessType: true,
        },
      }),
    ]);

    return {
      items: items.map((m) => ({
        id: m.id,
        title: m.title,
        issueNumber: m.issueNumber,
        coverUrl: this.resolveCoverUrl(m.coverKey),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        priceCents: m.priceCents,
        currency: m.currency,
        accessType: m.accessType,
        dateLabel: this.formatDateLabel(m.publishedAt),
      })),
      total,
      take: limit,
      skip: offset,
    };
  }

  /** Fiche publique d’un numéro (kiosque). */
  async getPublishedById(id: string) {
    const magazine = await this.prisma.magazine.findFirst({
      where: { id, isPublished: true, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        issueNumber: true,
        coverKey: true,
        publishedAt: true,
        priceCents: true,
        currency: true,
        accessType: true,
        theme: true,
        highlights: true,
      },
    });
    if (!magazine) {
      throw new NotFoundException('Magazine introuvable');
    }

    const relatedArticles = await this.prisma.article.findMany({
      where: { magazineId: id, isPublished: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverKey: true,
        category: true,
        publishedAt: true,
      },
    });

    return {
      id: magazine.id,
      title: magazine.title,
      description: magazine.description,
      issueNumber: magazine.issueNumber,
      coverUrl: this.resolveCoverUrl(magazine.coverKey),
      publishedAt: magazine.publishedAt?.toISOString() ?? null,
      priceCents: magazine.priceCents,
      currency: magazine.currency,
      accessType: magazine.accessType,
      dateLabel: this.formatDateLabel(magazine.publishedAt),
      theme: this.parseTheme(magazine.theme),
      highlights: this.parseHighlights(magazine.highlights),
      relatedArticles: relatedArticles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        coverUrl: this.resolveArticleCoverUrl(a.coverKey),
        category: a.category,
        publishedAt: a.publishedAt?.toISOString() ?? null,
      })),
    };
  }

  private formatDateLabel(date: Date | null): string {
    if (!date) return '';
    const label = new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: 'numeric',
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  private parseTheme(raw: Prisma.JsonValue | null): {
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

  private parseHighlights(raw: Prisma.JsonValue | null): Array<{
    label: string;
    text: string;
  }> {
    if (!raw) return [];
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === 'object' &&
          raw !== null &&
          Array.isArray((raw as { items?: unknown }).items)
        ? ((raw as { items: unknown[] }).items)
        : [];

    return list
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const label =
          typeof row.label === 'string'
            ? row.label
            : typeof row.title === 'string'
              ? row.title
              : '';
        const text =
          typeof row.text === 'string'
            ? row.text
            : typeof row.description === 'string'
              ? row.description
              : '';
        if (!label && !text) return null;
        return { label: label || 'Rubrique', text };
      })
      .filter((x): x is { label: string; text: string } => Boolean(x));
  }

  /**
   * Session de lecture pour un abonné :
   * FREE, abonnement actif, ou achat unitaire SUCCESS.
   * Source unique : PDF Cloudflare R2 (`downloadKey`).
   */
  async getReaderSession(magazineId: string, subscriberId: string) {
    const magazine = await this.prisma.magazine.findUnique({
      where: { id: magazineId },
      select: {
        id: true,
        title: true,
        issueNumber: true,
        coverKey: true,
        downloadKey: true,
        accessType: true,
        isPublished: true,
        isActive: true,
        publishedAt: true,
      },
    });

    if (!magazine || !magazine.isPublished || !magazine.isActive) {
      throw new NotFoundException('Magazine introuvable');
    }

    const base = {
      id: magazine.id,
      title: magazine.title,
      issueNumber: magazine.issueNumber,
      coverUrl: this.resolveCoverUrl(magazine.coverKey),
      publishedAt: magazine.publishedAt?.toISOString() ?? null,
      accessType: magazine.accessType,
    };

    const access = await this.resolveSubscriberAccess(
      subscriberId,
      magazine.id,
      magazine.accessType,
    );

    const pdfUrl = this.resolveCoverUrl(magazine.downloadKey);

    if (!access.allowed) {
      return {
        ...base,
        canRead: false as const,
        preview: false as const,
        maxPages: null,
        code: access.code,
        message: access.message,
        accessVia: null,
        viewer: null,
        readerUrl: null,
        downloadUrl: pdfUrl,
      };
    }

    if (!pdfUrl) {
      return {
        ...base,
        canRead: false as const,
        preview: false as const,
        maxPages: null,
        code: 'NO_CONTENT',
        message: 'Aucun fichier PDF disponible pour ce numéro.',
        accessVia: null,
        viewer: null,
        readerUrl: null,
        downloadUrl: null,
      };
    }

    void this.prisma.magazine
      .update({
        where: { id: magazine.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);

    return {
      ...base,
      canRead: true as const,
      preview: false as const,
      maxPages: null,
      code: null,
      message: null,
      accessVia: access.via,
      viewer: 'pdf' as const,
      readerUrl: pdfUrl,
      downloadUrl: pdfUrl,
    };
  }

  /** Aperçu public des 15 premières pages — sans auth ni abonnement. */
  async getPreviewSession(magazineId: string) {
    const PREVIEW_PAGES = 15;
    const magazine = await this.prisma.magazine.findFirst({
      where: { id: magazineId, isPublished: true, isActive: true },
      select: {
        id: true,
        title: true,
        issueNumber: true,
        coverKey: true,
        downloadKey: true,
        accessType: true,
        publishedAt: true,
        theme: true,
      },
    });
    if (!magazine) {
      throw new NotFoundException('Magazine introuvable');
    }

    const theme = this.parseTheme(magazine.theme);
    const base = {
      id: magazine.id,
      title: magazine.title,
      issueNumber: magazine.issueNumber,
      coverUrl: this.resolveCoverUrl(magazine.coverKey),
      publishedAt: magazine.publishedAt?.toISOString() ?? null,
      accessType: magazine.accessType,
      theme,
      preview: true as const,
      maxPages: PREVIEW_PAGES,
      accessVia: 'preview' as const,
    };

    const pdfUrl = this.resolveCoverUrl(magazine.downloadKey);
    if (!pdfUrl) {
      return {
        ...base,
        canRead: false as const,
        code: 'NO_CONTENT',
        message: 'Aucun fichier PDF disponible pour ce numéro.',
        viewer: null,
        readerUrl: null,
        downloadUrl: null,
      };
    }

    return {
      ...base,
      canRead: true as const,
      code: null,
      message: `Aperçu limité aux ${PREVIEW_PAGES} premières pages.`,
      viewer: 'pdf' as const,
      readerUrl: pdfUrl,
      downloadUrl: null,
    };
  }

  private async resolveSubscriberAccess(
    subscriberId: string,
    magazineId: string,
    accessType: AccessType,
  ): Promise<
    | { allowed: true; via: 'free' | 'subscription' | 'purchase' }
    | { allowed: false; code: string; message: string }
  > {
    if (accessType === AccessType.FREE) {
      return { allowed: true, via: 'free' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        subscriberId,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.SUCCESS,
        expiresAt: { gte: today },
      },
      orderBy: { expiresAt: 'desc' },
      select: { id: true },
    });
    if (subscription) {
      return { allowed: true, via: 'subscription' };
    }

    const purchase = await this.prisma.purchase.findFirst({
      where: {
        subscriberId,
        magazineId,
        paymentStatus: PaymentStatus.SUCCESS,
      },
      select: { id: true },
    });
    if (purchase) {
      return { allowed: true, via: 'purchase' };
    }

    return {
      allowed: false,
      code: 'NO_ACCESS',
      message:
        'Abonnement actif ou achat de ce numéro requis pour lire ce magazine.',
    };
  }

  async create(dto: CreateMagazineDto, actorId: string) {
    const isPublished = Boolean(dto.isPublished);
    const accessType = dto.accessType ?? AccessType.PAID;
    const priceCents =
      accessType === AccessType.FREE
        ? null
        : dto.priceCents !== undefined
          ? dto.priceCents
          : null;

    const theme = dto.theme
      ? {
          bgColor: dto.theme.bgColor.trim().toLowerCase(),
          accentColor: dto.theme.accentColor.trim().toLowerCase(),
        }
      : undefined;

    const created = await this.prisma.magazine.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        issueNumber: dto.issueNumber?.trim() || null,
        accessType,
        priceCents,
        currency: (dto.currency?.trim() || 'USD').toUpperCase(),
        ...(theme ? { theme } : {}),
        coverKey: dto.coverKey?.trim() || null,
        pdfKey: dto.pdfKey?.trim() || null,
        previewKey: dto.previewKey?.trim() || null,
        downloadKey: dto.downloadKey?.trim() || null,
        isPublished,
        isActive: dto.isActive !== false,
        publishedAt: isPublished ? new Date() : null,
      },
      select: MAGAZINE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'magazine_created',
      entity: 'magazine',
      entityId: created.id,
      meta: {
        title: created.title,
        issueNumber: created.issueNumber,
        isPublished: created.isPublished,
        isActive: created.isActive,
      },
    });

    return this.toAdminMagazine(created);
  }

  async update(id: string, dto: UpdateMagazineDto, actorId: string) {
    const existing = await this.prisma.magazine.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Magazine introuvable');
    }

    const accessType = dto.accessType ?? existing.accessType;
    let priceCents =
      dto.priceCents !== undefined ? dto.priceCents : existing.priceCents;
    if (accessType === AccessType.FREE) {
      priceCents = null;
    }

    let publishedAt = existing.publishedAt;
    if (dto.isPublished === true && !existing.isPublished) {
      publishedAt = new Date();
    } else if (dto.isPublished === false) {
      publishedAt = existing.publishedAt;
    }

    const updated = await this.prisma.magazine.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.issueNumber !== undefined
          ? { issueNumber: dto.issueNumber?.trim() || null }
          : {}),
        ...(dto.accessType !== undefined ? { accessType: dto.accessType } : {}),
        priceCents,
        ...(dto.currency !== undefined
          ? { currency: dto.currency.trim().toUpperCase() || 'USD' }
          : {}),
        ...(dto.theme !== undefined
          ? {
              theme: dto.theme
                ? {
                    bgColor: dto.theme.bgColor.trim().toLowerCase(),
                    accentColor: dto.theme.accentColor.trim().toLowerCase(),
                  }
                : Prisma.JsonNull,
            }
          : {}),
        ...(dto.coverKey !== undefined
          ? { coverKey: dto.coverKey?.trim() || null }
          : {}),
        ...(dto.pdfKey !== undefined
          ? { pdfKey: dto.pdfKey?.trim() || null }
          : {}),
        ...(dto.previewKey !== undefined
          ? { previewKey: dto.previewKey?.trim() || null }
          : {}),
        ...(dto.downloadKey !== undefined
          ? { downloadKey: dto.downloadKey?.trim() || null }
          : {}),
        ...(dto.isPublished !== undefined
          ? { isPublished: dto.isPublished, publishedAt }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: MAGAZINE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'magazine_updated',
      entity: 'magazine',
      entityId: updated.id,
      meta: {
        title: updated.title,
        isPublished: updated.isPublished,
        isActive: updated.isActive,
      },
    });

    return this.toAdminMagazine(updated);
  }

  async uploadCover(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImageFile(file);

    const ext = this.safeExt(file.originalname, file.mimetype, [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);
    const key = `covers/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await this.uploadToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.magazine.update({
      where: { id },
      data: { coverKey: key },
      select: MAGAZINE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'magazine_cover_uploaded',
      entity: 'magazine',
      entityId: id,
      meta: { coverKey: key, size: file.size },
    });

    return this.toAdminMagazine(updated);
  }

  async uploadPdf(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertPdfFile(file);

    const ext = this.safeExt(file.originalname, file.mimetype, ['pdf']);
    const key = this.buildPdfKey(id, ext);
    await this.uploadToR2(key, file, 'application/pdf');

    return this.persistPdfKey(id, key, file.size, actorId, 'proxy');
  }

  async presignPdf(
    id: string,
    dto: PresignMagazinePdfDto,
    _actorId: string,
  ) {
    await this.assertExists(id);
    this.assertPdfMeta(dto.filename, dto.size, dto.contentType);

    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }

    const key = this.buildPdfKey(id, 'pdf');
    const signed = await presignR2PutObject(r2, {
      key,
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });

    return {
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers,
      expiresIn: 900,
      maxSize: 350_000_000,
    };
  }

  async completePdf(
    id: string,
    dto: CompleteMagazinePdfDto,
    actorId: string,
  ) {
    await this.assertExists(id);

    const key = dto.key.replace(/^\//, '');
    const prefix = `magazines/${id}/`;
    if (!key.startsWith(prefix) || key.includes('..')) {
      throw new BadRequestException('Clé R2 invalide pour ce magazine');
    }
    if (!key.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('La clé doit pointer vers un PDF');
    }
    if (dto.size > 350_000_000) {
      throw new BadRequestException('Le PDF dépasse 350 Mo');
    }

    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }

    const meta = await headR2Object(r2, key);
    if (!meta) {
      throw new BadRequestException(
        'Fichier introuvable sur R2 — upload incomplet ?',
      );
    }

    const remoteSize = meta.contentLength ?? 0;
    if (remoteSize <= 0) {
      throw new BadRequestException('Fichier R2 vide');
    }
    // Tolérance légère (certains clients / proxies).
    if (Math.abs(remoteSize - dto.size) > 1024) {
      throw new BadRequestException(
        `Taille R2 incohérente (${remoteSize} ≠ ${dto.size})`,
      );
    }

    const contentType = (meta.contentType ?? '').toLowerCase();
    if (
      contentType &&
      contentType !== 'application/pdf' &&
      contentType !== 'application/octet-stream' &&
      contentType !== 'binary/octet-stream'
    ) {
      throw new BadRequestException(
        `Type MIME R2 inattendu : ${meta.contentType}`,
      );
    }

    return this.persistPdfKey(id, key, remoteSize, actorId, 'presign');
  }

  private async persistPdfKey(
    id: string,
    key: string,
    size: number,
    actorId: string,
    via: 'proxy' | 'presign',
  ) {
    const updated = await this.prisma.magazine.update({
      where: { id },
      data: {
        downloadKey: key,
        // Remplace aussi le chemin de lecture s’il n’y a pas déjà une URL FlipHTML5.
        pdfKey: key,
      },
      select: MAGAZINE_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'magazine_pdf_uploaded',
      entity: 'magazine',
      entityId: id,
      meta: { downloadKey: key, size, via },
    });

    return this.toAdminMagazine(updated);
  }

  private buildPdfKey(magazineId: string, ext: string) {
    return `magazines/${magazineId}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  }

  private async assertExists(id: string) {
    const existing = await this.prisma.magazine.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Magazine introuvable');
    }
  }

  private assertPdfMeta(
    filename: string,
    size: number,
    contentType?: string,
  ) {
    if (size > 350_000_000) {
      throw new BadRequestException('Le PDF dépasse 350 Mo');
    }
    const ext = extname(filename).toLowerCase();
    const ok =
      contentType === 'application/pdf' ||
      contentType === 'application/x-pdf' ||
      !contentType ||
      ext === '.pdf';
    if (!ok && ext !== '.pdf') {
      throw new BadRequestException('Le fichier doit être un PDF');
    }
    if (ext && ext !== '.pdf') {
      throw new BadRequestException('Le fichier doit être un PDF');
    }
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('La couverture dépasse 5 Mo');
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

  private assertPdfFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 350_000_000) {
      throw new BadRequestException('Le PDF dépasse 350 Mo');
    }
    const ext = extname(file.originalname).toLowerCase();
    const ok =
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/x-pdf' ||
      ext === '.pdf';
    if (!ok) {
      throw new BadRequestException('Le fichier doit être un PDF');
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
      else if (mimetype.includes('pdf')) ext = 'pdf';
    }
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Extension de fichier non supportée');
    }
    return ext === 'jpeg' ? 'jpg' : ext;
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

  private toAdminMagazine(
    magazine: Prisma.MagazineGetPayload<{ select: typeof MAGAZINE_SELECT }>,
  ) {
    const { theme: rawTheme, ...rest } = magazine;
    return {
      ...rest,
      theme: this.parseTheme(rawTheme),
      coverUrl: this.resolveCoverUrl(magazine.coverKey),
      downloadUrl: this.resolveCoverUrl(magazine.downloadKey),
    };
  }

  private resolveCoverUrl(coverKey: string | null): string | null {
    if (!coverKey) return null;
    const trimmed = coverKey.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (trimmed.includes('/')) {
      return r2 ? `${r2}/${trimmed.replace(/^\//, '')}` : null;
    }

    return `/legacy/covers/${encodeURIComponent(trimmed)}`;
  }

  private resolveArticleCoverUrl(coverKey: string | null): string | null {
    if (!coverKey) return null;
    const trimmed = coverKey.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (trimmed.includes('/')) {
      return r2 ? `${r2}/${trimmed.replace(/^\//, '')}` : null;
    }

    return `/legacy/articles/${encodeURIComponent(trimmed)}`;
  }
}