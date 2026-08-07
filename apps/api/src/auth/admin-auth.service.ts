import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ActivityActorType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../storage/r2';
import { UpdateAdminProfileDto } from './dto/admin-staff.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { hashPassword, verifyPassword } from './password.util';

const ADMIN_ACCESS_COOKIE = 'admin_access_token';
const ADMIN_REFRESH_COOKIE = 'admin_refresh_token';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  async login(dto: LoginDto, res: Response, ip?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const valid = await verifyPassword(dto.password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    await this.setAdminCookies(res, admin.id, admin.email);
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: admin.id,
      action: 'admin_login_success',
      entity: 'admin_user',
      entityId: admin.id,
      ip,
    });
    return this.toPublicAdmin(admin);
  }

  async me(adminId: string) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, isActive: true },
    });
    if (!admin) {
      throw new UnauthorizedException();
    }
    return this.toPublicAdmin(admin);
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

      if (payload.type !== 'admin') {
        throw new UnauthorizedException();
      }

      const admin = await this.prisma.adminUser.findFirst({
        where: { id: payload.sub, isActive: true },
      });
      if (!admin) {
        throw new UnauthorizedException();
      }

      await this.setAdminCookies(res, admin.id, admin.email);
      return this.toPublicAdmin(admin);
    } catch {
      throw new UnauthorizedException('Session expirée');
    }
  }

  async logout(res: Response, accessToken?: string) {
    let adminId: string | undefined;
    if (accessToken) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          type: string;
        }>(accessToken, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        if (payload.type === 'admin') adminId = payload.sub;
      } catch {
        /* session already expired — still clear cookies */
      }
    }

    const common = this.cookieOptions();
    res.clearCookie(ADMIN_ACCESS_COOKIE, common);
    res.clearCookie(ADMIN_REFRESH_COOKIE, common);

    if (adminId) {
      void this.activity.log({
        actorType: ActivityActorType.ADMIN,
        adminId,
        action: 'admin_logout',
        entity: 'admin_user',
        entityId: adminId,
      });
    }

    return { ok: true };
  }

  async updateProfile(adminId: string, dto: UpdateAdminProfileDto) {
    const admin = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        name: dto.name.trim(),
        title: dto.title?.trim() || null,
        phone: dto.phone?.trim() || null,
      },
    });
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId,
      action: 'admin_profile_updated',
      entity: 'admin_user',
      entityId: adminId,
      meta: { name: admin.name },
    });
    return this.toPublicAdmin(admin);
  }

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, isActive: true },
    });
    if (!admin) {
      throw new UnauthorizedException();
    }

    const valid = await verifyPassword(dto.currentPassword, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId,
      action: 'admin_password_changed',
      entity: 'admin_user',
      entityId: adminId,
    });

    return { ok: true };
  }

  async uploadAvatar(adminId: string, file: UploadFile | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier manquant');
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: adminId, isActive: true },
    });
    if (!admin) {
      throw new UnauthorizedException();
    }

    const ext = extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = new Set(['png', 'jpg', 'jpeg', 'webp']);
    if (!allowed.has(ext)) {
      throw new BadRequestException('Formats acceptés : PNG, JPG, WEBP');
    }
    if (file.size > 2_000_000) {
      throw new BadRequestException('La photo dépasse 2 Mo');
    }

    const mimeOk =
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/webp';
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
    }

    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), file.buffer);

    const updated = await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { avatarKey },
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId,
      action: 'admin_avatar_uploaded',
      entity: 'admin_user',
      entityId: adminId,
      meta: { avatarKey, size: file.size },
    });

    return this.toPublicAdmin(updated);
  }

  /** Bootstrap / seed helper */
  async ensureAdmin(input: {
    email: string;
    password: string;
    name: string;
  }) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.adminUser.findUnique({
      where: { email },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.adminUser.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: 'SUPERADMIN',
      },
    });
  }

  private async setAdminCookies(res: Response, sub: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, type: 'admin' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub, email, type: 'admin' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const common = this.cookieOptions();
    res.cookie(ADMIN_ACCESS_COOKIE, accessToken, {
      ...common,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, {
      ...common,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
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

  private toPublicAdmin(admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    phone?: string | null;
    avatarKey?: string | null;
    createdAt: Date;
  }) {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      title: admin.title,
      phone: admin.phone ?? null,
      avatarUrl: this.resolveAvatarUrl(admin.avatarKey ?? null),
      createdAt: admin.createdAt,
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
