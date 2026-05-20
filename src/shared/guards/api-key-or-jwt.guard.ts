import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class ApiKeyOrJwtGuard implements CanActivate {
  constructor(
    private apiKeyGuard: ApiKeyGuard,
    private jwtGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (authHeader?.startsWith('Bearer ')) {
      return this.apiKeyGuard.canActivate(context) as Promise<boolean>;
    }

    return this.jwtGuard.canActivate(context) as Promise<boolean>;
  }
}
