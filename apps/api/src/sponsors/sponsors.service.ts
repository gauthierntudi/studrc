import {
  BadRequestException,
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
import { CreateSponsorDto, UpdateSponsorDto } from './dto/admin-sponsor.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const SPONSOR_SELECT = {
  id: true,
  name: true,
  logoKey: true,
  url: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { articles: true } },
} satisfies Prisma.SponsorSelect;

@Injectable()
export class SponsorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async list(filters: { q?: string; take?: number; skip?: number } = {}) {
    const q = filters.q?.trim();
    const take = Math.min(Math.max(filters.take ?? 100, 1), 200);
    const skip = Math.max(filters.skip ?? 0, 0);

    const where: Prisma.SponsorWhereInput = q
      ? {
          OR: [{ name: { contains: q } }, { url: { contains: q } }],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.sponsor.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        skip,
        select: SPONSOR_SELECT,
      }),
      this.prisma.sponsor.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.sponsor.findUnique({
      where: { id },
      select: SPONSOR_SELECT,
    });
    if (!row) throw new NotFoundException('Sponsor introuvable');
    return this.toAdmin(row);
  }

  async create(dto: CreateSponsorDto, actorId: string) {
    const name = dto.name.trim();
    const url = this.normalizeUrl(dto.url);
    const created = await this.prisma.sponsor.create({
      data: { name, url },
      select: SPONSOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'sponsor_created',
      entity: 'sponsor',
      entityId: created.id,
      meta: { name: created.name },
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateSponsorDto, actorId: string) {
    await this.assertExists(id);
    const data: Prisma.SponsorUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.url !== undefined) data.url = this.normalizeUrl(dto.url);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.sponsor.update({
      where: { id },
      data,
      select: SPONSOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'sponsor_updated',
      entity: 'sponsor',
      entityId: id,
      meta: { name: updated.name },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.sponsor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { articles: true } },
      },
    });
    if (!existing) throw new NotFoundException('Sponsor introuvable');

    await this.prisma.sponsor.delete({ where: { id } });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'sponsor_deleted',
      entity: 'sponsor',
      entityId: id,
      meta: {
        name: existing.name,
        articlesUnlinked: existing._count.articles,
      },
    });

    return { ok: true as const };
  }

  async uploadLogo(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImageFile(file);

    const ext = this.safeExt(file.originalname, file.mimetype);
    const key = `sponsors/${id}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await this.uploadToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.sponsor.update({
      where: { id },
      data: { logoKey: key },
      select: SPONSOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'sponsor_logo_uploaded',
      entity: 'sponsor',
      entityId: id,
      meta: { logoKey: key, size: file.size },
    });

    return this.toAdmin(updated);
  }

  private async assertExists(id: string) {
    const row = await this.prisma.sponsor.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Sponsor introuvable');
  }

  private normalizeUrl(raw: string | null | undefined): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('Le logo dépasse 5 Mo');
    }
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp';
    if (!ok) {
      throw new BadRequestException('Formats logo : JPG, PNG, WEBP');
    }
  }

  private safeExt(originalname: string, mimetype: string): string {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      if (mimetype.includes('jpeg') || mimetype.includes('jpg')) ext = 'jpg';
      else if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
    }
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      throw new BadRequestException('Extension de fichier non supportée');
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private async uploadToR2(key: string, file: UploadFile, contentType: string) {
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

  private toAdmin(
    row: Prisma.SponsorGetPayload<{ select: typeof SPONSOR_SELECT }>,
  ) {
    return {
      id: row.id,
      name: row.name,
      logoKey: row.logoKey,
      logoUrl: this.resolveMediaUrl(row.logoKey),
      url: row.url,
      articlesCount: row._count.articles,
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
