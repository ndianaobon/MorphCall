import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-exception.js';
import { AccountContextService } from './account-context.service.js';
import { isUnderAge } from './auth-context.js';
import { ALLOW_RESTRICTED, IS_PUBLIC, REQUIRE_ONBOARDED } from './decorators.js';
import { JWT_VERIFIER, type JwtVerifier } from './jwt-verifier.js';

/**
 * Global guard, in order: token → account state → age gate → onboarding.
 * docs/05-security-privacy.md §2.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    private readonly accounts: AccountContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flag = (key: string) =>
      this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) ??
      false;
    const isPublic = flag(IS_PUBLIC);
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const token = bearerToken(request);
    const verified = token ? await this.verifier.verify(token) : null;
    const auth = verified ? await this.accounts.load(verified) : null;

    if (isPublic) {
      // Optional auth: attach a healthy account, otherwise treat the caller as anonymous.
      if (auth && auth.status === 'active' && !isUnderAge(auth)) request.auth = auth;
      return true;
    }

    if (!auth) throw new ApiException(401, 'unauthenticated', 'Please sign in to continue.');
    request.auth = auth;

    if (!flag(ALLOW_RESTRICTED)) {
      if (auth.status !== 'active') {
        throw new ApiException(403, 'account_restricted', 'This account is restricted.');
      }
      if (isUnderAge(auth)) {
        throw new ApiException(403, 'age_restricted', 'MorphCall is only available to adults 18+.');
      }
    }

    if (flag(REQUIRE_ONBOARDED) && !auth.onboarded) {
      throw new ApiException(403, 'onboarding_required', 'Finish setting up your profile first.');
    }
    return true;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 && token.length < 8192 ? token : null;
}
