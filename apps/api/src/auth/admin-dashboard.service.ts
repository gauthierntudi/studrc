import { Injectable } from '@nestjs/common';
import {
  PaymentPurpose,
  PaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const since14 = new Date(now);
    since14.setDate(since14.getDate() - 13);
    since14.setHours(0, 0, 0, 0);

    const [
      subscribersCount,
      magazinesCount,
      publishedMagazines,
      activeSubscriptions,
      successPayments,
      pendingPayments,
      articlesCount,
      volumeAgg,
      volume14Agg,
      recentPayments,
      recentSubscribers,
      purposeGroups,
      dayPayments,
    ] = await Promise.all([
      this.prisma.subscriber.count({ where: { isActive: true } }),
      this.prisma.magazine.count(),
      this.prisma.magazine.count({ where: { isPublished: true } }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUCCESS } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.article.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCESS },
        _sum: { amountCents: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: since14 },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.SUCCESS },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          amountCents: true,
          currency: true,
          purpose: true,
          provider: true,
          providerRef: true,
          createdAt: true,
          subscriber: { select: { name: true, email: true } },
        },
      }),
      this.prisma.subscriber.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          isActive: true,
        },
      }),
      this.prisma.payment.groupBy({
        by: ['purpose'],
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: since14 },
        },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCESS,
          createdAt: { gte: since14 },
        },
        select: { amountCents: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const volumeByDay = this.buildVolumeByDay(since14, dayPayments);
    const purposeBreakdown = purposeGroups.map((g) => ({
      purpose: g.purpose,
      count: g._count._all,
      volumeCents: g._sum.amountCents ?? 0,
    }));

    return {
      subscribersCount,
      magazinesCount,
      publishedMagazines,
      activeSubscriptions,
      successPayments,
      pendingPayments,
      articlesCount,
      volumePaidCents: volumeAgg._sum.amountCents ?? 0,
      volume14Cents: volume14Agg._sum.amountCents ?? 0,
      payments14Count: volume14Agg._count,
      charts: {
        volumeByDay,
        purposeBreakdown,
      },
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        currency: p.currency,
        purpose: p.purpose,
        provider: p.provider,
        providerRef: p.providerRef,
        createdAt: p.createdAt,
        subscriberName: p.subscriber.name,
        subscriberEmail: p.subscriber.email,
      })),
      recentSubscribers,
    };
  }

  private buildVolumeByDay(
    since: Date,
    payments: Array<{ amountCents: number; createdAt: Date }>,
  ) {
    const days: Array<{ date: string; volumeCents: number; count: number }> =
      [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, volumeCents: 0, count: 0 });
    }
    const index = new Map(days.map((d, i) => [d.date, i]));
    for (const p of payments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      const i = index.get(key);
      if (i == null) continue;
      days[i]!.volumeCents += p.amountCents;
      days[i]!.count += 1;
    }
    return days;
  }
}

/** Labels FR pour PaymentPurpose */
export const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  SUBSCRIPTION: 'Abonnement',
  PURCHASE: 'Achat magazine',
};
