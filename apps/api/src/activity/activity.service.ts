import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LogActivityInput = {
  actorType: ActivityActorType;
  adminId?: string | null;
  subscriberId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | number | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
};

const ACTOR_SELECT = {
  admin: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarKey: true,
    },
  },
  subscriber: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarKey: true,
    },
  },
} as const;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Never throws — logging must not break the main flow. */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          actorType: input.actorType,
          adminId: input.adminId ?? null,
          subscriberId: input.subscriberId ?? null,
          action: input.action,
          entity: input.entity ?? null,
          entityId:
            input.entityId === undefined || input.entityId === null
              ? null
              : String(input.entityId),
          meta: input.meta ?? undefined,
          ip: input.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write activity log', error as Error);
    }
  }

  async list(filters: {
    take?: number;
    skip?: number;
    actorType?: ActivityActorType;
    q?: string;
  } = {}) {
    const take = Math.min(filters.take ?? 40, 100);
    const skip = filters.skip ?? 0;
    const q = filters.q?.trim();

    const where: Prisma.ActivityLogWhereInput = {
      ...(filters.actorType ? { actorType: filters.actorType } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' } },
              { entity: { contains: q, mode: 'insensitive' } },
              { entityId: { contains: q, mode: 'insensitive' } },
              { admin: { email: { contains: q, mode: 'insensitive' } } },
              { admin: { name: { contains: q, mode: 'insensitive' } } },
              { subscriber: { email: { contains: q, mode: 'insensitive' } } },
              { subscriber: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: ACTOR_SELECT,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toPublic(item)),
      total,
      take,
      skip,
    };
  }

  async getById(id: string) {
    const item = await this.prisma.activityLog.findUnique({
      where: { id },
      include: ACTOR_SELECT,
    });
    return item ? this.toPublic(item) : null;
  }

  async recent(take = 8) {
    const items = await this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: ACTOR_SELECT,
    });
    return items.map((item) => this.toPublic(item));
  }

  private toPublic<
    T extends {
      admin: {
        id: string;
        name: string;
        email: string;
        role: string;
        avatarKey: string | null;
      } | null;
      subscriber: {
        id: string;
        name: string;
        email: string;
        avatarKey: string | null;
      } | null;
    },
  >(item: T) {
    const { admin, subscriber, ...rest } = item;
    return {
      ...rest,
      admin: admin
        ? {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            avatarUrl: this.resolveAvatarUrl(admin.avatarKey),
          }
        : null,
      subscriber: subscriber
        ? {
            id: subscriber.id,
            name: subscriber.name,
            email: subscriber.email,
            avatarUrl: this.resolveAvatarUrl(subscriber.avatarKey),
          }
        : null,
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
}
