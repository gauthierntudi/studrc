import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  SOCIAL_NETWORKS,
  type SocialNetwork,
  type UpdateSiteSettingsDto,
} from './dto/update-site-settings.dto';

export type SocialLink = {
  id: string;
  network: SocialNetwork;
  label: string;
  url: string;
};

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  facebook: 'Facebook',
  twitter: 'X / Twitter',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  threads: 'Threads',
  other: 'Autre',
};

const DEFAULT_LINKS: SocialLink[] = [
  {
    id: 'fb-default',
    network: 'facebook',
    label: 'Facebook',
    url: 'https://web.facebook.com/Opt1mumMag',
  },
  {
    id: 'x-default',
    network: 'twitter',
    label: 'X / Twitter',
    url: 'https://twitter.com/OptimumCorp',
  },
  {
    id: 'ig-default',
    network: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/',
  },
  {
    id: 'li-default',
    network: 'linkedin',
    label: 'LinkedIn',
    url: 'https://www.linkedin.com/',
  },
];

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSocial() {
    const row = await this.ensureRow();
    return this.toPublic(row);
  }

  async updateSocial(dto: UpdateSiteSettingsDto) {
    await this.ensureRow();
    const links = this.normalizeLinks(dto.links ?? []);
    const row = await this.prisma.siteSettings.update({
      where: { id: 'default' },
      data: { socialLinks: links as unknown as Prisma.InputJsonValue },
    });
    return this.toPublic(row);
  }

  private async ensureRow() {
    const existing = await this.prisma.siteSettings.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;
    return this.prisma.siteSettings.create({
      data: {
        id: 'default',
        socialLinks: DEFAULT_LINKS as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private normalizeLinks(
    raw: UpdateSiteSettingsDto['links'],
  ): SocialLink[] {
    const out: SocialLink[] = [];
    const seen = new Set<string>();

    for (const item of raw) {
      const network = item.network;
      if (!SOCIAL_NETWORKS.includes(network)) {
        throw new BadRequestException(`Réseau inconnu: ${network}`);
      }
      const url = item.url.trim();
      if (!url) continue;

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new BadRequestException(`URL invalide: ${url}`);
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException(`URL invalide: ${url}`);
      }

      const label =
        network === 'other'
          ? item.label?.trim() || 'Lien'
          : NETWORK_LABELS[network];

      const id =
        item.id?.trim() ||
        `${network}-${randomBytes(4).toString('hex')}`;

      if (seen.has(id)) continue;
      seen.add(id);

      out.push({ id, network, label, url: parsed.toString() });
    }

    return out;
  }

  private toPublic(row: { socialLinks: Prisma.JsonValue; updatedAt: Date }) {
    return {
      links: this.parseLinks(row.socialLinks),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private parseLinks(value: Prisma.JsonValue): SocialLink[] {
    if (!Array.isArray(value)) return [];
    const out: SocialLink[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      const network = String(rec.network ?? '');
      const url = String(rec.url ?? '').trim();
      if (!SOCIAL_NETWORKS.includes(network as SocialNetwork) || !url) {
        continue;
      }
      const label =
        typeof rec.label === 'string' && rec.label.trim()
          ? rec.label.trim()
          : NETWORK_LABELS[network as SocialNetwork];
      const id =
        typeof rec.id === 'string' && rec.id.trim()
          ? rec.id.trim()
          : `${network}-${randomBytes(3).toString('hex')}`;
      out.push({
        id,
        network: network as SocialNetwork,
        label,
        url,
      });
    }
    return out;
  }
}
