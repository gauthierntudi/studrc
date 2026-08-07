import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminAuthUser } from '../strategies/jwt-admin.strategy';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminAuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AdminAuthUser }>();
    return request.user;
  },
);
