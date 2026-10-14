import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth-user';

export const CurrentUser = createParamDecorator((data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest().user as AuthUser;
  return data ? user?.[data] : user;
});
