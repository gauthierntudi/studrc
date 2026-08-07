import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActorType,
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { ActivityService } from '../activity/activity.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60_000;

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
  ) {}

  async list(opts: {
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
    from?: string;
    to?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 10, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const where = this.buildWhere(opts);

    const [total, payments, summary] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          subscriber: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarKey: true,
            },
          },
          plan: { select: { id: true, name: true } },
          magazine: {
            select: { id: true, title: true, issueNumber: true },
          },
        },
      }),
      this.summary(),
    ]);

    return {
      total,
      take,
      skip,
      summary,
      items: payments.map((p) => this.toItem(p)),
    };
  }

  async getById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscriber: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarKey: true,
            phone: true,
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
        magazine: {
          select: {
            id: true,
            title: true,
            issueNumber: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    return this.toItem(payment);
  }

  /**
   * Urgence assistance (ex. FlexPaie : débit OK, callback incorrect).
   * SUCCESS → active abo/achat comme un vrai paiement.
   * On ne peut pas rétrograder un paiement déjà SUCCESS.
   * OTP obligatoire (envoyé à l’e-mail admin).
   */
  async requestStatusOtp(
    id: string,
    input: { status: PaymentStatus; note?: string },
    adminId: string,
  ) {
    const payment = await this.assertStatusChangeAllowed(id, input.status);
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin || !admin.isActive) {
      throw new NotFoundException('Admin introuvable');
    }

    if (
      admin.sensitiveActionOtpHash &&
      admin.sensitiveActionOtpExpiresAt &&
      admin.sensitiveActionOtpContext === this.otpContext(id, input.status)
    ) {
      const issuedAt =
        admin.sensitiveActionOtpExpiresAt.getTime() - OTP_TTL_MS;
      const waitMs = OTP_RESEND_COOLDOWN_MS - (Date.now() - issuedAt);
      if (waitMs > 0) {
        throw new BadRequestException(
          `Patientez ${Math.ceil(waitMs / 1000)} s avant de renvoyer un code.`,
        );
      }
    }

    const otp = String(randomInt(100_000, 1_000_000));
    const context = this.otpContext(id, input.status);
    const note = input.note?.trim() ?? '';

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        sensitiveActionOtpHash: this.hashOtp(admin.email, otp, context),
        sensitiveActionOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        sensitiveActionOtpAttempts: 0,
        sensitiveActionOtpContext: context,
      },
    });

    const actionLabel =
      input.status === PaymentStatus.SUCCESS
        ? 'Activer un paiement (marquer payé)'
        : `Modifier le statut d’un paiement → ${input.status}`;
    const detail = [
      `Paiement ${payment.id}`,
      payment.subscriberId ? `abonné ${payment.subscriberId}` : null,
      `${payment.amountCents / 100} ${payment.currency}`,
      note ? `Note : ${note}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await this.mail.sendAdminSensitiveActionOtp({
      to: admin.email,
      name: admin.name,
      otp,
      actionLabel,
      detail,
    });

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.debug(`OTP admin paiement ${id}: ${otp}`);
    }

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId,
      action: 'payment_status_otp_sent',
      entity: 'payment',
      entityId: id,
      meta: { status: input.status },
    });

    return {
      ok: true,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
      maskedEmail: this.maskEmail(admin.email),
    };
  }

  async updateStatus(
    id: string,
    input: { status: PaymentStatus; note?: string; otp: string },
    adminId: string,
  ) {
    const payment = await this.assertStatusChangeAllowed(id, input.status);
    await this.consumeOtp(adminId, id, input.status, input.otp);

    const note = input.note?.trim();

    if (input.status === PaymentStatus.SUCCESS) {
      await this.payments.forceSuccessByAdmin(id, { adminId, note });
      void this.activity.log({
        actorType: ActivityActorType.ADMIN,
        adminId,
        action: 'payment_forced_success',
        entity: 'payment',
        entityId: id,
        meta: {
          previousStatus: payment.status,
          purpose: payment.purpose,
          provider: payment.provider,
          subscriberId: payment.subscriberId,
          otpVerified: true,
          ...(note ? { note } : {}),
        },
      });
      return this.getById(id);
    }

    const prevMeta =
      payment.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};

    await this.prisma.payment.update({
      where: { id },
      data: {
        status: input.status,
        metadata: {
          ...prevMeta,
          adminStatusChange: true,
          adminStatusChangedBy: adminId,
          adminStatusChangedAt: new Date().toISOString(),
          previousStatus: payment.status,
          otpVerified: true,
          ...(note ? { adminStatusNote: note } : {}),
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId,
      action: 'payment_status_updated',
      entity: 'payment',
      entityId: id,
      meta: {
        previousStatus: payment.status,
        status: input.status,
        purpose: payment.purpose,
        provider: payment.provider,
        subscriberId: payment.subscriberId,
        otpVerified: true,
        ...(note ? { note } : {}),
      },
    });

    return this.getById(id);
  }

  private async assertStatusChangeAllowed(
    id: string,
    nextStatus: PaymentStatus,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    if (payment.status === nextStatus) {
      throw new BadRequestException('Ce paiement a déjà ce statut.');
    }

    if (
      payment.status === PaymentStatus.SUCCESS &&
      nextStatus !== PaymentStatus.SUCCESS
    ) {
      throw new BadRequestException(
        'Impossible de rétrograder un paiement déjà marqué payé. Contactez un super-admin si un remboursement est nécessaire.',
      );
    }

    return payment;
  }

  private async consumeOtp(
    adminId: string,
    paymentId: string,
    status: PaymentStatus,
    rawOtp: string,
  ) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin introuvable');

    const context = this.otpContext(paymentId, status);
    if (
      !admin.sensitiveActionOtpHash ||
      !admin.sensitiveActionOtpExpiresAt ||
      admin.sensitiveActionOtpContext !== context
    ) {
      throw new BadRequestException(
        'Demandez d’abord un code OTP pour cette action.',
      );
    }

    if (admin.sensitiveActionOtpExpiresAt.getTime() < Date.now()) {
      await this.clearOtp(adminId);
      throw new BadRequestException('Code OTP expiré. Demandez-en un nouveau.');
    }

    if (admin.sensitiveActionOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await this.clearOtp(adminId);
      throw new BadRequestException(
        'Trop de tentatives. Demandez un nouveau code OTP.',
      );
    }

    const expected = Buffer.from(admin.sensitiveActionOtpHash, 'hex');
    const provided = Buffer.from(
      this.hashOtp(admin.email, rawOtp.trim(), context),
      'hex',
    );
    const valid =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);

    if (!valid) {
      await this.prisma.adminUser.update({
        where: { id: adminId },
        data: { sensitiveActionOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Code OTP incorrect.');
    }

    await this.clearOtp(adminId);
  }

  private otpContext(paymentId: string, status: PaymentStatus) {
    return `payment:${paymentId}:${status}`;
  }

  private hashOtp(email: string, otp: string, context: string) {
    const pepper = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHash('sha256')
      .update(`${email}:${otp}:${context}:${pepper}`)
      .digest('hex');
  }

  private async clearOtp(adminId: string) {
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        sensitiveActionOtpHash: null,
        sensitiveActionOtpExpiresAt: null,
        sensitiveActionOtpAttempts: 0,
        sensitiveActionOtpContext: null,
      },
    });
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }

  private async summary() {
    const [total, success, pending, failed, refunded, volumePaid] =
      await Promise.all([
        this.prisma.payment.count(),
        this.prisma.payment.count({ where: { status: PaymentStatus.SUCCESS } }),
        this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
        this.prisma.payment.count({
          where: {
            status: {
              in: [PaymentStatus.FAILED, PaymentStatus.CANCELLED],
            },
          },
        }),
        this.prisma.payment.count({
          where: { status: PaymentStatus.REFUNDED },
        }),
        this.prisma.payment.aggregate({
          where: { status: PaymentStatus.SUCCESS },
          _sum: { amountCents: true },
        }),
      ]);

    return {
      total,
      success,
      pending,
      failed,
      refunded,
      volumePaidCents: volumePaid._sum.amountCents ?? 0,
    };
  }

  private buildWhere(opts: {
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
    from?: string;
    to?: string;
  }): Prisma.PaymentWhereInput {
    const where: Prisma.PaymentWhereInput = {};

    const status = this.parseEnum(opts.status, PaymentStatus);
    if (status) where.status = status;

    const provider = this.parseEnum(opts.provider, PaymentProvider);
    if (provider) where.provider = provider;

    const purpose = this.parseEnum(opts.purpose, PaymentPurpose);
    if (purpose) where.purpose = purpose;

    const from = this.parseDateStart(opts.from);
    const to = this.parseDateEnd(opts.to);
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { providerRef: { contains: q, mode: 'insensitive' } },
        { plan: { name: { contains: q, mode: 'insensitive' } } },
        { magazine: { title: { contains: q, mode: 'insensitive' } } },
        {
          magazine: {
            issueNumber: { contains: q, mode: 'insensitive' },
          },
        },
        { subscriber: { name: { contains: q, mode: 'insensitive' } } },
        { subscriber: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private parseDateStart(raw?: string): Date | null {
    const parts = this.parseDateParts(raw);
    if (!parts) return null;
    return new Date(Date.UTC(parts.y, parts.m, parts.d, 0, 0, 0, 0));
  }

  private parseDateEnd(raw?: string): Date | null {
    const parts = this.parseDateParts(raw);
    if (!parts) return null;
    return new Date(Date.UTC(parts.y, parts.m, parts.d, 23, 59, 59, 999));
  }

  private parseDateParts(
    raw?: string,
  ): { y: number; m: number; d: number } | null {
    if (!raw?.trim()) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      return null;
    }
    return { y, m, d };
  }

  private toItem(p: {
    id: string;
    provider: PaymentProvider;
    providerRef: string | null;
    amountCents: number;
    currency: string;
    status: PaymentStatus;
    purpose: PaymentPurpose;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
    subscriber: {
      id: string;
      name: string;
      email: string;
      avatarKey: string | null;
      phone?: string | null;
    };
    plan: {
      id: string;
      name: string;
      priceCents?: number;
      currency?: string;
      durationDays?: number;
    } | null;
    magazine: {
      id: string;
      title: string;
      issueNumber: string | null;
    } | null;
  }) {
    return {
      id: p.id,
      provider: p.provider,
      providerRef: p.providerRef,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      purpose: p.purpose,
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
                p.magazine.issueNumber ? ` #${p.magazine.issueNumber}` : ''
              }`
            : 'Achat magazine',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      subscriber: {
        id: p.subscriber.id,
        name: p.subscriber.name,
        email: p.subscriber.email,
        avatarUrl: this.resolveAvatarUrl(p.subscriber.avatarKey),
        ...(p.subscriber.phone !== undefined
          ? { phone: p.subscriber.phone }
          : {}),
      },
      plan: p.plan
        ? {
            id: p.plan.id,
            name: p.plan.name,
            ...(p.plan.priceCents != null
              ? {
                  priceCents: p.plan.priceCents,
                  currency: p.plan.currency,
                  durationDays: p.plan.durationDays,
                }
              : {}),
          }
        : null,
      magazine: p.magazine
        ? {
            id: p.magazine.id,
            title: p.magazine.title,
            issueNumber: p.magazine.issueNumber,
          }
        : null,
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

  private parseEnum<T extends Record<string, string>>(
    raw: string | undefined,
    enumObj: T,
  ): T[keyof T] | null {
    if (!raw?.trim()) return null;
    const value = raw.trim().toUpperCase();
    const values = Object.values(enumObj) as string[];
    return values.includes(value) ? (value as T[keyof T]) : null;
  }
}
