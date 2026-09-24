# 09 — Deployment (Web + API)

Deploying gets us the one thing local development cannot: **two devices on HTTPS**. Browsers only
hand out the camera and microphone in a secure context, which is why the phone could not turn on its
camera over `http://10.190.212.39:3000`. On real HTTPS domains that restriction disappears and a
genuine two-person call becomes testable.

| Piece | Runs on | Why |
| --- | --- | --- |
| `apps/web` | Vercel | Next.js 16, its native host. |
| `apps/api` | Railway | Long-running NestJS process with a socket.io connection for ringing. Serverless cannot hold that socket open. |
| Database + Auth | Supabase (`morphcall-dev`) | Already provisioned. Unchanged. |
| Media (SFU) | LiveKit Cloud | Already provisioned. Unchanged. |
| `apps/admin` | stays local (`pnpm --filter @morphcall/admin dev`) | Moderation tooling has no reason to be on the public internet yet. |

Config already committed: [`railway.json`](../railway.json) and [`apps/web/vercel.json`](../apps/web/vercel.json).

---

## Before you start

Push the repo to GitHub. Both platforms deploy from a repository, not from this laptop.

```bash
git add -A && git commit -m "Add deployment configuration" && git push
```

Everything below happens in the Railway and Vercel dashboards under your own account, so those steps
are yours to click — I cannot sign in on your behalf.

---

## Part 1 — API on Railway

1. <https://railway.app> → **New Project** → **Deploy from GitHub repo** → pick the MorphCall repo.
2. Leave the service's **Root Directory** as the repository root. `railway.json` is read from there and
   supplies the build and start commands:
   - build: `pnpm --filter @morphcall/contracts build && pnpm --filter @morphcall/api build`
   - start: `node apps/api/dist/main.js`
   - health check: `/health`
3. **Variables** → add these. Values for the last five are in `apps/api/.env` on this machine.

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `WEB_ORIGIN` | `https://<your-app>.vercel.app` — fill in after Part 2, comma-separated for several |
   | `SUPABASE_URL` | `https://vafnhqccmgbaznmnkzyh.supabase.co` |
   | `DATABASE_URL` | the `morphcall_api` pooler URL from `apps/api/.env` |
   | `LIVEKIT_URL` | `wss://morphcall-4xo07470.livekit.cloud` |
   | `LIVEKIT_API_KEY` | from `apps/api/.env` |
   | `LIVEKIT_API_SECRET` | from `apps/api/.env` |

   Do **not** set `PORT` — Railway injects it and the API reads it.

   Two production-only rules the API enforces on boot: `LIVEKIT_API_SECRET` must be at least 32
   characters (the LiveKit Cloud one is 43, so it passes), and CORS becomes a strict `WEB_ORIGIN`
   allowlist with no private-network exception.

4. **Settings → Networking → Generate Domain**. Copy the result, e.g.
   `https://morphcall-api-production.up.railway.app`.
5. Verify:

```bash
curl https://<your-railway-domain>/health
```

   Expect `{"status":"ok","db":"ok","time":"..."}`. `"db":"degraded"` means `DATABASE_URL` is wrong.

The `DATABASE_URL` already points at Supabase's **transaction pooler** on port 6543, which is
IPv4-reachable and matches the `prepare: false` setting in `db.module.ts`. Do not swap it for the
direct `db.<ref>.supabase.co` host.

---

## Part 2 — Web on Vercel

1. <https://vercel.com> → **Add New → Project** → import the same repo.
2. **Root Directory: `apps/web`.** This matters — `vercel.json` lives there and points the install and
   build commands back at the workspace root so `@morphcall/contracts` and `@morphcall/ui` resolve.
3. Framework preset: Next.js (detected). Leave build settings alone; `vercel.json` overrides them.
4. **Environment Variables** (all four, for Production):

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://vafnhqccmgbaznmnkzyh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from `apps/web/.env.local` |
   | `NEXT_PUBLIC_API_URL` | the Railway domain from Part 1 |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel domain, e.g. `https://morphcall.vercel.app` |

   `NEXT_PUBLIC_API_URL` is baked into the client bundle at build time, so changing it later needs a
   redeploy. A non-local value is used exactly as given; the address-following behaviour that keeps
   LAN development working only applies to local hostnames (see `apps/web/src/lib/resolve-url.ts`).

5. Deploy, then copy the production domain.

---

## Part 3 — Wire the two together

Three settings still name each other's domains. None of them are optional.

1. **Railway → `WEB_ORIGIN`** → set to the Vercel domain and redeploy. Until this is right the browser
   blocks every API call with a CORS error.
2. **Supabase → Authentication → URL Configuration**:
   - Site URL: `https://<your-app>.vercel.app`
   - Redirect URLs: add `https://<your-app>.vercel.app/auth/callback`,
     `https://<your-app>.vercel.app/auth/confirm`, `https://<your-app>.vercel.app/reset-password`
   - Keep the `http://localhost:3000` entries so local development still works.
3. **LiveKit Cloud → Settings → Webhooks** → add `https://<your-railway-domain>/webhooks/livekit`.
   Without it calls still work, but durations come from the client's own "end" call rather than from
   the SFU, so a browser that crashes mid-call leaves a call that only the ring-timeout sweeper tidies.

### Preview deployments

Vercel gives every branch a fresh URL, and strict production CORS will refuse it. Either add that URL
to `WEB_ORIGIN` or test on the production domain.

---

## Part 4 — Finally test a real call

1. Open the Vercel domain on a laptop, sign in as one account.
2. Open the same domain on a phone, sign in as a second account.
3. Both are on HTTPS, so **Allow** appears for camera and microphone. The insecure-context banner
   should be gone.
4. Call from one to the other. Check: both video tiles render, both directions have audio, the timer
   counts, mute and camera toggles change the other side, and hanging up ends both.

This is the first end-to-end verification of Stage 2 — nothing before this proves a real call works.

---

## What is deliberately not deployed

- **`apps/admin`** — runs locally against the same cloud database. Public staff tooling needs SSO and
  IP restrictions first.
- **Payments and AI transformation** — Stages 3 and 4, not built yet.
- **Redis** — rate limiting and realtime fan-out are in-process, so more than one API instance would
  break ringing. Keep Railway at a single replica until Redis is added.
