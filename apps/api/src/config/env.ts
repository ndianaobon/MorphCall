import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    WEB_ORIGIN: z
      .string()
      .default('http://localhost:3000')
      .transform((s) => s.split(',').map((o) => o.trim())),
    SUPABASE_URL: z.url(),
    DATABASE_URL: z.string().startsWith('postgres'),
    /** Optional override, used by tests to point at a local JWKS. */
    JWT_ISSUER: z.string().optional(),
    /** WebSocket URL browsers connect to (dev: ws://localhost:7880). */
    LIVEKIT_URL: z.string().startsWith('ws'),
    LIVEKIT_API_KEY: z.string().min(3),
    // `livekit-server --dev` uses the literal "secret"; real deployments must use a long one.
    LIVEKIT_API_SECRET: z.string().min(6),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.LIVEKIT_API_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_API_SECRET'],
        message: 'must be at least 32 characters in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
