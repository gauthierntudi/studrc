import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const NAVY = '#00132b';
const GOLD = '#fdbd01';
const INK = '#111111';
const MUTED = '#5c6b7a';
const LINE = '#e6e6e6';
const PAGE = '#f4f5f7';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      this.config.get<string>('MAIL_FROM') ?? 'STUDRC <noreply@studrc.com>';
    this.appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    if (this.resend && apiKey) {
      this.logger.log(
        `Resend prêt · from=${this.from} · clé …${apiKey.slice(-4)}`,
      );
    } else {
      this.logger.warn('RESEND_API_KEY absente — aucun e-mail ne partira');
    }
  }

  async sendVerifyEmail(to: string, name: string, token: string) {
    const url = `${this.appUrl.replace(/\/$/, '')}/verifier-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Confirmez votre adresse e-mail — STUDRC',
      html: wrapTransactionalMail({
        appUrl: this.appUrl,
        title: 'Confirmez votre adresse',
        preheader: 'Un clic pour activer votre compte STUDRC.',
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK};">Bonjour ${escapeHtml(name)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">
            Merci de votre inscription. Confirmez
            <strong style="color:${INK};">${escapeHtml(to)}</strong>
            pour sécuriser votre compte.
          </p>
          ${mailButton(url, 'Confirmer mon e-mail')}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">
            Ce lien expire dans <strong style="color:${INK};">24 heures</strong>.
            Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.
          </p>
          ${mailFallbackLink(url)}
        `,
      }),
    });
  }

  async sendPasswordResetOtp(to: string, name: string, otp: string) {
    await this.send({
      to,
      subject: 'Code de réinitialisation — STUDRC',
      html: wrapTransactionalMail({
        appUrl: this.appUrl,
        title: 'Réinitialiser le mot de passe',
        preheader: 'Votre code STUDRC expire dans 15 minutes.',
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK};">Bonjour ${escapeHtml(name)},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${MUTED};">
            Voici le code pour choisir un nouveau mot de passe :
          </p>
          ${mailCode(otp)}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">
            Ce code expire dans <strong style="color:${INK};">15 minutes</strong>.
            Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.
          </p>
        `,
      }),
    });
  }

  async sendAdminSensitiveActionOtp(input: {
    to: string;
    name: string;
    otp: string;
    actionLabel: string;
    detail?: string;
  }) {
    await this.send({
      to: input.to,
      subject: 'Code de confirmation admin — STUDRC',
      html: wrapTransactionalMail({
        appUrl: this.appUrl,
        title: 'Action admin à confirmer',
        preheader: `Code pour : ${input.actionLabel}`,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK};">Bonjour ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${MUTED};">
            Une action sensible a été demandée :
            <strong style="color:${INK};">${escapeHtml(input.actionLabel)}</strong>.
          </p>
          ${
            input.detail
              ? `<p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:${MUTED};">${escapeHtml(input.detail)}</p>`
              : ''
          }
          ${mailCode(input.otp)}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">
            Ce code expire dans <strong style="color:${INK};">10 minutes</strong>.
            Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.
          </p>
        `,
      }),
    });
  }

  async sendNewsletterWelcome(to: string) {
    const homeUrl = this.appUrl.replace(/\/$/, '');
    await this.send({
      to,
      subject: 'Bienvenue dans la newsletter STUDRC',
      html: wrapTransactionalMail({
        appUrl: this.appUrl,
        title: 'Inscription confirmée',
        preheader: 'Vous recevrez les actualités STUDRC dans votre boîte mail.',
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK};">Bonjour,</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${MUTED};">
            Merci de vous être inscrit avec
            <strong style="color:${INK};">${escapeHtml(to)}</strong>.
          </p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">
            Vous recevrez nos actualités, analyses et coups de projecteur sur l’école en RDC.
          </p>
          ${mailButton(homeUrl, 'Lire STUDRC')}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:${MUTED};">
            Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.
          </p>
        `,
      }),
    });
  }

  async sendPaymentConfirmation(input: {
    to: string;
    name: string;
    purpose: 'PURCHASE' | 'SUBSCRIPTION';
    amountCents: number;
    currency: string;
    providerLabel: string;
    productLabel: string;
    issueNumber?: string | null;
    actionUrl: string;
    actionLabel: string;
  }) {
    const amount = formatMoney(input.amountCents, input.currency);
    const product =
      input.purpose === 'PURCHASE' && input.issueNumber
        ? `${input.productLabel} · N° ${input.issueNumber}`
        : input.productLabel;

    const subject =
      input.purpose === 'PURCHASE'
        ? `Paiement confirmé — ${input.productLabel} — STUDRC`
        : `Abonnement activé — ${input.productLabel} — STUDRC`;

    const intro =
      input.purpose === 'PURCHASE'
        ? 'Votre paiement a bien été reçu. Ce numéro est disponible dans votre bibliothèque.'
        : 'Votre paiement a bien été reçu. Votre abonnement est maintenant actif.';

    await this.send({
      to: input.to,
      subject,
      html: wrapTransactionalMail({
        appUrl: this.appUrl,
        title:
          input.purpose === 'PURCHASE'
            ? 'Paiement confirmé'
            : 'Abonnement activé',
        preheader: intro,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:${INK};">Bonjour ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${escapeHtml(intro)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px;font-size:14px;">
            <tr>
              <td style="padding:10px 0;color:${MUTED};border-bottom:1px solid ${LINE};">Produit</td>
              <td style="padding:10px 0;text-align:right;font-weight:700;color:${NAVY};border-bottom:1px solid ${LINE};">${escapeHtml(product)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:${MUTED};border-bottom:1px solid ${LINE};">Montant</td>
              <td style="padding:10px 0;text-align:right;font-weight:700;color:${NAVY};border-bottom:1px solid ${LINE};">${escapeHtml(amount)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:${MUTED};">Moyen</td>
              <td style="padding:10px 0;text-align:right;font-weight:700;color:${NAVY};">${escapeHtml(input.providerLabel)}</td>
            </tr>
          </table>
          ${mailButton(input.actionUrl, input.actionLabel)}
          ${mailFallbackLink(input.actionUrl)}
        `,
      }),
    });
  }

  async sendRaw(input: { to: string; subject: string; html: string }) {
    await this.send(input);
  }

  wrap(input: { title: string; preheader?: string; bodyHtml: string }) {
    return wrapTransactionalMail({
      appUrl: this.appUrl,
      ...input,
    });
  }

  private async send(input: { to: string; subject: string; html: string }) {
    if (!this.resend) {
      this.logger.error(
        `RESEND_API_KEY manquant — email non envoyé à ${input.to}: ${input.subject}`,
      );
      throw new Error(
        'Envoi e-mail indisponible (RESEND_API_KEY manquant). Contactez un administrateur.',
      );
    }

    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      if (result.error) {
        this.logger.error(`Resend error: ${result.error.message}`);
        const hint = /domain is not verified/i.test(result.error.message)
          ? ' La clé chargée par Nest n’est pas celle du compte où studrc.com est Verified (souvent .env racine ≠ apps/api/.env).'
          : '';
        throw new Error(
          `Échec envoi e-mail (${result.error.message}).${hint} Vérifiez RESEND_API_KEY / MAIL_FROM.`,
        );
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith('Échec envoi e-mail')
      ) {
        throw err;
      }
      this.logger.error(
        `Échec envoi email à ${input.to}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new Error(
        'Échec envoi e-mail. Réessayez plus tard ou contactez un administrateur.',
      );
    }
  }
}

export function wrapTransactionalMail(input: {
  appUrl: string;
  title: string;
  preheader?: string;
  bodyHtml: string;
}): string {
  const home = input.appUrl.replace(/\/$/, '') || 'https://studrc.com';
  const pre = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  ${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${LINE};">
          <tr>
            <td style="background:${NAVY};padding:22px 28px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:${GOLD};">STUDRC</p>
              <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:rgba(255,255,255,0.72);">Média et observatoire de l’école en RDC</p>
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 18px;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:${NAVY};">${escapeHtml(input.title)}</h1>
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
              <p style="margin:0;padding-top:16px;border-top:1px solid ${LINE};">
                STUDRC · 8 Avenue Kalemie, Kinshasa-Gombe<br />
                <a href="${escapeHtml(home)}" style="color:${NAVY};text-decoration:underline;">${escapeHtml(home.replace(/^https?:\/\//, ''))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function mailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
    <tr>
      <td style="border-radius:10px;background:${GOLD};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${NAVY};text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function mailCode(otp: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
    <tr>
      <td align="center" style="background:${NAVY};padding:18px 12px;">
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0.28em;color:${GOLD};">${escapeHtml(otp)}</p>
      </td>
    </tr>
  </table>`;
}

function mailFallbackLink(url: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
    Bouton inactif ? Ouvrez ce lien :<br />
    <a href="${escapeHtml(url)}" style="color:${NAVY};">${escapeHtml(url)}</a>
  </p>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
