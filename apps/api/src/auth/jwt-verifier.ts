import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface VerifiedToken {
  userId: string;
  email: string | null;
  /** Authenticator assurance level: 'aal2' once MFA is completed (required for staff). */
  aal: 'aal1' | 'aal2';
}

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');

/**
 * Verifies Supabase access tokens with the project's public signing keys (ES256 via JWKS).
 * No shared secret lives in the API; role/premium claims in the token are never trusted.
 */
export class JwtVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly issuer: string,
  ) {}

  async verify(token: string): Promise<VerifiedToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || payload.role !== 'authenticated') return null;
      return {
        userId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        aal: payload.aal === 'aal2' ? 'aal2' : 'aal1',
      };
    } catch (err) {
      if (err instanceof errors.JOSEError) return null;
      throw err;
    }
  }
}
