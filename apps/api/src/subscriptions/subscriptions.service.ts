import {
  BadRequestException,
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
import { UpdateSubscriptionDto } from './dto/admin-subscription.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/admin-plan.dto';

const PLAN_SELECT = {
  id: true,
  legacyId: true,
  name: true,
  description: true,
  priceCents: true,
  currency: true,
  durationDays: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { subscriptions: true },
  },
} satisfies Prisma.PlanSelect;

const SUBSCRIPTION_SELECT = {
  id: true,
  legacyId: true,
  status: true,
  paymentStatus: true,
  transactionRef: true,
  startsAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  subscriber: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      country: true,
      isActive: true,
      avatarKey: true,
    },
  },
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

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly config: ConfigService,
  ) {}

  async list(filters: {
    q?: string;
    status?: string;
    paymentStatus?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);
    const q = filters.q?.trim();
    const now = new Date();

    const status = this.parseStatus(filters.status);
    const paymentStatus = this.parsePaymentStatus(filters.paymentStatus);

    const where: Prisma.SubscriptionWhereInput = {
      ...(status === 'ACTIVE_NOW'
        ? {
            status: SubscriptionStatus.ACTIVE,
            expiresAt: { gt: now },
            paymentStatus: PaymentStatus.SUCCESS,
          }
        : status
          ? { status }
          : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(q
        ? {
            OR: [
              { transactionRef: { contains: q, mode: 'insensitive' } },
              {
                subscriber: {
                  email: { contains: q, mode: 'insensitive' },
                },
              },
              {
                subscriber: {
                  name: { contains: q, mode: 'insensitive' },
                },
              },
              {
                subscriber: {
                  phone: { contains: q, mode: 'insensitive' },
                },
              },
              {
                plan: {
                  name: { contains: q, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total, summary] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: SUBSCRIPTION_SELECT,
      }),
      this.prisma.subscription.count({ where }),
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
    const item = await this.prisma.subscription.findUnique({
      where: { id },
      select: SUBSCRIPTION_SELECT,
    });
    if (!item) {
      throw new NotFoundException('Abonnement introuvable');
    }
    return this.toAdmin(item, new Date());
  }

  async update(id: string, dto: UpdateSubscriptionDto, actorId: string) {
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
      select: { id: true, expiresAt: true, status: true, paymentStatus: true },
    });
    if (!existing) {
      throw new NotFoundException('Abonnement introuvable');
    }

    const data: Prisma.SubscriptionUpdateInput = {};

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.paymentStatus !== undefined) data.paymentStatus = dto.paymentStatus;
    if (dto.startsAt !== undefined) data.startsAt = new Date(dto.startsAt);
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);

    if (dto.extendDays != null) {
      const base =
        existing.expiresAt.getTime() > Date.now()
          ? existing.expiresAt
          : new Date();
      const next = new Date(base);
      next.setDate(next.getDate() + dto.extendDays);
      data.expiresAt = next;
      if (dto.status === undefined) {
        data.status = SubscriptionStatus.ACTIVE;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.subscription.update({
      where: { id },
      data,
      select: SUBSCRIPTION_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'subscription_updated',
      entity: 'subscription',
      entityId: id,
      meta: {
        before: {
          status: existing.status,
          paymentStatus: existing.paymentStatus,
          expiresAt: existing.expiresAt.toISOString(),
        },
        after: {
          status: updated.status,
          paymentStatus: updated.paymentStatus,
          expiresAt: updated.expiresAt.toISOString(),
        },
        patch: { ...dto },
      },
    });

    return this.toAdmin(updated, new Date());
  }

  async listPublicPlans() {
    const items = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ priceCents: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        currency: true,
        durationDays: true,
      },
    });

    return {
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        currency: p.currency,
        durationDays: p.durationDays,
      })),
    };
  }

  async listPlans(filters: { active?: string } = {}) {
    const active =
      filters.active === '1' || filters.active === 'true'
        ? true
        : filters.active === '0' || filters.active === 'false'
          ? false
          : undefined;

    const items = await this.prisma.plan.findMany({
      where: active === undefined ? undefined : { isActive: active },
      orderBy: [{ isActive: 'desc' }, { priceCents: 'asc' }, { name: 'asc' }],
      select: PLAN_SELECT,
    });

    return {
      items: items.map((p) => this.toAdminPlan(p)),
      total: items.length,
    };
  }

  async createPlan(dto: CreatePlanDto, actorId: string) {
    const created = await this.prisma.plan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        priceCents: dto.priceCents,
        currency: (dto.currency?.trim().toUpperCase() || 'USD').slice(0, 8),
        durationDays: dto.durationDays,
        isActive: dto.isActive ?? true,
      },
      select: PLAN_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'plan_created',
      entity: 'plan',
      entityId: created.id,
      meta: {
        name: created.name,
        priceCents: created.priceCents,
        durationDays: created.durationDays,
      },
    });

    return this.toAdminPlan(created);
  }

  async updatePlan(id: string, dto: UpdatePlanDto, actorId: string) {
    const existing = await this.prisma.plan.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        priceCents: true,
        durationDays: true,
        isActive: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Formule introuvable');
    }

    const data: Prisma.PlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.currency !== undefined) {
      data.currency = dto.currency.trim().toUpperCase().slice(0, 8);
    }
    if (dto.durationDays !== undefined) data.durationDays = dto.durationDays;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
      select: PLAN_SELECT,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'plan_updated',
      entity: 'plan',
      entityId: id,
      meta: {
        before: existing,
        after: {
          name: updated.name,
          priceCents: updated.priceCents,
          durationDays: updated.durationDays,
          isActive: updated.isActive,
        },
        patch: { ...dto },
      },
    });

    return this.toAdminPlan(updated);
  }

  private toAdminPlan(
    plan: Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>,
  ) {
    return {
      id: plan.id,
      legacyId: plan.legacyId,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
      durationDays: plan.durationDays,
      isActive: plan.isActive,
      subscriptionsCount: plan._count.subscriptions,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private async summaryCounts(now: Date) {
    const [activeNow, pendingPayment, expired, cancelled, total] =
      await Promise.all([
        this.prisma.subscription.count({
          where: {
            status: SubscriptionStatus.ACTIVE,
            expiresAt: { gt: now },
            paymentStatus: PaymentStatus.SUCCESS,
          },
        }),
        this.prisma.subscription.count({
          where: { paymentStatus: PaymentStatus.PENDING },
        }),
        this.prisma.subscription.count({
          where: {
            OR: [
              { status: SubscriptionStatus.EXPIRED },
              {
                status: SubscriptionStatus.ACTIVE,
                expiresAt: { lte: now },
              },
            ],
          },
        }),
        this.prisma.subscription.count({
          where: { status: SubscriptionStatus.CANCELLED },
        }),
        this.prisma.subscription.count(),
      ]);

    return { activeNow, pendingPayment, expired, cancelled, total };
  }

  private parseStatus(
    value?: string,
  ): SubscriptionStatus | 'ACTIVE_NOW' | undefined {
    if (!value) return undefined;
    if (value === 'ACTIVE_NOW') return 'ACTIVE_NOW';
    if (
      Object.values(SubscriptionStatus).includes(value as SubscriptionStatus)
    ) {
      return value as SubscriptionStatus;
    }
    return undefined;
  }

  private parsePaymentStatus(value?: string): PaymentStatus | undefined {
    if (!value) return undefined;
    if (Object.values(PaymentStatus).includes(value as PaymentStatus)) {
      return value as PaymentStatus;
    }
    return undefined;
  }

  private toAdmin(
    item: Prisma.SubscriptionGetPayload<{ select: typeof SUBSCRIPTION_SELECT }>,
    now: Date,
  ) {
    const isLive =
      item.status === SubscriptionStatus.ACTIVE &&
      item.paymentStatus === PaymentStatus.SUCCESS &&
      item.expiresAt > now;

    const { avatarKey, ...subscriber } = item.subscriber;

    return {
      ...item,
      subscriber: {
        ...subscriber,
        avatarUrl: this.resolveAvatarUrl(avatarKey),
      },
      startsAt: item.startsAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      isLive,
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
