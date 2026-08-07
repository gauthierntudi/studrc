import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

@Injectable()
export class NewsletterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException(
        'Vous devez accepter les termes et conditions.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const source = (dto.source ?? 'home').trim().slice(0, 64) || 'home';

    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (existing?.isActive) {
      return {
        ok: true as const,
        alreadySubscribed: true as const,
        message: 'Cette adresse est déjà inscrite à la newsletter.',
      };
    }

    if (existing && !existing.isActive) {
      await this.prisma.newsletterSubscription.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          acceptedTerms: true,
          source,
          unsubscribedAt: null,
        },
      });
      void this.mail.sendNewsletterWelcome(email);
      return {
        ok: true as const,
        alreadySubscribed: false as const,
        message: 'Votre inscription a bien été réactivée.',
      };
    }

    await this.prisma.newsletterSubscription.create({
      data: {
        email,
        acceptedTerms: true,
        source,
        isActive: true,
      },
    });

    void this.mail.sendNewsletterWelcome(email);

    return {
      ok: true as const,
      alreadySubscribed: false as const,
      message: 'Merci — votre inscription a bien été prise en compte.',
    };
  }

  async list(opts: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 20, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const q = opts.q?.trim();

    const where = {
      ...(opts.active === '1'
        ? { isActive: true }
        : opts.active === '0'
          ? { isActive: false }
          : {}),
      ...(q
        ? {
            email: { contains: q, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [total, activeCount, items] = await this.prisma.$transaction([
      this.prisma.newsletterSubscription.count({ where }),
      this.prisma.newsletterSubscription.count({ where: { isActive: true } }),
      this.prisma.newsletterSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          email: true,
          isActive: true,
          source: true,
          acceptedTerms: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
      })),
      total,
      take,
      skip,
      summary: {
        total,
        active: activeCount,
      },
    };
  }

  async setActive(id: string, isActive: boolean) {
    const row = await this.prisma.newsletterSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Inscription introuvable');

    const updated = await this.prisma.newsletterSubscription.update({
      where: { id },
      data: {
        isActive,
        unsubscribedAt: isActive ? null : new Date(),
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      isActive: updated.isActive,
      unsubscribedAt: updated.unsubscribedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
