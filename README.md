# MorphCall

Real-time video calls, live streaming and a social community, with Premium AI identity and voice transformation that is always disclosed to everyone in the call.

Architecture, decisions and the staged roadmap live in [`docs/`](docs/README.md). The product owner's decisions in [`docs/00-decisions.md`](docs/00-decisions.md) take precedence over everything else.

## Repository layout

| Path | What it is |
|------|------------|
| `apps/web` | Next.js 16 (App Router, React 19, Tailwind v4): landing, auth, onboarding, app shell, discover, profiles, settings |
| `apps/api` | NestJS 12 on Fastify: REST API; verifies Supabase JWTs (ES256 via JWKS); talks to Postgres as the least-privilege `morphcall_api` role |
| `packages/contracts` | Zod schemas and types shared by the API and the web app |
| `packages/ui` | Design system: tokens (light/dark) and React components |
| `supabase/migrations` | SQL migrations, the source of truth for the database |
| `docs/` | Architecture, API, security, design system, roadmap |

## Prerequisites

- Node 22+, pnpm 12 (`npm i -g pnpm`)
- A Supabase project (dev: `morphcall-dev`, eu-west-2)
- For API tests: a local PostgreSQL server (defaults to `postgres://postgres@localhost:55432/postgres`; override with `TEST_PG_ADMIN_URL`)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env          # fill in SUPABASE_URL and DATABASE_URL
cp apps/web/.env.example apps/web/.env.local    # fill in the Supabase URL and publishable key
pnpm --filter @morphcall/contracts build
```

Run the API (port 4000) and the web app (port 3000) in two terminals:

```bash
pnpm --filter @morphcall/api dev
```

```bash
pnpm --filter @morphcall/web dev
```

## Checks

```bash
pnpm typecheck && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) runs format check, typecheck, tests (API tests against a Postgres service container) and a production build.

## Supabase configuration (one-time, in the dashboard)

- **Auth → URL Configuration:** Site URL `http://localhost:3000`; add `http://localhost:3000/**` to Redirect URLs (and the production domain later).
- **Auth → Providers → Google:** add the OAuth client ID/secret to enable "Continue with Google".
- **Auth → SMTP:** Supabase's built-in email only sends to team members, with a low hourly limit. Configure a real SMTP provider (e.g. Resend or Postmark) before inviting testers.
- **Database role:** the API connects as `morphcall_api`. Its password is set per environment (never in git). To rotate it: `alter role morphcall_api with password '…'`, then update `DATABASE_URL`.
