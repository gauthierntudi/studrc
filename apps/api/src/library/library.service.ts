import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type LibraryStatus = 'active' | 'expired' | 'pending' | 'none';

export type NotificationKind =
  | 'ARTICLE'
  | 'MAGAZINE'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'PURCHASE_READY';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string;
  coverUrl: string | null;
  createdAt: Date;
  unread: boolean;
};

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getLibrary(subscriberId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { subscriberId },
      orderBy: [{ createdAt: 'desc' }, { expiresAt: 'desc' }],
      include: {
        plan: { select: { name: true, durationDays: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let status: LibraryStatus = 'none';
    let expiresAt: Date | null = null;
    let planName: string | null = null;

    if (subscription) {
      expiresAt = subscription.expiresAt;
      planName = subscription.plan?.name ?? null;
      const paid = subscription.paymentStatus === PaymentStatus.SUCCESS;
      const activeStatus =
        subscription.status === SubscriptionStatus.ACTIVE;
      const notExpired = subscription.expiresAt >= today;

      if (paid && activeStatus && notExpired) {
        status = 'active';
      } else if (paid && subscription.expiresAt < today) {
        status = 'expired';
      } else if (!paid) {
        status = 'pending';
      } else {
        status = 'none';
      }
    }

    const magazines =
      status === 'active'
        ? await this.prisma.magazine.findMany({
            where: { isPublished: true, isActive: true },
            orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              title: true,
              issueNumber: true,
              coverKey: true,
              pdfKey: true,
              publishedAt: true,
            },
          })
        : [];

    return {
      status,
      expiresAt,
      planName,
      magazines: magazines.map((m) => ({
        id: m.id,
        title: m.title,
        issueNumber: m.issueNumber,
        coverUrl: this.resolveCoverUrl(m.coverKey),
        publishedAt: m.publishedAt,
        readPath: m.pdfKey ? `/lecture/${m.id}` : null,
      })),
    };
  }

  /**
   * Fil d’alertes unifié : nouveautés éditoriales + événements compte
   * (paiements, abonnement bientôt expiré, achats prêts).
   */
  async getNotifications(
    subscriberId: string,
    opts: {
      days?: number;
      q?: string;
      type?: string;
      unreadOnly?: boolean;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const days = this.normalizeDays(opts.days);
    const take = Math.min(50, Math.max(1, opts.take ?? 10));
    const skip = Math.max(0, opts.skip ?? 0);
    const type = this.normalizeNotifType(opts.type);
    const q = opts.q?.trim().toLowerCase() ?? '';
    const unreadOnly = Boolean(opts.unreadOnly);

    const items = await this.collectNotificationItems(subscriberId, days);

    const filtered = items.filter((item) => {
      if (unreadOnly && !item.unread) return false;
      if (!this.matchesNotifType(item.kind, type)) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.body ?? ''}`.toLowerCase();
      return hay.includes(q);
    });

    const unreadCount = items.filter((i) => i.unread).length;
    const total = filtered.length;
    const page = filtered.slice(skip, skip + take);

    return {
      items: page,
      total,
      take,
      skip,
      days,
      unreadCount,
      unreadOnly,
    };
  }

  async getUnreadNotificationsCount(subscriberId: string, days = 3) {
    const normalizedDays = this.normalizeDays(days);
    const items = await this.collectNotificationItems(
      subscriberId,
      normalizedDays,
    );
    return {
      unreadCount: items.filter((i) => i.unread).length,
      days: normalizedDays,
    };
  }

  async markNotificationRead(subscriberId: string, notificationId: string) {
    const id = notificationId?.trim();
    if (!id || id.length > 191) {
      return { ok: false as const, unreadCount: 0 };
    }

    await this.prisma.notificationRead.upsert({
      where: {
        subscriberId_notificationId: {
          subscriberId,
          notificationId: id,
        },
      },
      create: { subscriberId, notificationId: id },
      update: { readAt: new Date() },
    });

    const { unreadCount } = await this.getUnreadNotificationsCount(
      subscriberId,
      3,
    );
    return { ok: true as const, notificationId: id, unreadCount };
  }

  /** Marque toutes les alertes de la fenêtre comme lues (optionnel). */
  async markNotificationsSeen(subscriberId: string, days = 3) {
    const normalizedDays = this.normalizeDays(days);
    const items = await this.collectNotificationItems(
      subscriberId,
      normalizedDays,
    );
    const unread = items.filter((i) => i.unread);
    if (unread.length > 0) {
      await this.prisma.notificationRead.createMany({
        data: unread.map((i) => ({
          subscriberId,
          notificationId: i.id,
        })),
        skipDuplicates: true,
      });
    }
    const now = new Date();
    await this.prisma.subscriber.update({
      where: { id: subscriberId },
      data: { notificationsSeenAt: now },
    });
    return { seenAt: now, unreadCount: 0 };
  }

  private normalizeDays(raw?: number) {
    if (raw === 7 || raw === 30) return raw;
    return 3;
  }

  private normalizeNotifType(
    raw?: string,
  ): 'all' | 'articles' | 'magazines' | 'account' {
    const v = raw?.trim().toLowerCase();
    if (v === 'articles' || v === 'magazines' || v === 'account') return v;
    return 'all';
  }

  private matchesNotifType(
    kind: NotificationKind,
    type: 'all' | 'articles' | 'magazines' | 'account',
  ) {
    if (type === 'all') return true;
    if (type === 'articles') return kind === 'ARTICLE';
    if (type === 'magazines') return kind === 'MAGAZINE';
    return kind !== 'ARTICLE' && kind !== 'MAGAZINE';
  }

  private async collectNotificationItems(
    subscriberId: string,
    days: number,
  ): Promise<NotificationItem[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiringUntil = new Date(today);
    expiringUntil.setDate(expiringUntil.getDate() + 14);

    const [
      articles,
      magazines,
      payments,
      subscription,
      purchases,
      subscriber,
      reads,
    ] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          isPublished: true,
          OR: [
            { publishedAt: { gte: since } },
            { publishedAt: null, createdAt: { gte: since } },
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 60,
        select: {
          id: true,
          title: true,
          slug: true,
          coverKey: true,
          category: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.magazine.findMany({
        where: {
          isPublished: true,
          isActive: true,
          OR: [
            { publishedAt: { gte: since } },
            { publishedAt: null, createdAt: { gte: since } },
          ],
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 40,
        select: {
          id: true,
          title: true,
          issueNumber: true,
          coverKey: true,
          publishedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          subscriberId,
          createdAt: { gte: since },
          status: {
            in: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          plan: { select: { name: true } },
          magazine: { select: { title: true, issueNumber: true } },
        },
      }),
      this.prisma.subscription.findFirst({
        where: {
          subscriberId,
          status: SubscriptionStatus.ACTIVE,
          paymentStatus: PaymentStatus.SUCCESS,
          expiresAt: { gte: today, lte: expiringUntil },
        },
        orderBy: { expiresAt: 'asc' },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.purchase.findMany({
        where: {
          subscriberId,
          paymentStatus: PaymentStatus.SUCCESS,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          magazine: {
            select: {
              id: true,
              title: true,
              issueNumber: true,
              coverKey: true,
              pdfKey: true,
              isPublished: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { notificationsSeenAt: true },
      }),
      this.prisma.notificationRead.findMany({
        where: { subscriberId },
        select: { notificationId: true },
      }),
    ]);

    const readIds = new Set(reads.map((r) => r.notificationId));
    const seenAt = subscriber?.notificationsSeenAt ?? null;
    const isUnread = (id: string, at: Date) => {
      if (readIds.has(id)) return false;
      if (seenAt && at <= seenAt) return false;
      return true;
    };
    const items: NotificationItem[] = [];

    for (const a of articles) {
      const createdAt = a.publishedAt ?? a.createdAt;
      const id = `ARTICLE:${a.id}`;
      items.push({
        id,
        kind: 'ARTICLE',
        title: a.title,
        body: a.category ? `Article · ${a.category}` : 'Nouvel article',
        href: `/article/${a.slug}`,
        coverUrl: this.resolveMediaUrl(a.coverKey, 'articles'),
        createdAt,
        unread: isUnread(id, createdAt),
      });
    }

    for (const m of magazines) {
      const createdAt = m.publishedAt ?? m.createdAt;
      const id = `MAGAZINE:${m.id}`;
      items.push({
        id,
        kind: 'MAGAZINE',
        title: m.title,
        body: m.issueNumber
          ? `Nouveau magazine · #${m.issueNumber}`
          : 'Nouveau magazine',
        href: `/lecture/${m.id}`,
        coverUrl: this.resolveCoverUrl(m.coverKey),
        createdAt,
        unread: isUnread(id, createdAt),
      });
    }

    for (const p of payments) {
      const ok = p.status === PaymentStatus.SUCCESS;
      const label =
        p.purpose === PaymentPurpose.SUBSCRIPTION
          ? p.plan?.name
            ? `Abonnement — ${p.plan.name}`
            : 'Abonnement'
          : p.magazine?.title
            ? `Achat — ${p.magazine.title}${
                p.magazine.issueNumber ? ` #${p.magazine.issueNumber}` : ''
              }`
            : 'Achat magazine';
      const id = `PAYMENT_${ok ? 'SUCCESS' : 'FAILED'}:${p.id}`;
      items.push({
        id,
        kind: ok ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
        title: ok ? 'Paiement confirmé' : 'Paiement échoué',
        body: label,
        href: '/historique',
        coverUrl: null,
        createdAt: p.createdAt,
        unread: isUnread(id, p.createdAt),
      });
    }

    if (subscription) {
      const daysLeft = Math.max(
        0,
        Math.ceil(
          (subscription.expiresAt.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const createdAt = new Date(subscription.expiresAt);
      createdAt.setDate(createdAt.getDate() - 14);
      if (createdAt < subscription.createdAt) {
        createdAt.setTime(subscription.createdAt.getTime());
      }
      const id = `SUBSCRIPTION_EXPIRING:${subscription.id}`;
      items.push({
        id,
        kind: 'SUBSCRIPTION_EXPIRING',
        title: 'Abonnement bientôt expiré',
        body:
          daysLeft <= 1
            ? `Expire demain${subscription.plan?.name ? ` · ${subscription.plan.name}` : ''}`
            : `Expire dans ${daysLeft} jours${
                subscription.plan?.name ? ` · ${subscription.plan.name}` : ''
              }`,
        href: '/abonnement',
        coverUrl: null,
        createdAt,
        unread: isUnread(id, createdAt),
      });
    }

    for (const purchase of purchases) {
      if (!purchase.magazine.isPublished || !purchase.magazine.isActive) {
        continue;
      }
      const id = `PURCHASE_READY:${purchase.id}`;
      items.push({
        id,
        kind: 'PURCHASE_READY',
        title: 'Magazine disponible',
        body: purchase.magazine.issueNumber
          ? `${purchase.magazine.title} · #${purchase.magazine.issueNumber}`
          : purchase.magazine.title,
        href: purchase.magazine.pdfKey
          ? `/lecture/${purchase.magazine.id}`
          : '/mes-achats',
        coverUrl: this.resolveCoverUrl(purchase.magazine.coverKey),
        createdAt: purchase.createdAt,
        unread: isUnread(id, purchase.createdAt),
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }

  async getPaymentHistory(
    subscriberId: string,
    opts: {
      take: number;
      skip: number;
      q?: string;
      status?: string;
      provider?: string;
      purpose?: string;
    } = { take: 10, skip: 0 },
  ) {
    const where: Prisma.PaymentWhereInput = { subscriberId };

    const status = this.parseEnum(opts.status, PaymentStatus);
    if (status) where.status = status;

    const provider = this.parseEnum(opts.provider, PaymentProvider);
    if (provider) where.provider = provider;

    const purpose = this.parseEnum(opts.purpose, PaymentPurpose);
    if (purpose) where.purpose = purpose;

    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { providerRef: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
        { plan: { name: { contains: q, mode: 'insensitive' } } },
        { magazine: { title: { contains: q, mode: 'insensitive' } } },
        {
          magazine: {
            issueNumber: { contains: q, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.take,
        skip: opts.skip,
        include: {
          plan: { select: { name: true } },
          magazine: { select: { title: true, issueNumber: true } },
        },
      }),
    ]);

    return {
      total,
      take: opts.take,
      skip: opts.skip,
      payments: payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        amountCents: p.amountCents,
        currency: p.currency,
        status: p.status,
        purpose: p.purpose,
        providerRef: p.providerRef,
        planName: p.plan?.name ?? null,
        magazineTitle: p.magazine?.title ?? null,
        magazineIssue: p.magazine?.issueNumber ?? null,
        metadata:
          p.metadata &&
          typeof p.metadata === 'object' &&
          !Array.isArray(p.metadata)
            ? (p.metadata as Record<string, unknown>)
            : null,
        label:
          p.purpose === 'SUBSCRIPTION'
            ? p.plan?.name
              ? `Abonnement — ${p.plan.name}`
              : 'Abonnement'
            : p.magazine?.title
              ? `Achat — ${p.magazine.title}${
                  p.magazine.issueNumber
                    ? ` #${p.magazine.issueNumber}`
                    : ''
                }`
              : 'Achat magazine',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  private parseEnum<T extends Record<string, string>>(
    raw: string | undefined,
    enumObj: T,
  ): T[keyof T] | null {
    if (!raw?.trim()) return null;
    const value = raw.trim().toUpperCase();
    const values = Object.values(enumObj) as string[];
    return values.includes(value) ? (value as T[keyof T]) : null;
  }

  async getPurchases(subscriberId: string) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        subscriberId,
        paymentStatus: PaymentStatus.SUCCESS,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        magazine: {
          select: {
            id: true,
            title: true,
            issueNumber: true,
            coverKey: true,
            pdfKey: true,
            publishedAt: true,
            isPublished: true,
            isActive: true,
          },
        },
      },
    });

    return {
      purchases: purchases
        .filter((p) => p.magazine.isPublished && p.magazine.isActive)
        .map((p) => ({
          id: p.id,
          amountCents: p.amountCents,
          currency: p.currency,
          createdAt: p.createdAt,
          magazine: {
            id: p.magazine.id,
            title: p.magazine.title,
            issueNumber: p.magazine.issueNumber,
            coverUrl: this.resolveCoverUrl(p.magazine.coverKey),
            publishedAt: p.magazine.publishedAt,
            readPath: p.magazine.pdfKey ? `/lecture/${p.magazine.id}` : null,
          },
        })),
    };
  }

  private resolveMediaUrl(
    key: string | null,
    legacyFolder: 'covers' | 'articles',
  ): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;

    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (trimmed.includes('/')) {
      return r2 ? `${r2}/${trimmed.replace(/^\//, '')}` : null;
    }

    return `/legacy/${legacyFolder}/${encodeURIComponent(trimmed)}`;
  }

  private resolveCoverUrl(coverKey: string | null): string | null {
    return this.resolveMediaUrl(coverKey, 'covers');
  }
}
