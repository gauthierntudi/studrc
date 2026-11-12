import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from '../auth/turnstile.service';
import { SettingsService } from './settings.service';

@Controller('settings')
export class PublicSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Get('social')
  social() {
    return this.settings.getSocial();
  }

  /** Config publique pour l’app mobile (captcha, API). */
  @Get('app')
  app() {
    // L’app mobile n’affiche plus Turnstile (WebView peu fiable, refus App
    // Store 2.1) : l’API l’exempte (TurnstileService.isMobileClient).
    const captcha = false;
    const siteKey =
      this.config.get<string>('TURNSTILE_SITE_KEY')?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_TURNSTILE_SITE_KEY')?.trim() ||
      '';
    const googleClientId =
      this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_GOOGLE_CLIENT_ID')?.trim() ||
      '';
    const googleIosClientId =
      this.config.get<string>('GOOGLE_IOS_CLIENT_ID')?.trim() || '';
    return {
      api: 'https://api.studrc.com/api',
      captcha,
      turnstileSiteKey: captcha ? siteKey : '',
      googleClientId,
      googleIosClientId,
    };
  }
}
