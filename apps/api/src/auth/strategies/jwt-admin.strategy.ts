import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export type AdminAuthUser = {
  id: string;
  email: string;
  type: 'admin';
  role: string;
};

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req as Request & { cookies?: Record<string, string> })?.cookies
            ?.admin_access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    type: string;
  }): Promise<AdminAuthUser> {
    if (payload.type !== 'admin') {
      throw new UnauthorizedException();
    }

    const admin = await this.prisma.adminUser.findFirst({
      where: { id: payload.sub, isActive: true },
      select: { id: true, email: true, role: true },
    });

    if (!admin) {
      throw new UnauthorizedException();
    }

    return {
      id: admin.id,
      email: admin.email,
      type: 'admin',
      role: admin.role,
    };
  }
}
