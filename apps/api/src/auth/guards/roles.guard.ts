import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import type { AdminAuthUser } from '../strategies/jwt-admin.strategy';
import { ADMIN_ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AdminAuthUser }>();
    const user = req.user;

    if (!user?.role || !roles.includes(user.role as AdminRole)) {
      throw new ForbiddenException('Accès réservé');
    }

    return true;
  }
}
