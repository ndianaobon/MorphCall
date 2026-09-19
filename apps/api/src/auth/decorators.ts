import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthContext } from './auth-context.js';

export const IS_PUBLIC = 'morphcall:public';
export const ALLOW_RESTRICTED = 'morphcall:allow-restricted';
export const REQUIRE_ONBOARDED = 'morphcall:require-onboarded';

/** No token needed. If a valid token is present the user is still attached (optional auth). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Reachable by suspended / under-age accounts (e.g. GET /me, account deletion). */
export const AllowRestricted = () => SetMetadata(ALLOW_RESTRICTED, true);

/** Requires a completed onboarding (username + profile). */
export const RequireOnboarded = () => SetMetadata(REQUIRE_ONBOARDED, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | undefined =>
    ctx.switchToHttp().getRequest<FastifyRequest>().auth,
);
