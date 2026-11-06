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
import { CreateAuthorDto, UpdateAuthorDto } from './dto/admin-author.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const AUTHOR_SELECT = {
  id: true,
  name: true,
  title: true,
  avatarKey: true,
  adminUserId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { articles: true } },
} satisfies Prisma.AuthorSelect;

@Injectable()
export class AuthorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    actorId: string,
    filters: { q?: string; take?: number; skip?: number } = {},
  ) {
    await this.ensureForAdminUser(actorId);

    const q = filters.q?.trim();
    const take = Math.min(Math.max(filters.take ?? 100, 1), 200);
    const skip = Math.max(filters.skip ?? 0, 0);

    const where: Prisma.AuthorWhereInput = q
      ? {
          OR: [{ name: { contains: q } }, { title: { contains: q } }],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.author.findMany({
        where,
        orderBy: { name: 'asc' },
        take,
        skip,
        select: AUTHOR_SELECT,
      }),
      this.prisma.author.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
    };
  }

  async getById(id: string) {
    const row = await this.prisma.author.findUnique({
      where: { id },
      select: AUTHOR_SELECT,
    });
    if (!row) throw new NotFoundException('Auteur introuvable');
    return this.toAdmin(row);
  }

  async create(dto: CreateAuthorDto, actorId: string) {
    const name = dto.name.trim();
    const title = this.normalizeTitle(dto.title);
    const created = await this.prisma.author.create({
      data: { name, title },
      select: AUTHOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'author_created',
      entity: 'author',
      entityId: created.id,
      meta: { name: created.name },
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateAuthorDto, actorId: string) {
    await this.assertExists(id);
    const data: Prisma.AuthorUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.title !== undefined) data.title = this.normalizeTitle(dto.title);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.author.update({
      where: { id },
      data,
      select: AUTHOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'author_updated',
      entity: 'author',
      entityId: id,
      meta: { name: updated.name },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.author.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        adminUserId: true,
        _count: { select: { articles: true } },
      },
    });
    if (!existing) throw new NotFoundException('Auteur introuvable');

    await this.prisma.author.delete({ where: { id } });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'author_deleted',
      entity: 'author',
      entityId: id,
      meta: {
        name: existing.name,
        articlesUnlinked: existing._count.articles,
      },
    });

    return { ok: true as const };
  }

  async uploadAvatar(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImageFile(file);

    const ext = this.safeExt(file.originalname, file.mimetype);
    const key = `authors/${id}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await this.uploadToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.author.update({
      where: { id },
      data: { avatarKey: key },
      select: AUTHOR_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'author_avatar_uploaded',
      entity: 'author',
      entityId: id,
      meta: { avatarKey: key, size: file.size },
    });

    return this.toAdmin(updated);
  }

  async ensureForAdminUser(adminUserId: string) {
    const existing = await this.prisma.author.findUnique({
      where: { adminUserId },
      select: AUTHOR_SELECT,
    });
    if (existing) return this.toAdmin(existing);

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: {
        id: true,
        name: true,
        title: true,
        avatarKey: true,
      },
    });
    if (!admin) throw new NotFoundException('Administrateur introuvable');

    const byId = await this.prisma.author.findUnique({
      where: { id: admin.id },
      select: { id: true },
    });

    const created = await this.prisma.author.create({
      data: {
        ...(byId ? {} : { id: admin.id }),
        name: admin.name,
        title: admin.title,
        avatarKey: admin.avatarKey,
        adminUserId: admin.id,
      },
      select: AUTHOR_SELECT,
    });

    return this.toAdmin(created);
  }

  private async assertExists(id: string) {
    const row = await this.prisma.author.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Auteur introuvable');
  }

  private normalizeTitle(raw: string | null | undefined): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > 5_000_000) {
      throw new BadRequestException('La photo dépasse 5 Mo');
    }
    const ok =
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/webp';
    if (!ok) {
      throw new BadRequestException('Formats photo : JPG, PNG, WEBP');
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
    row: Prisma.AuthorGetPayload<{ select: typeof AUTHOR_SELECT }>,
  ) {
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      avatarKey: row.avatarKey,
      avatarUrl: this.resolveMediaUrl(row.avatarKey),
      adminUserId: row.adminUserId,
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
