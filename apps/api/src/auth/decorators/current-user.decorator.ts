import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUser = {
  id: string;
  email: string;
  type: 'subscriber';
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
