import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActorType,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSubscriberDto } from './dto/admin-subscriber.dto';

const SUB_SELECT = {
  id: true,
  status: true,
  paymentStatus: true,
  startsAt: true,
  expiresAt: true,
  createdAt: true,
  plan: {
    select: {
      id: true,
      name: true,
      priceCents: true,
      currency: true,
      durationDays: true,
    },
  },
} satisfies Prisma.SubscriptionSelect;

const SUBSCRIBER_SELECT = {
  id: true,
  legacyId: true,
  name: true,
  email: true,
  phone: true,
  country: true,
  countryCode: true,
  address: true,
  subscriberCode: true,
  avatarKey: true,
  emailVerifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  subscriptions: {
    orderBy: { createdAt: 'desc' as const },
    take: 8,
    select: SUB_SELECT,
  },
} satisfies Prisma.SubscriberSelect;

@Injectable()
export class SubscribersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  async list(filters: {
    q?: string;
    active?: string;
    verified?: string;
    subscription?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);
    const q = filters.q?.trim();
    const now = new Date();
    const where = this.buildWhere(filters, now);

    const [items, total, summary] = await Promise.all([
      this.prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: SUBSCRIBER_SELECT,
      }),
      this.prisma.subscriber.count({ where }),
      this.summaryCounts(now),
    ]);

    return {
      items: items.map((item) => this.toAdmin(item, now)),
      total,
      take,
      skip,
      summary,
    };
  }

  async getById(id: string) {
    const item = await this.prisma.subscriber.findUnique({
      where: { id },
      select: {
        ...SUBSCRIBER_SELECT,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: SUB_SELECT,
        },
      },
    });
    if (!item) {
      throw new NotFoundException('Abonné introuvable');
    }
    return this.toAdmin(item, new Date());
  }

  async update(id: string, dto: UpdateSubscriberDto, actorId: string) {
    const existing = await this.prisma.subscriber.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        country: true,
        countryCode: true,
        address: true,
        isActive: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Abonné introuvable');
    }

    const data: Prisma.SubscriberUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== existing.email) {
        const taken = await this.prisma.subscriber.findUnique({
          where: { email },
          select: { id: true },
        });
        if (taken && taken.id !== id) {
          throw new ConflictException('Cet email est déjà utilisé');
        }
        data.email = email;
        data.emailVerifiedAt = null;
      }
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone?.trim() || null;
    }
    if (dto.country !== undefined) {
      data.country = dto.country?.trim() || null;
    }
    if (dto.countryCode !== undefined) {
      data.countryCode = dto.countryCode?.trim() || null;
    }
    if (dto.address !== undefined) {
      data.address = dto.address?.trim() || null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.subscriber.update({
      where: { id },
      data,
      select: {
        ...SUBSCRIBER_SELECT,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          select: SUB_SELECT,
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action:
        dto.isActive === false && existing.isActive
          ? 'subscriber_blocked'
          : dto.isActive === true && !existing.isActive
            ? 'subscriber_unblocked'
            : 'subscriber_updated',
      entity: 'subscriber',
      entityId: id,
      meta: {
        before: {
          name: existing.name,
          email: existing.email,
          isActive: existing.isActive,
        },
        after: {
          name: updated.name,
          email: updated.email,
          isActive: updated.isActive,
        },
        patch: { ...dto },
      },
    });

    return this.toAdmin(updated, new Date());
  }

  private buildWhere(
    filters: {
      q?: string;
      active?: string;
      verified?: string;
      subscription?: string;
    },
    now: Date,
  ): Prisma.SubscriberWhereInput {
    const q = filters.q?.trim();
    const active = this.parseBool(filters.active);
    const verified = this.parseBool(filters.verified);
    const subscription = filters.subscription?.trim().toUpperCase();

    const liveSubFilter: Prisma.SubscriptionWhereInput = {
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.SUCCESS,
      expiresAt: { gt: now },
    };

    return {
      ...(active !== undefined ? { isActive: active } : {}),
      ...(verified === true
        ? { emailVerifiedAt: { not: null } }
        : verified === false
          ? { emailVerifiedAt: null }
          : {}),
      ...(subscription === 'LIVE'
        ? { subscriptions: { some: liveSubFilter } }
        : subscription === 'NONE'
          ? { subscriptions: { none: liveSubFilter } }
          : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { subscriberCode: { contains: q, mode: 'insensitive' } },
              { country: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async summaryCounts(now: Date) {
    const liveSubFilter: Prisma.SubscriptionWhereInput = {
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.SUCCESS,
      expiresAt: { gt: now },
    };

    const [total, active, inactive, verified, withLiveSub] = await Promise.all([
      this.prisma.subscriber.count(),
      this.prisma.subscriber.count({ where: { isActive: true } }),
      this.prisma.subscriber.count({ where: { isActive: false } }),
      this.prisma.subscriber.count({
        where: { emailVerifiedAt: { not: null } },
      }),
      this.prisma.subscriber.count({
        where: { subscriptions: { some: liveSubFilter } },
      }),
    ]);

    return { total, active, inactive, verified, withLiveSub };
  }

  private parseBool(value?: string): boolean | undefined {
    if (value == null || value === '') return undefined;
    const v = value.trim().toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
    if (v === '0' || v === 'false' || v === 'no') return false;
    return undefined;
  }

  private isLiveSub(
    sub: {
      status: SubscriptionStatus;
      paymentStatus: PaymentStatus;
      expiresAt: Date;
    },
    now: Date,
  ) {
    return (
      sub.status === SubscriptionStatus.ACTIVE &&
      sub.paymentStatus === PaymentStatus.SUCCESS &&
      sub.expiresAt > now
    );
  }

  private toAdmin(
    item: {
      id: string;
      legacyId: number | null;
      name: string;
      email: string;
      phone: string | null;
      country: string | null;
      countryCode: string | null;
      address: string | null;
      subscriberCode: string | null;
      avatarKey: string | null;
      emailVerifiedAt: Date | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      subscriptions: Array<{
        id: string;
        status: SubscriptionStatus;
        paymentStatus: PaymentStatus;
        startsAt: Date;
        expiresAt: Date;
        createdAt: Date;
        plan: {
          id: string;
          name: string;
          priceCents: number;
          currency: string;
          durationDays: number;
        };
      }>;
    },
    now: Date,
  ) {
    const { avatarKey, emailVerifiedAt, subscriptions, ...rest } = item;
    const live = subscriptions.find((s) => this.isLiveSub(s, now)) ?? null;

    return {
      ...rest,
      emailVerified: Boolean(emailVerifiedAt),
      emailVerifiedAt: emailVerifiedAt?.toISOString() ?? null,
      avatarUrl: this.resolveAvatarUrl(avatarKey),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      hasLiveSubscription: Boolean(live),
      liveSubscription: live
        ? {
            id: live.id,
            status: live.status,
            paymentStatus: live.paymentStatus,
            startsAt: live.startsAt.toISOString(),
            expiresAt: live.expiresAt.toISOString(),
            isLive: true,
            plan: live.plan,
          }
        : null,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        paymentStatus: s.paymentStatus,
        startsAt: s.startsAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        isLive: this.isLiveSub(s, now),
        plan: s.plan,
      })),
    };
  }

  private resolveAvatarUrl(avatarKey: string | null): string | null {
    if (!avatarKey) return null;
    const key = avatarKey.trim();
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;

    const basename = key.includes('/') ? (key.split('/').pop() ?? key) : key;
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
