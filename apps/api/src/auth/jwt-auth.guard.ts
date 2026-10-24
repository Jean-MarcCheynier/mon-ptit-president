import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { unauthenticated } from '../common/api.exception.js';
import { type AuthenticatedRequest, IS_PUBLIC } from './auth.decorators.js';
import { ACCESS_COOKIE } from './auth-cookies.js';
import { SessionService } from './session.service.js';

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    const payload = typeof token === 'string' ? this.sessions.verifyAccessToken(token) : null;
    if (!payload) throw unauthenticated();

    req.user = { id: payload.sub };
    return true;
  }
}
