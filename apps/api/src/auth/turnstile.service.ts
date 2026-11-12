import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vérifie les tokens Cloudflare Turnstile (siteverify).
 * Activé seulement si CAPTCHA=true et TURNSTILE_SECRET_KEY est défini.
 * Désactivé en local (`NODE_ENV=development`).
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
    if (process.env.NODE_ENV === 'development') return false;
    if (!this.flagOn(this.config.get<string>('CAPTCHA'))) return false;
    return Boolean(this.config.get<string>('TURNSTILE_SECRET_KEY')?.trim());
  }

  /**
   * Requêtes de l’app mobile (Dio : User-Agent « Dart/… », ou en-tête
   * X-StuDRC-Client: mobile). Turnstile en WebView échoue sur certains
   * appareils et réseaux (refus App Store 2.1), l’app n’en envoie donc plus :
   * ces routes restent limitées par le ThrottlerGuard.
   */
  static isMobileClient(headers?: Record<string, unknown>): boolean {
    if (!headers) return false;
    const client = String(headers['x-studrc-client'] ?? '').toLowerCase();
    if (client === 'mobile') return true;
    const ua = String(headers['user-agent'] ?? '');
    return /^Dart\//.test(ua);
  }

  async assertValid(
    token: string | undefined | null,
    ip?: string | null,
    headers?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isEnabled()) return;
    if (TurnstileService.isMobileClient(headers)) return;

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
