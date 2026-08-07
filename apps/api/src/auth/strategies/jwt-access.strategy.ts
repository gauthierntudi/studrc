import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

type JwtPayload = {
  sub: string;
  email: string;
  type: 'subscriber';
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'subscriber') {
      throw new UnauthorizedException();
    }

    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: payload.sub, isActive: true },
      select: { id: true, email: true },
    });

    if (!subscriber) {
      throw new UnauthorizedException();
    }

    return {
      id: subscriber.id,
      email: subscriber.email,
      type: 'subscriber',
    };
  }
}
