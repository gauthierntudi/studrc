import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vérifie les tokens Cloudflare Turnstile (siteverify).
 * Activé seulement si CAPTCHA=true et TURNSTILE_SECRET_KEY est défini.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  private flagOn(value: string | undefined | null): boolean {
    const v = value?.trim().toLowerCase() ?? '';
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }

  isEnabled(): boolean {
    if (!this.flagOn(this.config.get<string>('CAPTCHA'))) return false;
    return Boolean(this.config.get<string>('TURNSTILE_SECRET_KEY')?.trim());
  }

  async assertValid(
    token: string | undefined | null,
    ip?: string | null,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY')!.trim();
    const response = token?.trim() ?? '';
    if (!response) {
      throw new BadRequestException('Vérification anti-bot requise');
    }

    const body = new URLSearchParams({
      secret,
      response,
    });
    if (ip?.trim()) {
      body.set('remoteip', ip.trim());
    }

    let data: { success?: boolean; 'error-codes'?: string[] };
    try {
      const res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );
      data = (await res.json()) as typeof data;
    } catch (err) {
      this.logger.warn(`Turnstile siteverify network error: ${String(err)}`);
      throw new BadRequestException('Vérification anti-bot indisponible');
    }

    if (!data.success) {
      this.logger.debug(
        `Turnstile rejected: ${(data['error-codes'] ?? []).join(',')}`,
      );
      throw new BadRequestException('Vérification anti-bot échouée');
    }
  }
}
