import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityActorType, AdminRole, Prisma } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './password.util';
import { CreateStaffDto, UpdateStaffDto } from './dto/admin-staff.dto';

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  title: true,
  phone: true,
  avatarKey: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  async list(filters: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  } = {}) {
    const query = filters.q?.trim();
    const take = Math.min(Math.max(filters.take ?? 10, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);

    const activeFilter =
      filters.active === 'true'
        ? true
        : filters.active === 'false'
          ? false
          : undefined;

    const where: Prisma.AdminUserWhereInput = {
      ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total, all, active, suspended] = await Promise.all([
      this.prisma.adminUser.findMany({
        where,
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
        take,
        skip,
        select: STAFF_SELECT,
      }),
      this.prisma.adminUser.count({ where }),
      this.prisma.adminUser.count(),
      this.prisma.adminUser.count({ where: { isActive: true } }),
      this.prisma.adminUser.count({ where: { isActive: false } }),
    ]);

    return {
      items: items.map((row) => this.toPublic(row)),
      total,
      take,
      skip,
      summary: { total: all, active, suspended },
    };
  }

  async create(dto: CreateStaffDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.adminUser.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const created = await this.prisma.adminUser.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await hashPassword(dto.password),
        role: dto.role,
        title: dto.title?.trim() || null,
      },
      select: STAFF_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'staff_created',
      entity: 'admin_user',
      entityId: created.id,
      meta: { email: created.email, role: created.role, name: created.name },
    });

    return this.toPublic(created);
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) {
      throw new NotFoundException('Compte introuvable');
    }

    if (
      admin.role === AdminRole.SUPERADMIN &&
      dto.role &&
      dto.role !== AdminRole.SUPERADMIN
    ) {
      await this.assertNotLastSuperadmin(id);
    }

    if (dto.isActive === false) {
      if (id === actorId) {
        throw new BadRequestException(
          'Vous ne pouvez pas désactiver votre propre compte',
        );
      }
      if (admin.role === AdminRole.SUPERADMIN) {
        await this.assertNotLastSuperadmin(id);
      }
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.title !== undefined
          ? { title: dto.title.trim() || null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.password
          ? { passwordHash: await hashPassword(dto.password) }
          : {}),
      },
      select: STAFF_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'staff_updated',
      entity: 'admin_user',
      entityId: updated.id,
      meta: {
        email: updated.email,
        role: updated.role,
        isActive: updated.isActive,
        passwordReset: Boolean(dto.password),
      },
    });

    return this.toPublic(updated);
  }

  private toPublic(row: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    phone: string | null;
    avatarKey: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { avatarKey, ...rest } = row;
    return {
      ...rest,
      avatarUrl: this.resolveAvatarUrl(avatarKey),
    };
  }

  private resolveAvatarUrl(avatarKey: string | null): string | null {
    if (!avatarKey) return null;
    const key = avatarKey.trim();
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;

    const basename = key.includes('/')
      ? (key.split('/').pop() ?? key)
      : key;
    const localUrl = `/legacy/profil/${encodeURIComponent(basename)}`;

    const useCdn =
      this.config.get<string>('AVATAR_USE_CDN')?.trim().toLowerCase() ===
      'true';
    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');

    if (useCdn && r2 && key.includes('/')) {
      return `${r2}/${key.replace(/^\//, '')}`;
    }

    return localUrl;
  }

  private async assertNotLastSuperadmin(excludeId: string) {
    const count = await this.prisma.adminUser.count({
      where: {
        role: AdminRole.SUPERADMIN,
        isActive: true,
        id: { not: excludeId },
      },
    });
    if (count === 0) {
      throw new BadRequestException(
        'Impossible : il doit rester au moins un superadmin actif',
      );
    }
  }
}
