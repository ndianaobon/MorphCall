import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STAFF_ROLES, type StaffRole } from '@morphcall/contracts';
import { sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { ApiException } from '../common/api-exception.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Db } from '../db/db.module.js';

export const STAFF_ROLE_KEY = 'morphcall:staff-role';

/** Minimum staff role for this route. Applying it also enables the staff guard. */
export const RequireStaff = (role: StaffRole) => SetMetadata(STAFF_ROLE_KEY, role);

export interface StaffContext {
  userId: string;
  email: string;
  role: StaffRole;
  mfa: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    staff?: StaffContext;
  }
}

const rank = (role: StaffRole) => STAFF_ROLES.indexOf(role);

/**
 * Staff access: a row in admin_users that is not disabled, plus MFA.
 * Roles are read from the database — never from the token (docs/05 §2).
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<StaffRole>(STAFF_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = request.auth;
    if (!auth) throw new ApiException(401, 'unauthenticated', 'Please sign in to continue.');

    const rows = await this.db.execute<{ role: StaffRole; email: string }>(sql`
      select au.role, u.email::text as email
      from app.admin_users au
      join app.users u on u.id = au.user_id
      where au.user_id = ${auth.userId} and au.disabled_at is null
    `);
    const staff = rows[0];
    // Non-staff must not be able to tell that these routes exist.
    if (!staff) throw ApiException.notFound('Not found');

    if (rank(staff.role) < rank(required)) {
      throw new ApiException(403, 'account_restricted', 'You don’t have access to this action.');
    }

    const mfa = auth.aal === 'aal2';
    // MFA is mandatory for staff in production; development allows password-only sign-in.
    if (!mfa && this.env.NODE_ENV === 'production') {
      throw new ApiException(403, 'account_restricted', 'Two-factor authentication is required.');
    }

    request.staff = { userId: auth.userId, email: staff.email, role: staff.role, mfa };
    return true;
  }
}
