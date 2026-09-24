# MorphCall

Real-time video calls, live streaming and a social community, with Premium AI identity and voice transformation that is always disclosed to everyone in the call.

Architecture, decisions and the staged roadmap live in [`docs/`](docs/README.md). The product owner's decisions in [`docs/00-decisions.md`](docs/00-decisions.md) take precedence over everything else.

## Repository layout

| Path                  | What it is                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`            | Next.js 16 (App Router, React 19, Tailwind v4): landing, auth, onboarding, app shell, discover, profiles, settings                     |
| `apps/api`            | NestJS 12 on Fastify: REST API; verifies Supabase JWTs (ES256 via JWKS); talks to Postgres as the least-privilege `morphcall_api` role |
| `apps/admin`          | Staff-only moderation tool on its own port and origin: report queue, people, moderation actions, audit log                             |
| `packages/contracts`  | Zod schemas and types shared by the API and the web app                                                                                |
| `packages/ui`         | Design system: tokens (light/dark) and React components                                                                                |
| `supabase/migrations` | SQL migrations, the source of truth for the database                                                                                   |
| `docs/`               | Architecture, API, security, design system, roadmap                                                                                    |

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

## LiveKit (video server) for development

Calls need a LiveKit server. Locally, run it in dev mode — no account required:

```bash
docker run --rm -p 7880:7880 -p 7881:7881 -p 50000-50100:50000-50100/udp livekit/livekit-server --dev --bind 0.0.0.0
```

Dev mode uses the key `devkey` and secret `secret`, which match `apps/api/.env.example`. Two browser
windows on this machine can then call each other.

For LiveKit to report join/leave events (which set call durations), point its webhooks at the API:
run it with a config file containing `webhook: { api_key: devkey, urls: [http://host.docker.internal:4000/webhooks/livekit] }`.
Without webhooks calls still work; the server falls back to its own end-of-call handling.

Real devices on other networks need a hosted LiveKit project instead: set `LIVEKIT_URL`,
`LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in `apps/api/.env`.

## Admin (moderation) app

Runs on port 3001, separate from the user app so it has its own cookie scope and stricter headers.

```bash
pnpm --filter @morphcall/admin dev
```

Access needs a row in `app.admin_users`. Grant it to an account that has already signed up:

```bash
pnpm --filter @morphcall/api staff:grant you@example.com super_admin
```

Roles, least to most: `support` (read-only) → `moderator` (decide reports, warn, suspend) →
`admin` (ban, unban, audit log) → `super_admin`. Add `--revoke` to remove access.
Two-factor authentication is required for staff in production; development allows password-only
sign-in. Every staff action is written to the append-only `admin_logs` table.

## Checks

```bash
pnpm typecheck && pnpm test && pnpm build
```

CI (`.github/workflows/ci.yml`) runs format check, typecheck, tests (API tests against a Postgres service container) and a production build.

## Testing a call on a second device (phone, tablet)

Browsers only allow camera and microphone in a **secure context**: HTTPS, or `localhost`. A phone
opening `http://192.168.0.67:3000` gets neither — the camera won't start and there is no mic track
to mute. The call screen says so instead of failing quietly, but to actually use the camera pick one:

- **Two windows on this PC** (simplest): both on `http://localhost:3000`, one of them private/incognito.
  Use headphones, or the two windows echo.
- **Phone on the LAN:** in Chrome on the phone open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
  add `http://192.168.0.67:3000`, set the flag to Enabled and relaunch. Development only.
- **Real devices properly:** put the web app _and_ the API behind HTTPS (a tunnel such as cloudflared
  or ngrok gives both a public HTTPS URL). Serving the page over HTTPS while the API stays on plain
  HTTP fails too — browsers block the mixed content — so both must move together, and
  `NEXT_PUBLIC_API_URL` must point at the HTTPS API.

## Troubleshooting

**Every page except `/` returns 404 in development.** The dev server's route table is stale — usually
after `next build` wrote into the same `.next` folder a running `next dev` was using. Stop the dev
server, delete `apps/web/.next`, and start it again.

**API starts but `/health` reports `degraded`.** The database was unreachable when the pool first
connected (slow or dropped network). It recovers on the next request; check
`psql "$DATABASE_URL" -c "select 1"` if it persists.

## Supabase configuration (one-time, in the dashboard)

- **Auth → URL Configuration:** Site URL `http://localhost:3000`; add `http://localhost:3000/**` to Redirect URLs (and the production domain later).
- **Auth → Providers → Google:** add the OAuth client ID/secret to enable "Continue with Google".
- **Auth → SMTP:** Supabase's built-in email only sends to team members, with a low hourly limit. Configure a real SMTP provider (e.g. Resend or Postmark) before inviting testers.
- **Database role:** the API connects as `morphcall_api`. Its password is set per environment (never in git). To rotate it: `alter role morphcall_api with password '…'`, then update `DATABASE_URL`.
