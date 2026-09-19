import { ageOn, MIN_AGE } from '@morphcall/contracts';

export interface AuthContext {
  userId: string;
  email: string;
  status: 'active' | 'suspended' | 'banned' | 'pending_deletion' | 'deleted';
  dateOfBirth: string | null;
  countryCode: string | null;
  onboarded: boolean;
  aal: 'aal1' | 'aal2';
}

export function isUnderAge(ctx: Pick<AuthContext, 'dateOfBirth'>, now = new Date()): boolean {
  if (!ctx.dateOfBirth) return false;
  return ageOn(new Date(`${ctx.dateOfBirth}T00:00:00Z`), now) < MIN_AGE;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
