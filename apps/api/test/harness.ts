import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import postgres from 'postgres';
import { AppModule } from '../src/app.module.js';
import { JWT_VERIFIER, JwtVerifier } from '../src/auth/jwt-verifier.js';
import { configureApp, createFastifyAdapter } from '../src/bootstrap.js';
import type { Env } from '../src/config/env.js';
import { AvatarStore } from '../src/me/avatar-store.js';

const ISSUER = 'http://supabase.test/auth/v1';

export interface Harness {
  app: NestFastifyApplication;
  admin: postgres.Sql;
  /** Existing avatar objects, as seen by the stubbed storage check. */
  avatarObjects: Set<string>;
  createUser(email?: string): Promise<{ id: string; token: string }>;
  tokenFor(userId: string, opts?: { foreignKey?: boolean; expired?: boolean }): Promise<string>;
  request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    opts?: { token?: string; body?: unknown },
  ): Promise<{ status: number; body: any }>;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const foreign = await generateKeyPair('ES256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
  const verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER);
  const avatarObjects = new Set<string>();

  const env: Env = {
    NODE_ENV: 'test',
    PORT: 0,
    WEB_ORIGIN: ['http://localhost:3000'],
    SUPABASE_URL: 'http://supabase.test',
    DATABASE_URL: process.env.TEST_DATABASE_URL!,
    JWT_ISSUER: ISSUER,
    LIVEKIT_URL: 'ws://livekit.test:7880',
    LIVEKIT_API_KEY: 'testkey',
    LIVEKIT_API_SECRET: 'test-secret-value-long-enough',
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
    .overrideProvider(JWT_VERIFIER)
    .useValue(verifier)
    .overrideProvider(AvatarStore)
    .useValue({ exists: async (path: string) => avatarObjects.has(path) })
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(env), {
    logger: false,
    // Matches production: webhook signatures are checked against the raw bytes.
    rawBody: true,
  });
  await configureApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const admin = postgres(process.env.TEST_DATABASE_ADMIN_URL!, { max: 2, onnotice: () => {} });

  const tokenFor: Harness['tokenFor'] = async (userId, opts = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ role: 'authenticated', aal: 'aal1', email: `${userId}@test.dev` })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt(now - 60)
      .setExpirationTime(opts.expired ? now - 30 : now + 3600)
      .sign(opts.foreignKey ? foreign.privateKey : privateKey);
  };

  return {
    app,
    admin,
    avatarObjects,
    tokenFor,
    async createUser(email) {
      const id = randomUUID();
      // Inserting into auth.users fires the same trigger Supabase Auth does on sign-up.
      await admin`insert into auth.users (id, email) values (${id}, ${email ?? `${id}@test.dev`})`;
      return { id, token: await tokenFor(id) };
    },
    async request(method, url, opts = {}) {
      const res = await app
        .getHttpAdapter()
        .getInstance()
        .inject({
          method,
          url,
          headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
          ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
        });
      return { status: res.statusCode, body: res.body ? res.json() : null };
    },
    async close() {
      await app.close();
      await admin.end();
    },
  };
}

/** Runs onboarding end-to-end for a fresh user and returns it. */
export async function onboardedUser(
  h: Harness,
  profile: { username: string; displayName?: string; interests?: string[]; dob?: string },
) {
  const user = await h.createUser();
  const basics = await h.request('PUT', '/me/basics', {
    token: user.token,
    body: { dateOfBirth: profile.dob ?? '1995-04-12', countryCode: 'NG' },
  });
  if (basics.status !== 200) throw new Error(`basics failed: ${JSON.stringify(basics.body)}`);
  const res = await h.request('PUT', '/me/profile', {
    token: user.token,
    body: {
      username: profile.username,
      displayName: profile.displayName ?? profile.username,
      interests: profile.interests ?? [],
    },
  });
  if (res.status !== 200) throw new Error(`profile failed: ${JSON.stringify(res.body)}`);
  const done = await h.request('POST', '/me/onboarding/complete', { token: user.token });
  if (done.status !== 200) throw new Error(`complete failed: ${JSON.stringify(done.body)}`);
  // Test users accept calls from anyone unless a test changes it (the product default is
  // "people who follow me", which would make most call tests fail for the wrong reason).
  await h.request('PATCH', '/me/settings', { token: user.token, body: { whoCanCall: 'everyone' } });
  return user;
}
