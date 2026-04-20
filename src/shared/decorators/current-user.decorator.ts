import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserType {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserType | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
