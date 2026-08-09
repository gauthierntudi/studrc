import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT optionnel — continue sans user si cookie / bearer absent ou invalide. */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt-access') {
  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const ok = await (super.canActivate(context) as Promise<boolean>);
      return ok;
    } catch {
      return true;
    }
  }
}
