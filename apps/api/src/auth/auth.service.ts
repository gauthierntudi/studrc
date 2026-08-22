import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ActivityActorType } from '@prisma/client';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../storage/r2';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  generateSubscriberCode,
  hashPassword,
  verifyPassword,
} from './password.util';
import { TurnstileService } from './turnstile.service';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Délai minimum entre deux e-mails de confirmation (par compte). */
const VERIFY_EMAIL_COOLDOWN_MS = 60_000;
/** Max de renvois de confirmation par heure (par compte). */
const VERIFY_EMAIL_MAX_PER_HOUR = 5;
const VERIFY_EMAIL_ACTIONS = [
  'subscriber_verification_sent',
  'subscriber_verification_resent',
] as const;

type PurposeToken = {
  sub: string;
  email: string;
  purpose: 'email_verify';
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly activity: ActivityService,
    private readonly turnstile: TurnstileService,
  ) {}

  async register(dto: RegisterDto, res: Response, ip?: string | null) {
    await this.turnstile.assertValid(dto.turnstileToken, ip);
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.subscriber.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await hashPassword(dto.password);

    const subscriber = await this.prisma.subscriber.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
        subscriberCode: generateSubscriberCode(),
      },
    });

    const verifyToken = await this.signPurposeToken(
      subscriber.id,
      subscriber.email,
      'email_verify',
      60 * 60 * 24,
    );
    await this.mail.sendVerifyEmail(
      subscriber.email,
      subscriber.name,
      verifyToken,
    );

    await this.setAuthCookies(res, subscriber.id, subscriber.email);

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_registered',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
      meta: { email: subscriber.email },
    });
    await this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_verification_sent',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
      meta: { email: subscriber.email, reason: 'register' },
    });

    return this.toPublicSubscriber(subscriber);
  }

  async login(dto: LoginDto, res: Response, ip?: string | null) {
    await this.turnstile.assertValid(dto.turnstileToken, ip);
    const email = dto.email.trim().toLowerCase();

    const subscriber = await this.prisma.subscriber.findUnique({
      where: { email },
    });

    if (!subscriber || !subscriber.isActive) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const valid = await verifyPassword(dto.password, subscriber.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    await this.setAuthCookies(res, subscriber.id, subscriber.email);

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_login_success',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
    });

    return this.toPublicSubscriber(subscriber);
  }

  /**
   * Connexion Google (GSI) — même flux que async/google_login.php legacy.
   * Vérifie l’id_token, crée le compte si besoin, ouvre la session JWT.
   */
  async loginWithGoogle(
    credential: string,
    res: Response,
    ip?: string | null,
    turnstileToken?: string | null,
  ) {
    await this.turnstile.assertValid(turnstileToken, ip);
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() ?? '';
    if (!clientId) {
      throw new BadRequestException('Connexion Google non configurée');
    }

    const googleUser = await this.verifyGoogleIdToken(credential, clientId);
    if (!googleUser) {
      throw new UnauthorizedException('Vérification Google échouée');
    }

    const email = googleUser.email;
    const name =
      googleUser.name ||
      email.split('@')[0] ||
      'Abonné STUDRC';

    let subscriber = await this.prisma.subscriber.findUnique({
      where: { email },
    });

    if (!subscriber) {
      const passwordHash = await hashPassword(
        `google:${googleUser.sub}:${Date.now()}`,
      );
      subscriber = await this.prisma.subscriber.create({
        data: {
          name,
          email,
          passwordHash,
          subscriberCode: generateSubscriberCode(),
          emailVerifiedAt: new Date(),
          avatarKey: googleUser.picture || null,
        },
      });
    } else if (!subscriber.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    } else if (!subscriber.emailVerifiedAt) {
      subscriber = await this.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          emailVerifiedAt: new Date(),
          ...(googleUser.picture && !subscriber.avatarKey
            ? { avatarKey: googleUser.picture }
            : {}),
        },
      });
    } else if (googleUser.picture && !subscriber.avatarKey) {
      subscriber = await this.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { avatarKey: googleUser.picture },
      });
    }

    await this.setAuthCookies(res, subscriber.id, subscriber.email);

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_google_login',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
      meta: { email: subscriber.email },
    });

    return this.toPublicSubscriber(subscriber);
  }

  private async verifyGoogleIdToken(
    idToken: string,
    clientId: string,
  ): Promise<{
    email: string;
    name: string;
    sub: string;
    picture: string | null;
  } | null> {
    try {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return null;
      }
      const data = (await resp.json()) as {
        aud?: string;
        exp?: string;
        email?: string;
        email_verified?: string | boolean;
        name?: string;
        sub?: string;
        picture?: string;
      };

      if ((data.aud ?? '') !== clientId) {
        return null;
      }
      if (data.exp && Number(data.exp) < Math.floor(Date.now() / 1000)) {
        return null;
      }

      const email = (data.email ?? '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return null;
      }

      const verified = data.email_verified;
      if (verified !== true && verified !== 'true') {
        return null;
      }

      return {
        email,
        name: (data.name ?? '').trim(),
        sub: (data.sub ?? '').trim(),
        picture: (data.picture ?? '').trim() || null,
      };
    } catch {
      return null;
    }
  }

  async me(userId: string) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: userId, isActive: true },
    });

    if (!subscriber) {
      throw new UnauthorizedException();
    }

    return this.toPublicSubscriber(subscriber);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    ip?: string | null,
  ) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: userId, isActive: true },
    });
    if (!subscriber) {
      throw new UnauthorizedException();
    }
    this.assertEmailVerified(subscriber);

    const email = dto.email.trim().toLowerCase();
    if (email !== subscriber.email) {
      const taken = await this.prisma.subscriber.findUnique({ where: { email } });
      if (taken && taken.id !== subscriber.id) {
        throw new ConflictException('Un compte existe déjà avec cet email');
      }
    }

    const emailChanged = email !== subscriber.email;
    const updated = await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        country: dto.country?.trim() || null,
        countryCode: dto.countryCode?.trim() || null,
        address: dto.address?.trim() || null,
        ...(emailChanged ? { emailVerifiedAt: null } : {}),
      },
    });

    if (emailChanged && !updated.emailVerifiedAt) {
      const token = await this.signPurposeToken(
        updated.id,
        updated.email,
        'email_verify',
        60 * 60 * 24,
      );
      await this.mail.sendVerifyEmail(updated.email, updated.name, token);
      await this.activity.log({
        actorType: ActivityActorType.SUBSCRIBER,
        subscriberId: updated.id,
        action: 'subscriber_verification_sent',
        entity: 'subscriber',
        entityId: updated.id,
        ip,
        meta: { email: updated.email, reason: 'email_change' },
      });
    }

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: updated.id,
      action: 'subscriber_profile_updated',
      entity: 'subscriber',
      entityId: updated.id,
      ip,
      meta: { emailChanged },
    });

    return this.toPublicSubscriber(updated);
  }

  async updateAvatar(
    userId: string,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    ip?: string | null,
  ) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: userId, isActive: true },
    });
    if (!subscriber) {
      throw new UnauthorizedException();
    }
    this.assertEmailVerified(subscriber);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const ext = extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = new Set(['png', 'jpg', 'jpeg']);
    if (!allowed.has(ext)) {
      throw new BadRequestException('Formats acceptés : PNG, JPG, JPEG');
    }
    if (file.size > 1_000_000) {
      throw new BadRequestException('La photo dépasse 1 Mo');
    }

    const mimeOk =
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg';
    if (!mimeOk) {
      throw new BadRequestException('Type de fichier non supporté');
    }

    const filename = `${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    const avatarKey = `profil/${filename}`;
    const r2 = createR2ClientFromEnv();
    const uploadDir =
      this.config.get<string>('PROFILE_UPLOAD_DIR')?.trim() ||
      resolve(process.cwd(), '../../../profil');

    if (r2) {
      await putR2Object(r2, {
        key: avatarKey,
        body: file.buffer,
        contentType: contentTypeForExt(ext),
      });
    } else {
      this.logger.warn(
        'R2 non configuré — fallback disque local pour avatar',
      );
    }

    // Toujours garder une copie locale (servie via /legacy/profil) tant que
    // le domaine CDN R2 n’est pas résolu / branché.
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), file.buffer);

    const updated = await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { avatarKey },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: updated.id,
      action: 'subscriber_avatar_uploaded',
      entity: 'subscriber',
      entityId: updated.id,
      ip,
      meta: { avatarKey, size: file.size },
    });

    return this.toPublicSubscriber(updated);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ip?: string | null,
  ) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: userId, isActive: true },
    });
    if (!subscriber) {
      throw new UnauthorizedException();
    }

    const valid = await verifyPassword(
      dto.currentPassword,
      subscriber.passwordHash,
    );
    if (!valid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit être différent de l’actuel',
      );
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        passwordHash,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_password_changed',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
    });

    return { ok: true, message: 'Mot de passe mis à jour' };
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Session expirée');
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        type: string;
      }>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'subscriber') {
        throw new UnauthorizedException();
      }

      const subscriber = await this.prisma.subscriber.findFirst({
        where: { id: payload.sub, isActive: true },
      });

      if (!subscriber) {
        throw new UnauthorizedException();
      }

      await this.setAuthCookies(res, subscriber.id, subscriber.email);
      return this.toPublicSubscriber(subscriber);
    } catch {
      throw new UnauthorizedException('Session expirée');
    }
  }

  async logout(res: Response, accessToken?: string, ip?: string | null) {
    let subscriberId: string | undefined;
    if (accessToken) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          type: string;
        }>(accessToken, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        if (payload.type === 'subscriber') subscriberId = payload.sub;
      } catch {
        /* session already expired — still clear cookies */
      }
    }

    this.clearAuthCookies(res);

    if (subscriberId) {
      void this.activity.log({
        actorType: ActivityActorType.SUBSCRIBER,
        subscriberId,
        action: 'subscriber_logout',
        entity: 'subscriber',
        entityId: subscriberId,
        ip,
      });
    }

    return { ok: true };
  }

  async verifyEmail(token: string, ip?: string | null) {
    const payload = await this.verifyPurposeToken(token, 'email_verify');

    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: payload.sub, email: payload.email, isActive: true },
    });

    if (!subscriber) {
      throw new BadRequestException('Lien de confirmation invalide');
    }

    if (!subscriber.emailVerifiedAt) {
      await this.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { emailVerifiedAt: new Date() },
      });

      void this.activity.log({
        actorType: ActivityActorType.SUBSCRIBER,
        subscriberId: subscriber.id,
        action: 'subscriber_email_verified',
        entity: 'subscriber',
        entityId: subscriber.id,
        ip,
      });
    }

    return { ok: true, message: 'Email confirmé' };
  }

  async resendVerification(userId: string, ip?: string | null) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: userId, isActive: true },
    });

    if (!subscriber) {
      throw new UnauthorizedException();
    }

    if (subscriber.emailVerifiedAt) {
      return { ok: true, message: 'Email déjà confirmé' };
    }

    await this.assertVerifyEmailRateLimit(subscriber.id);

    const token = await this.signPurposeToken(
      subscriber.id,
      subscriber.email,
      'email_verify',
      60 * 60 * 24,
    );
    await this.mail.sendVerifyEmail(subscriber.email, subscriber.name, token);

    await this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_verification_resent',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
      meta: { email: subscriber.email },
    });

    return { ok: true, message: 'Email de confirmation renvoyé' };
  }

  private async assertVerifyEmailRateLimit(subscriberId: string) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentHour, last] = await Promise.all([
      this.prisma.activityLog.count({
        where: {
          subscriberId,
          action: { in: [...VERIFY_EMAIL_ACTIONS] },
          createdAt: { gt: hourAgo },
        },
      }),
      this.prisma.activityLog.findFirst({
        where: {
          subscriberId,
          action: { in: [...VERIFY_EMAIL_ACTIONS] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    if (recentHour >= VERIFY_EMAIL_MAX_PER_HOUR) {
      throw new HttpException(
        'Trop de demandes. Réessayez dans une heure.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (last) {
      const elapsed = Date.now() - last.createdAt.getTime();
      if (elapsed < VERIFY_EMAIL_COOLDOWN_MS) {
        const waitSec = Math.ceil((VERIFY_EMAIL_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Patientez ${waitSec} s avant de renvoyer l’e-mail.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private assertEmailVerified(subscriber: { emailVerifiedAt: Date | null }) {
    if (!subscriber.emailVerifiedAt) {
      throw new ForbiddenException(
        'Confirmez votre adresse e-mail avant de modifier votre profil.',
      );
    }
  }

  async forgotPassword(dto: ForgotPasswordDto, ip?: string | null) {
    await this.turnstile.assertValid(dto.turnstileToken, ip);
    const email = dto.email.trim().toLowerCase();
    const subscriber = await this.prisma.subscriber.findUnique({
      where: { email },
    });

    if (!subscriber || !subscriber.isActive) {
      throw new NotFoundException('Votre adresse e-mail n’existe pas');
    }

    const otp = String(randomInt(100_000, 1_000_000));
    const otpHash = this.hashOtp(email, otp);

    await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        passwordResetOtpHash: otpHash,
        passwordResetOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        passwordResetOtpAttempts: 0,
      },
    });

    await this.mail.sendPasswordResetOtp(subscriber.email, subscriber.name, otp);

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      this.logger.debug(`OTP reset ${email}: ${otp}`);
    }

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_password_reset_requested',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
      meta: { email },
    });

    return {
      ok: true,
      message: 'Un code de réinitialisation a été envoyé.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ip?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const subscriber = await this.prisma.subscriber.findFirst({
      where: { email, isActive: true },
    });

    if (
      !subscriber?.passwordResetOtpHash ||
      !subscriber.passwordResetOtpExpiresAt
    ) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    if (subscriber.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      await this.clearPasswordResetOtp(subscriber.id);
      throw new BadRequestException('Code expiré — demandez-en un nouveau');
    }

    if (subscriber.passwordResetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      await this.clearPasswordResetOtp(subscriber.id);
      throw new BadRequestException(
        'Trop de tentatives — demandez un nouveau code',
      );
    }

    const expected = Buffer.from(subscriber.passwordResetOtpHash, 'hex');
    const provided = Buffer.from(this.hashOtp(email, otp), 'hex');
    const matches =
      expected.length === provided.length &&
      timingSafeEqual(expected, provided);

    if (!matches) {
      await this.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { passwordResetOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Code invalide');
    }

    const passwordHash = await hashPassword(dto.password);
    await this.prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        passwordHash,
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
      },
    });

    void this.activity.log({
      actorType: ActivityActorType.SUBSCRIBER,
      subscriberId: subscriber.id,
      action: 'subscriber_password_reset',
      entity: 'subscriber',
      entityId: subscriber.id,
      ip,
    });

    return { ok: true, message: 'Mot de passe mis à jour' };
  }

  private hashOtp(email: string, otp: string) {
    const pepper = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHash('sha256')
      .update(`${email}:${otp}:${pepper}`)
      .digest('hex');
  }

  private async clearPasswordResetOtp(subscriberId: string) {
    await this.prisma.subscriber.update({
      where: { id: subscriberId },
      data: {
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
        passwordResetOtpAttempts: 0,
      },
    });
  }

  private async signPurposeToken(
    sub: string,
    email: string,
    purpose: PurposeToken['purpose'],
    expiresInSeconds: number,
  ) {
    return this.jwt.signAsync(
      { sub, email, purpose },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: expiresInSeconds,
      },
    );
  }

  private async verifyPurposeToken(
    token: string,
    purpose: PurposeToken['purpose'],
  ): Promise<PurposeToken> {
    try {
      const payload = await this.jwt.verifyAsync<PurposeToken>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.purpose !== purpose) {
        throw new BadRequestException('Token invalide');
      }
      return payload;
    } catch {
      throw new BadRequestException('Lien invalide ou expiré');
    }
  }

  private async setAuthCookies(res: Response, sub: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, type: 'subscriber' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub, email, type: 'subscriber' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const common = this.cookieOptions();

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...common,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...common,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const common = this.cookieOptions();
    res.clearCookie(ACCESS_COOKIE, common);
    res.clearCookie(REFRESH_COOKIE, common);
  }

  private cookieOptions() {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN');

    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      ...(domain && domain !== 'localhost' ? { domain } : {}),
    };
  }

  private toPublicSubscriber(subscriber: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    countryCode: string | null;
    address: string | null;
    subscriberCode: string | null;
    avatarKey: string | null;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: subscriber.id,
      name: subscriber.name,
      email: subscriber.email,
      phone: subscriber.phone,
      country: subscriber.country,
      countryCode: subscriber.countryCode,
      address: subscriber.address,
      subscriberCode: subscriber.subscriberCode,
      avatarUrl: this.resolveAvatarUrl(subscriber.avatarKey),
      emailVerified: Boolean(subscriber.emailVerifiedAt),
      createdAt: subscriber.createdAt,
    };
  }

  private resolveAvatarUrl(avatarKey: string | null): string | null {
    if (!avatarKey) return null;
    const key = avatarKey.trim();
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;

    const basename = key.includes('/')
      ? (key.split('/').pop() ?? key)
      : key;
    const localUrl = `/legacy/profil/${encodeURIComponent(basename)}`;

    // CDN custom (ex. cdn.egouv.online) — uniquement si explicitement activé.
    // Sinon on sert le symlink Next /legacy/profil (évite ERR_NAME_NOT_RESOLVED
    // quand le domaine R2 n’a pas encore de DNS).
    const useCdn =
      this.config.get<string>('AVATAR_USE_CDN')?.trim().toLowerCase() ===
      'true';
    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');

    if (useCdn && r2 && key.includes('/')) {
      return `${r2}/${key.replace(/^\//, '')}`;
    }

    return localUrl;
  }
}
