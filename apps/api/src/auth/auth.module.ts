import { Global, Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { ENV, type Env } from '../config/env.js';
import { AccountContextService } from './account-context.service.js';
import { AuthGuard } from './auth.guard.js';
import { JWT_VERIFIER, JwtVerifier } from './jwt-verifier.js';

@Global()
@Module({
  providers: [
    {
      provide: JWT_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env) => {
        const issuer = env.JWT_ISSUER ?? `${env.SUPABASE_URL}/auth/v1`;
        const jwks = createRemoteJWKSet(
          new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
          {
            cacheMaxAge: 10 * 60_000,
            cooldownDuration: 30_000,
          },
        );
        return new JwtVerifier(jwks, issuer);
      },
    },
    AccountContextService,
    AuthGuard,
  ],
  exports: [JWT_VERIFIER, AccountContextService, AuthGuard],
})
export class AuthModule {}
