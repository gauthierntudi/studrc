import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      this.config.get<string>('MAIL_FROM') ?? 'STUDRC <noreply@studrc.com>';
    this.appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  async sendVerifyEmail(to: string, name: string, token: string) {
    const url = `${this.appUrl.replace(/\/$/, '')}/verifier-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Confirmez votre adresse e-mail — STUDRC',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5;">
          <div style="padding:20px 0 8px;border-bottom:3px solid #e9262a;">
            <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#e9262a;">STUDRC</p>
          </div>
          <p style="margin:1.35rem 0 0.75rem;font-size:22px;font-weight:800;line-height:1.2;">Confirmez votre adresse e-mail</p>
          <p style="margin:0 0 1rem;">Bonjour ${escapeHtml(name)},</p>
          <p style="margin:0 0 1rem;color:#444;">
            Merci de votre inscription. Pour sécuriser votre compte et activer
            toutes les fonctionnalités, confirmez votre adresse
            <strong>${escapeHtml(to)}</strong>.
          </p>
          <p style="margin:1.5rem 0;">
            <a href="${escapeHtml(url)}"
               style="display:inline-block;padding:13px 22px;background:#e9262a;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;">
              Confirmer mon e-mail
            </a>
          </p>
          <p style="margin:0 0 0.75rem;color:#666;font-size:13px;">
            Ce lien expire dans <strong>24 heures</strong>. Si vous n’êtes pas à
            l’origine de cette inscription, ignorez cet e-mail.
          </p>
          <p style="margin:0 0 1.25rem;color:#888;font-size:12px;word-break:break-all;">
            Bouton inactif ? Ouvrez ce lien :<br />
            <a href="${escapeHtml(url)}" style="color:#e9262a;">${escapeHtml(url)}</a>
          </p>
          <p style="margin:0;padding-top:1rem;border-top:1px solid #eee;color:#666;font-size:13px;">— L’équipe STUDRC</p>
        </div>
      `,
    });
  }

  async sendPasswordResetOtp(to: string, name: string, otp: string) {
    await this.send({
      to,
      subject: 'Code de réinitialisation — STUDRC',
      html: `
        <p>Bonjour ${escapeHtml(name)},</p>
        <p>Votre code de réinitialisation de mot de passe est :</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace;">${escapeHtml(otp)}</p>
        <p>Ce code expire dans 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet email.</p>
        <p>— L’équipe STUDRC</p>
      `,
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
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5;">
          <p style="margin:0 0 0.75rem;">Bonjour ${escapeHtml(input.name)},</p>
          <p style="margin:0 0 0.75rem;">
            Une action sensible a été demandée sur l’admin STUDRC :
            <strong>${escapeHtml(input.actionLabel)}</strong>.
          </p>
          ${
            input.detail
              ? `<p style="margin:0 0 0.75rem;color:#444;">${escapeHtml(input.detail)}</p>`
              : ''
          }
          <p style="margin:0 0 0.5rem;">Votre code de confirmation :</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace;margin:0 0 1rem;">${escapeHtml(input.otp)}</p>
          <p style="margin:0 0 0.75rem;color:#666;font-size:13px;">
            Ce code expire dans <strong>10 minutes</strong>. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail et contactez un super-admin.
          </p>
          <p style="margin:0;color:#666;font-size:13px;">— L’équipe STUDRC</p>
        </div>
      `,
    });
  }

  async sendNewsletterWelcome(to: string) {
    const homeUrl = this.appUrl.replace(/\/$/, '');
    await this.send({
      to,
      subject: 'Bienvenue dans la newsletter STUDRC',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;line-height:1.5;">
          <div style="padding:20px 0 8px;border-bottom:3px solid #e9262a;">
            <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#e9262a;">STUDRC</p>
          </div>
          <p style="margin:1.35rem 0 0.75rem;font-size:22px;font-weight:800;line-height:1.2;">Inscription confirmée</p>
          <p style="margin:0 0 1rem;">Bonjour,</p>
          <p style="margin:0 0 1rem;color:#444;">
            Merci de vous être inscrit à la newsletter STUDRC avec l’adresse
            <strong>${escapeHtml(to)}</strong>.
          </p>
          <p style="margin:0 0 1rem;color:#444;">
            Vous recevrez désormais nos actualités, analyses et coups de projecteur
            directement dans votre boîte mail.
          </p>
          <p style="margin:1.5rem 0;">
            <a href="${escapeHtml(homeUrl)}"
               style="display:inline-block;padding:13px 22px;background:#e9262a;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;">
              Lire STUDRC
            </a>
          </p>
          <p style="margin:0 0 1.25rem;color:#888;font-size:12px;">
            Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail
            ou contactez-nous.
          </p>
          <p style="margin:0;padding-top:1rem;border-top:1px solid #eee;color:#666;font-size:13px;">— L’équipe STUDRC</p>
        </div>
      `,
    });
  }

  async sendPaymentConfirmation(input: {
    to: string;
    name: string;
    purpose: 'PURCHASE' | 'SUBSCRIPTION';
    amountCents: number;
    currency: string;
    providerLabel: string;
    /** Titre magazine ou nom de formule */
    productLabel: string;
    issueNumber?: string | null;
    /** Lien lecture / kiosque / magazines */
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
        ? 'Votre paiement a bien été reçu. Ce numéro est disponible immédiatement dans votre bibliothèque.'
        : 'Votre paiement a bien été reçu. Votre abonnement est maintenant actif.';

    await this.send({
      to: input.to,
      subject,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111;">
          <p>Bonjour ${escapeHtml(input.name)},</p>
          <p>${escapeHtml(intro)}</p>
          <table style="width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:14px;">
            <tr>
              <td style="padding:8px 0;color:#666;">Produit</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(product)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;border-top:1px solid #eee;">Montant</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${escapeHtml(amount)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#666;border-top:1px solid #eee;">Moyen</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${escapeHtml(input.providerLabel)}</td>
            </tr>
          </table>
          <p style="margin:1.5rem 0;">
            <a href="${escapeHtml(input.actionUrl)}"
               style="display:inline-block;padding:12px 20px;background:#e9262a;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">
              ${escapeHtml(input.actionLabel)}
            </a>
          </p>
          <p style="color:#666;font-size:13px;">Si le bouton ne fonctionne pas, ouvrez : ${escapeHtml(input.actionUrl)}</p>
          <p>— L’équipe STUDRC</p>
        </div>
      `,
    });
  }

  /** Email libre (monitoring, ops). */
  async sendRaw(input: { to: string; subject: string; html: string }) {
    await this.send(input);
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
        throw new Error(
          `Échec envoi e-mail (${result.error.message}). Vérifiez RESEND_API_KEY / MAIL_FROM.`,
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
