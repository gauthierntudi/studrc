import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessType,
  ActivityActorType,
  PaymentProvider,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { ActivityService } from '../activity/activity.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
  ) {}

  private getStripe(): Stripe {
    if (this.stripe) return this.stripe;
    const key = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!key) {
      throw new BadRequestException('Stripe non configuré');
    }
    this.stripe = new Stripe(key);
    return this.stripe;
  }

  async getStatus(paymentId: string, subscriberId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, subscriberId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            durationDays: true,
            priceCents: true,
            currency: true,
          },
        },
        magazine: {
          select: {
            id: true,
            title: true,
            issueNumber: true,
            coverKey: true,
            theme: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    return this.toPublicPayment(payment);
  }

  async createStripeCheckout(subscriberId: string, planId: string) {
    const { subscriber, plan } = await this.loadSubscriberAndPlan(
      subscriberId,
      planId,
    );
    const stripe = this.getStripe();

    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProvider.STRIPE,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.SUBSCRIPTION,
        subscriberId: subscriber.id,
        planId: plan.id,
        metadata: { channel: 'elements' },
      },
    });

    const intent = await stripe.paymentIntents.create({
      amount: plan.priceCents,
      currency: plan.currency.toLowerCase(),
      payment_method_types: ['card'],
      receipt_email: subscriber.email,
      description: `Abonnement STUDRC — ${plan.name}`,
      metadata: {
        paymentId: payment.id,
        planId: plan.id,
        subscriberId: subscriber.id,
        purpose: PaymentPurpose.SUBSCRIPTION,
      },
    });

    if (!intent.client_secret) {
      throw new BadRequestException('PaymentIntent Stripe invalide');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: intent.id,
        metadata: {
          channel: 'elements',
          paymentIntentId: intent.id,
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'payment_checkout_started',
      entity: 'payment',
      entityId: payment.id,
      meta: { provider: 'STRIPE', planId: plan.id, channel: 'elements' },
    });

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      publishableKey:
        this.config.get<string>('STRIPE_PUBLISHABLE_KEY')?.trim() ||
        this.config.get<string>('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')?.trim() ||
        null,
    };
  }

  async createStripePurchase(subscriberId: string, magazineId: string) {
    const { subscriber, magazine } = await this.loadSubscriberAndMagazine(
      subscriberId,
      magazineId,
    );
    const stripe = this.getStripe();
    const amountCents = magazine.priceCents!;
    const currency = magazine.currency;

    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProvider.STRIPE,
        amountCents,
        currency,
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.PURCHASE,
        subscriberId: subscriber.id,
        magazineId: magazine.id,
        metadata: { channel: 'elements' },
      },
    });

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      receipt_email: subscriber.email,
      description: `Achat STUDRC — ${magazine.title}`,
      metadata: {
        paymentId: payment.id,
        magazineId: magazine.id,
        subscriberId: subscriber.id,
        purpose: PaymentPurpose.PURCHASE,
      },
    });

    if (!intent.client_secret) {
      throw new BadRequestException('PaymentIntent Stripe invalide');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: intent.id,
        metadata: {
          channel: 'elements',
          paymentIntentId: intent.id,
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'payment_checkout_started',
      entity: 'payment',
      entityId: payment.id,
      meta: {
        provider: 'STRIPE',
        magazineId: magazine.id,
        purpose: 'PURCHASE',
        channel: 'elements',
      },
    });

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      publishableKey:
        this.config.get<string>('STRIPE_PUBLISHABLE_KEY')?.trim() ||
        this.config.get<string>('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')?.trim() ||
        null,
    };
  }

  async confirmStripePayment(
    subscriberId: string,
    paymentId: string,
    opts: { paymentIntentId?: string; sessionId?: string },
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        subscriberId,
        provider: PaymentProvider.STRIPE,
      },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.status === PaymentStatus.SUCCESS) {
      return this.getStatus(paymentId, subscriberId);
    }

    const stripe = this.getStripe();
    const prevMeta =
      typeof payment.metadata === 'object' && payment.metadata
        ? (payment.metadata as Record<string, unknown>)
        : {};

    if (opts.paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(opts.paymentIntentId);
      if (intent.metadata?.paymentId !== payment.id) {
        throw new BadRequestException('PaymentIntent Stripe non concordant');
      }
      if (intent.status !== 'succeeded') {
        return this.getStatus(paymentId, subscriberId);
      }

      await this.markPaymentSuccess(payment.id, {
        providerRef: intent.id,
        metadata: {
          ...prevMeta,
          paymentIntentId: intent.id,
          confirmedVia: 'browser',
        },
      });
      return this.getStatus(paymentId, subscriberId);
    }

    if (opts.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(opts.sessionId);
      if (session.metadata?.paymentId !== payment.id) {
        throw new BadRequestException('Session Stripe non concordante');
      }
      if (session.payment_status !== 'paid') {
        return this.getStatus(paymentId, subscriberId);
      }

      await this.markPaymentSuccess(payment.id, {
        providerRef: session.id,
        metadata: {
          ...prevMeta,
          sessionId: session.id,
          paymentIntent:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : null,
          confirmedVia: 'browser',
        },
      });
      return this.getStatus(paymentId, subscriberId);
    }

    throw new BadRequestException(
      'paymentIntentId ou sessionId requis pour confirmer',
    );
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new BadRequestException('Webhook Stripe non configuré');
    }
    if (!signature) {
      throw new BadRequestException('Signature Stripe manquante');
    }

    const stripe = this.getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(
        `Webhook Stripe invalide: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException('Signature webhook invalide');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        await this.markPaymentSuccess(paymentId, {
          providerRef: intent.id,
          metadata: {
            paymentIntentId: intent.id,
            eventType: event.type,
            confirmedVia: 'webhook',
          },
        });
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (paymentId) {
        await this.markPaymentFailed(paymentId, {
          providerRef: intent.id,
          metadata: {
            paymentIntentId: intent.id,
            eventType: event.type,
            lastError: intent.last_payment_error?.message ?? null,
          },
        });
      }
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (paymentId && session.payment_status === 'paid') {
        await this.markPaymentSuccess(paymentId, {
          providerRef: session.id,
          metadata: {
            sessionId: session.id,
            eventType: event.type,
            confirmedVia: 'webhook',
          },
        });
      }
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (paymentId) {
        await this.markPaymentFailed(paymentId, {
          providerRef: session.id,
          metadata: { eventType: event.type },
        });
      }
    }

    return { received: true };
  }

  async createFlexpaiePayment(
    subscriberId: string,
    planId: string,
    phoneRaw: string,
  ) {
    const { subscriber, plan } = await this.loadSubscriberAndPlan(
      subscriberId,
      planId,
    );
    const phone = this.normalizePhone(phoneRaw);
    const merchant = this.config.get<string>('FLEXPAIE_MERCHANT')?.trim();
    const token = this.config.get<string>('FLEXPAIE_TOKEN')?.trim();
    const apiUrl = this.config.get<string>('FLEXPAIE_MOBILE_API_URL')?.trim();
    const callbackUrl =
      this.config.get<string>('FLEXPAIE_CALLBACK_URL')?.trim() ||
      `${this.config.get<string>('API_URL')?.replace(/\/$/, '')}/api/payments/flexpaie/callback`;

    if (!merchant || !token || !apiUrl) {
      throw new BadRequestException('FlexPaie non configuré');
    }

    const reference = `OPT${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
    const amountMajor = this.centsToMajorAmount(plan.priceCents);

    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProvider.FLEXPAIE,
        providerRef: reference,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.SUBSCRIPTION,
        subscriberId: subscriber.id,
        planId: plan.id,
        metadata: { phone, reference, channel: 'mobile' },
      },
    });

    const body = {
      merchant,
      type: '1',
      phone,
      reference,
      amount: amountMajor,
      currency: plan.currency.toUpperCase(),
      callbackUrl,
    };

    let flexRes: {
      code?: string | number;
      message?: string;
      orderNumber?: string;
    };
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: token.startsWith('Bearer ')
            ? token
            : `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      flexRes = (await res.json()) as typeof flexRes;
      if (!res.ok) {
        throw new Error(flexRes.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            phone,
            reference,
            error: err instanceof Error ? err.message : 'FlexPaie error',
          },
        },
      });
      throw new BadRequestException(
        err instanceof Error
          ? `FlexPaie : ${err.message}`
          : 'Échec initiation FlexPaie',
      );
    }

    const code = String(flexRes.code ?? '');
    if (code !== '0') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            phone,
            reference,
            flex: flexRes,
          },
        },
      });
      throw new BadRequestException(
        flexRes.message || 'FlexPaie a refusé la transaction',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          phone,
          reference,
          orderNumber: flexRes.orderNumber ?? null,
          flex: flexRes,
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'payment_flexpaie_started',
      entity: 'payment',
      entityId: payment.id,
      meta: { planId: plan.id, phone },
    });

    return {
      paymentId: payment.id,
      reference,
      orderNumber: flexRes.orderNumber ?? null,
      message:
        'Validez le paiement sur votre téléphone (USSD / notification Mobile Money).',
    };
  }

  async createFlexpaiePurchase(
    subscriberId: string,
    magazineId: string,
    phoneRaw: string,
  ) {
    const { subscriber, magazine } = await this.loadSubscriberAndMagazine(
      subscriberId,
      magazineId,
    );
    const phone = this.normalizePhone(phoneRaw);
    const merchant = this.config.get<string>('FLEXPAIE_MERCHANT')?.trim();
    const token = this.config.get<string>('FLEXPAIE_TOKEN')?.trim();
    const apiUrl = this.config.get<string>('FLEXPAIE_MOBILE_API_URL')?.trim();
    const callbackUrl =
      this.config.get<string>('FLEXPAIE_CALLBACK_URL')?.trim() ||
      `${this.config.get<string>('API_URL')?.replace(/\/$/, '')}/api/payments/flexpaie/callback`;

    if (!merchant || !token || !apiUrl) {
      throw new BadRequestException('FlexPaie non configuré');
    }

    const amountCents = magazine.priceCents!;
    const currency = magazine.currency;
    const reference = `OPT${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
    const amountMajor = this.centsToMajorAmount(amountCents);

    const payment = await this.prisma.payment.create({
      data: {
        provider: PaymentProvider.FLEXPAIE,
        providerRef: reference,
        amountCents,
        currency,
        status: PaymentStatus.PENDING,
        purpose: PaymentPurpose.PURCHASE,
        subscriberId: subscriber.id,
        magazineId: magazine.id,
        metadata: { phone, reference, channel: 'mobile' },
      },
    });

    const body = {
      merchant,
      type: '1',
      phone,
      reference,
      amount: amountMajor,
      currency: currency.toUpperCase(),
      callbackUrl,
    };

    let flexRes: {
      code?: string | number;
      message?: string;
      orderNumber?: string;
    };
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: token.startsWith('Bearer ')
            ? token
            : `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      flexRes = (await res.json()) as typeof flexRes;
      if (!res.ok) {
        throw new Error(flexRes.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            phone,
            reference,
            error: err instanceof Error ? err.message : 'FlexPaie error',
          },
        },
      });
      throw new BadRequestException(
        err instanceof Error
          ? `FlexPaie : ${err.message}`
          : 'Échec initiation FlexPaie',
      );
    }

    const code = String(flexRes.code ?? '');
    if (code !== '0') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          metadata: {
            phone,
            reference,
            flex: flexRes,
          },
        },
      });
      throw new BadRequestException(
        flexRes.message || 'FlexPaie a refusé la transaction',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: {
          phone,
          reference,
          orderNumber: flexRes.orderNumber ?? null,
          flex: flexRes,
        },
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'payment_flexpaie_started',
      entity: 'payment',
      entityId: payment.id,
      meta: { magazineId: magazine.id, purpose: 'PURCHASE', phone },
    });

    return {
      paymentId: payment.id,
      reference,
      orderNumber: flexRes.orderNumber ?? null,
      message:
        'Validez le paiement sur votre téléphone (USSD / notification Mobile Money).',
    };
  }

  async handleFlexpaieCallback(body: Record<string, unknown>) {
    const nested =
      body.transaction &&
      typeof body.transaction === 'object' &&
      !Array.isArray(body.transaction)
        ? (body.transaction as Record<string, unknown>)
        : {};

    const reference = String(
      body.reference ?? nested.reference ?? '',
    ).trim();
    const orderNumber = String(
      body.orderNumber ?? nested.orderNumber ?? '',
    ).trim();

    let payment =
      reference.length > 0
        ? await this.prisma.payment.findFirst({
            where: {
              provider: PaymentProvider.FLEXPAIE,
              providerRef: reference,
            },
          })
        : null;

    if (!payment && orderNumber) {
      payment = await this.prisma.payment.findFirst({
        where: {
          provider: PaymentProvider.FLEXPAIE,
          status: PaymentStatus.PENDING,
          metadata: {
            path: ['orderNumber'],
            equals: orderNumber,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!payment) {
      this.logger.warn(
        `Callback FlexPaie inconnu (ref=${reference || '—'} order=${orderNumber || '—'})`,
      );
      return { ok: false, matched: false };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return { ok: true, matched: true, status: payment.status };
    }

    /**
     * FlexPaie : le `code` racine = statut de la *requête* (0 = bien reçue),
     * pas forcément le paiement. Le succès réel se lit via :
     * - `provider_reference` (réf opérateur, présent si payé)
     * - ou `transaction.status` === 0
     * Échec : transaction.status === 1 (doc check) / codes d’échec explicites.
     */
    const providerReference = String(
      body.provider_reference ??
        body.providerReference ??
        nested.provider_reference ??
        nested.providerReference ??
        '',
    ).trim();

    const txStatus = String(
      nested.status ?? body.transactionStatus ?? '',
    ).trim();

    const rootCode = String(body.code ?? body.status ?? '').trim();

    const success =
      providerReference.length > 0 ||
      txStatus === '0' ||
      txStatus === '00';

    const failed =
      txStatus === '1' ||
      rootCode.toLowerCase() === 'failed' ||
      rootCode.toLowerCase() === 'fail' ||
      // Échec explicite sans preuve de paiement
      ((rootCode === '1' || rootCode === '2') && !providerReference);

    const metaBase = {
      ...(typeof payment.metadata === 'object' && payment.metadata
        ? (payment.metadata as Record<string, unknown>)
        : {}),
      callback: body,
      confirmedVia: 'webhook',
      webhookAt: new Date().toISOString(),
      providerReference: providerReference || null,
    } as Prisma.InputJsonValue;

    if (success) {
      await this.markPaymentSuccess(payment.id, { metadata: metaBase });
      this.logger.log(`FlexPaie webhook SUCCESS payment=${payment.id}`);
      return { ok: true, matched: true, status: PaymentStatus.SUCCESS };
    }

    if (failed) {
      await this.markPaymentFailed(payment.id, { metadata: metaBase });
      this.logger.log(`FlexPaie webhook FAILED payment=${payment.id}`);
      return { ok: true, matched: true, status: PaymentStatus.FAILED };
    }

    // Ack / pending (ex. code racine 0 sans provider_reference) → rester PENDING.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { metadata: metaBase },
    });
    this.logger.log(
      `FlexPaie webhook pending payment=${payment.id} rootCode=${rootCode || '∅'} txStatus=${txStatus || '∅'}`,
    );
    return { ok: true, matched: true, status: PaymentStatus.PENDING };
  }

  /** Polling / check FlexPaie — secours si le webhook n’a pas encore abouti. */
  async checkFlexpaieStatus(paymentId: string, subscriberId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        subscriberId,
        provider: PaymentProvider.FLEXPAIE,
      },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.CANCELLED
    ) {
      return this.getStatus(paymentId, subscriberId);
    }

    const checkUrl = this.config.get<string>('FLEXPAIE_CHECK_API_URL')?.trim();
    const token = this.config.get<string>('FLEXPAIE_TOKEN')?.trim();
    const meta = (payment.metadata ?? {}) as { orderNumber?: string };
    const orderNumber = meta.orderNumber;
    if (!checkUrl || !token || !orderNumber) {
      return this.getStatus(paymentId, subscriberId);
    }

    try {
      const res = await fetch(
        `${checkUrl}/${encodeURIComponent(orderNumber)}`,
        {
          headers: {
            Authorization: token.startsWith('Bearer ')
              ? token
              : `Bearer ${token}`,
          },
        },
      );
      const data = (await res.json()) as {
        code?: string | number;
        message?: string;
        transaction?: {
          status?: string | number;
          code?: string | number;
          provider_reference?: string;
          providerReference?: string;
        };
      };

      // `code` racine = OK de la requête check, PAS le paiement.
      const tx = data.transaction;
      if (!tx) {
        return this.getStatus(paymentId, subscriberId);
      }

      const txStatus = String(tx.status ?? '').trim();
      const providerReference = String(
        tx.provider_reference ?? tx.providerReference ?? '',
      ).trim();

      if (providerReference || txStatus === '0' || txStatus === '00') {
        await this.markPaymentSuccess(payment.id, {
          metadata: {
            ...(typeof payment.metadata === 'object' && payment.metadata
              ? (payment.metadata as Record<string, unknown>)
              : {}),
            check: data,
            confirmedVia: 'check',
            providerReference: providerReference || null,
          } as Prisma.InputJsonValue,
        });
      } else if (txStatus === '1') {
        // Doc FlexPaie check : status 1 = transaction failed
        await this.markPaymentFailed(payment.id, {
          metadata: {
            ...(typeof payment.metadata === 'object' && payment.metadata
              ? (payment.metadata as Record<string, unknown>)
              : {}),
            check: data,
            confirmedVia: 'check',
          } as Prisma.InputJsonValue,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Check FlexPaie échoué: ${err instanceof Error ? err.message : err}`,
      );
    }

    return this.getStatus(paymentId, subscriberId);
  }

  private async loadSubscriberAndPlan(subscriberId: string, planId: string) {
    const [subscriber, plan] = await Promise.all([
      this.prisma.subscriber.findFirst({
        where: { id: subscriberId, isActive: true },
      }),
      this.prisma.plan.findFirst({
        where: { id: planId, isActive: true },
      }),
    ]);
    if (!subscriber) throw new NotFoundException('Compte introuvable');
    if (!plan) throw new NotFoundException('Formule indisponible');
    return { subscriber, plan };
  }

  private async loadSubscriberAndMagazine(
    subscriberId: string,
    magazineId: string,
  ) {
    const [subscriber, magazine, existing] = await Promise.all([
      this.prisma.subscriber.findFirst({
        where: { id: subscriberId, isActive: true },
      }),
      this.prisma.magazine.findFirst({
        where: {
          id: magazineId,
          isPublished: true,
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          issueNumber: true,
          accessType: true,
          priceCents: true,
          currency: true,
        },
      }),
      this.prisma.purchase.findFirst({
        where: {
          subscriberId,
          magazineId,
          paymentStatus: PaymentStatus.SUCCESS,
        },
        select: { id: true },
      }),
    ]);
    if (!subscriber) throw new NotFoundException('Compte introuvable');
    if (!magazine) throw new NotFoundException('Magazine introuvable');
    if (magazine.accessType !== AccessType.PAID) {
      throw new BadRequestException('Ce numéro n’est pas en vente unitaire');
    }
    if (!magazine.priceCents || magazine.priceCents <= 0) {
      throw new BadRequestException('Prix du magazine non configuré');
    }
    if (existing) {
      throw new ConflictException('Vous avez déjà acheté ce numéro');
    }
    return { subscriber, magazine };
  }

  /**
   * Activation manuelle (assistance) : même effet qu’un webhook SUCCESS
   * (abonnement / achat + email + log).
   */
  async forceSuccessByAdmin(
    paymentId: string,
    opts: { adminId: string; note?: string },
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return;
    }

    const prevMeta =
      payment.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};

    const note = opts.note?.trim();
    await this.markPaymentSuccess(paymentId, {
      metadata: {
        ...prevMeta,
        adminForced: true,
        adminForcedBy: opts.adminId,
        adminForcedAt: new Date().toISOString(),
        previousStatus: payment.status,
        ...(note ? { adminForceNote: note } : {}),
      },
    });
  }

  private async markPaymentSuccess(
    paymentId: string,
    patch: {
      providerRef?: string;
      metadata?: Prisma.InputJsonValue;
    } = {},
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        plan: true,
        magazine: {
          select: {
            id: true,
            title: true,
            issueNumber: true,
          },
        },
        subscriber: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!payment) return;
    if (payment.status === PaymentStatus.SUCCESS) return;

    const providerRef = patch.providerRef ?? payment.providerRef;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCESS,
        ...(patch.providerRef ? { providerRef: patch.providerRef } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      },
    });

    if (
      payment.purpose === PaymentPurpose.SUBSCRIPTION &&
      payment.planId &&
      payment.plan
    ) {
      await this.activateSubscription({
        ...payment,
        providerRef,
      });
    }

    if (
      payment.purpose === PaymentPurpose.PURCHASE &&
      payment.magazineId
    ) {
      await this.activatePurchase({
        id: payment.id,
        subscriberId: payment.subscriberId,
        magazineId: payment.magazineId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        providerRef,
      });
    }

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: payment.subscriberId,
      action: 'payment_succeeded',
      entity: 'payment',
      entityId: payment.id,
      meta: {
        provider: payment.provider,
        purpose: payment.purpose,
        planId: payment.planId,
        magazineId: payment.magazineId,
        amountCents: payment.amountCents,
      },
    });

    void this.sendPaymentSuccessEmail(payment);
  }

  private async sendPaymentSuccessEmail(payment: {
    purpose: PaymentPurpose;
    amountCents: number;
    currency: string;
    provider: PaymentProvider;
    magazineId: string | null;
    magazine: { id: string; title: string; issueNumber: string | null } | null;
    plan: { name: string; durationDays: number } | null;
    subscriber: { name: string; email: string } | null;
  }) {
    const subscriber = payment.subscriber;
    if (!subscriber?.email) return;

    const providerLabel =
      payment.provider === PaymentProvider.STRIPE
        ? 'Carte bancaire'
        : payment.provider === PaymentProvider.FLEXPAIE
          ? 'Mobile Money'
          : 'Paiement';

    const appUrl = (
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');

    try {
      if (
        payment.purpose === PaymentPurpose.PURCHASE &&
        payment.magazine
      ) {
        await this.mail.sendPaymentConfirmation({
          to: subscriber.email,
          name: subscriber.name,
          purpose: 'PURCHASE',
          amountCents: payment.amountCents,
          currency: payment.currency,
          providerLabel,
          productLabel: payment.magazine.title,
          issueNumber: payment.magazine.issueNumber,
          actionUrl: `${appUrl}/lecture/${encodeURIComponent(payment.magazine.id)}`,
          actionLabel: 'Lire le numéro',
        });
        return;
      }

      if (
        payment.purpose === PaymentPurpose.SUBSCRIPTION &&
        payment.plan
      ) {
        await this.mail.sendPaymentConfirmation({
          to: subscriber.email,
          name: subscriber.name,
          purpose: 'SUBSCRIPTION',
          amountCents: payment.amountCents,
          currency: payment.currency,
          providerLabel,
          productLabel: payment.plan.name,
          actionUrl: `${appUrl}/magazines`,
          actionLabel: 'Lire mes magazines',
        });
      }
    } catch (err) {
      this.logger.warn(
        `Email confirmation paiement non envoyé: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async markPaymentFailed(
    paymentId: string,
    patch: { providerRef?: string; metadata?: Prisma.InputJsonValue } = {},
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status === PaymentStatus.SUCCESS) return;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        ...(patch.providerRef ? { providerRef: patch.providerRef } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      },
    });
  }

  private async activateSubscription(payment: {
    id: string;
    subscriberId: string;
    planId: string | null;
    providerRef: string | null;
    plan: { durationDays: number } | null;
  }) {
    if (!payment.planId || !payment.plan) return;

    const now = new Date();
    const active = await this.prisma.subscription.findFirst({
      where: {
        subscriberId: payment.subscriberId,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.SUCCESS,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
    });

    const startsAt = active && active.expiresAt > now ? active.expiresAt : now;
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + payment.plan.durationDays);

    if (active) {
      await this.prisma.subscription.update({
        where: { id: active.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    }

    await this.prisma.subscription.create({
      data: {
        subscriberId: payment.subscriberId,
        planId: payment.planId,
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.SUCCESS,
        transactionRef: payment.providerRef || payment.id,
        startsAt,
        expiresAt,
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: payment.subscriberId,
      action: 'subscription_activated',
      entity: 'subscription',
      entityId: payment.planId,
      meta: {
        paymentId: payment.id,
        startsAt: startsAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  private async activatePurchase(payment: {
    id: string;
    subscriberId: string;
    magazineId: string;
    amountCents: number;
    currency: string;
    providerRef: string | null;
  }) {
    await this.prisma.purchase.upsert({
      where: {
        subscriberId_magazineId: {
          subscriberId: payment.subscriberId,
          magazineId: payment.magazineId,
        },
      },
      create: {
        subscriberId: payment.subscriberId,
        magazineId: payment.magazineId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        paymentStatus: PaymentStatus.SUCCESS,
        transactionRef: payment.providerRef || payment.id,
      },
      update: {
        amountCents: payment.amountCents,
        currency: payment.currency,
        paymentStatus: PaymentStatus.SUCCESS,
        transactionRef: payment.providerRef || payment.id,
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: payment.subscriberId,
      action: 'purchase_activated',
      entity: 'purchase',
      entityId: payment.magazineId,
      meta: {
        paymentId: payment.id,
        magazineId: payment.magazineId,
        amountCents: payment.amountCents,
      },
    });
  }

  private normalizePhone(raw: string): string {
    let digits = raw.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (digits.startsWith('0') && digits.length === 10) {
      digits = `243${digits.slice(1)}`;
    }
    if (!digits.startsWith('243') && digits.length === 9) {
      digits = `243${digits}`;
    }
    if (!/^243\d{9}$/.test(digits)) {
      throw new BadRequestException(
        'Indiquez un numéro RDC valide (ex. 2438XXXXXXXX)',
      );
    }
    return digits;
  }

  private centsToMajorAmount(cents: number): string {
    const major = cents / 100;
    return Number.isInteger(major) ? String(major) : major.toFixed(2);
  }

  private toPublicPayment(payment: {
    id: string;
    provider: PaymentProvider;
    providerRef: string | null;
    amountCents: number;
    currency: string;
    status: PaymentStatus;
    purpose: PaymentPurpose;
    planId: string | null;
    magazineId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    plan: {
      id: string;
      name: string;
      durationDays: number;
      priceCents: number;
      currency: string;
    } | null;
    magazine?: {
      id: string;
      title: string;
      issueNumber: string | null;
      coverKey: string | null;
      theme?: Prisma.JsonValue | null;
    } | null;
  }) {
    const theme = this.parseTheme(payment.magazine?.theme ?? null);
    return {
      id: payment.id,
      provider: payment.provider,
      providerRef: payment.providerRef,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      purpose: payment.purpose,
      planId: payment.planId,
      plan: payment.plan,
      magazineId: payment.magazineId ?? null,
      magazine: payment.magazine
        ? {
            id: payment.magazine.id,
            title: payment.magazine.title,
            issueNumber: payment.magazine.issueNumber,
            coverUrl: this.resolveCoverUrl(payment.magazine.coverKey),
            theme,
          }
        : null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
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
}
