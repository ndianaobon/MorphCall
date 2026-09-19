# 04 — API Specification (v1)

Base URL `https://api.morphcall.app/v1`. JSON over HTTPS. The machine-readable OpenAPI document is generated from the Zod contracts in `packages/contracts` during Stage 1. This file is the design-level contract.

## 1. Conventions

- **Auth:** `Authorization: Bearer <Supabase access token>`. The API verifies the signature against the Supabase JWKS, `exp`, `aud` and `iss`, then loads `users.status`. Suspended or banned users get `403 account_restricted` on everything except `/me`, `/me/export` and account deletion.
- **Access levels** used below: `public` (no token), `user` (valid token, active account, onboarding complete where noted), `owner` (resource belongs to the caller), `ent:<feature>` (server-resolved entitlement, 03 §3), `staff:<role>` (row in `admin_users` + MFA level `aal2` in the token).
- **Validation:** every body, query and param is checked by a Zod schema. Unknown fields are rejected (`400 validation_error` with field paths).
- **Errors:** `{"error": {"code": "user_blocked", "message": "…", "details": {…}, "requestId": "…"}}`. The codes are stable and the UI maps them to the states in 06 §6.
- **Pagination:** cursor-based: `?cursor=<opaque>&limit=20` → `{"data": [...], "nextCursor": "…"|null}`.
- **Idempotency:** mutating endpoints with side effects (`POST /calls`, `POST /messages`, `POST /subscriptions/checkout`) accept an `Idempotency-Key` header (or a `clientNonce` for messages).
- **Rate limits:** Redis token buckets per user and per IP. `429` responses include `Retry-After`. The values below are starting points.

## 2. Endpoints

### Auth and account

Sign-up, login, OAuth, email verification, password reset and MFA are handled by **Supabase Auth directly from the web app** (`@supabase/ssr`). The brief's `/auth/register` and `/auth/login` become thin wrappers only if we need server-side checks at sign-up (age gate, disposable-email block, abuse scoring):

| Method & path | Access | Purpose | Rate limit |
|---------------|--------|---------|------------|
| POST `/auth/register` | public | Pre-validate (age ≥ 18, username availability, abuse checks), then create the Supabase user server-side | 5/h per IP |
| POST `/auth/session/revoke-all` | user | Sign out all devices | 5/h |
| GET `/me` | user | Account, profile, settings, onboarding step, **effective entitlements** | 120/min |
| PATCH `/me/settings` | user | Privacy, video, AI, theme, notification prefs | 30/min |
| GET `/me/entitlements` | user | Entitlements + remaining AI minutes (display only; enforced server-side elsewhere) | 60/min |
| POST `/me/export` | user | Request a data export (async job → email link) | 1/day |
| DELETE `/me` | user | Start account deletion (30-day window) | 3/day |

### Onboarding and profiles

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/usernames/:username/availability` | public | Live check during onboarding (30/min per IP) |
| PUT `/me/profile` | user | Username, display name, bio, interests, onboarding step |
| POST `/me/avatar/upload-url` | user | Signed upload URL (image/*, ≤5 MB). Processed async |
| GET `/interests` | public | Interest catalogue |
| GET `/users/:handle` | public / user | Profile by id or `@username`. Fields filtered by `profile_visibility`, blocks and the caller's relationship. Blocked either way → `404` (no enumeration) |
| GET `/users/:id/followers` · `/following` | user | Cursor lists, respecting visibility |

### Discovery and social

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/discover` | user | Recommended people: `?interests=&online=true&country=&cursor=`. Excludes blocked users, restricted accounts and users under 18 |
| GET `/users/search?q=` | user | Trigram search on username/display name (min 2 chars, 30/min) |
| GET `/users/online` | user | Online people the caller may see (presence filtered by `online_visibility`) |
| POST `/users/:id/follow` · DELETE | user | Follow/unfollow. `requested` status for private profiles |
| POST `/follow-requests/:followerId/accept` · `/decline` | user | Private profiles |
| POST `/friends/:id` · DELETE | user | Send/remove friend request. POST `/friends/:id/accept` |
| GET `/friends` · `/favorites` · `/recent-contacts` | user | Lists |
| POST `/favorites/:id` · DELETE | user | Favorites |
| POST `/blocks` `{userId, reason?}` · DELETE `/blocks/:userId` · GET `/blocks` | user | Blocking immediately ends any active call between the two users and hides each from the other everywhere |
| POST `/reports` `{targetType, targetId, reason, details?}` | user | Report a user, message, call, livestream, identity or AI session (10/h). Auto-attaches server-side context ids |

### Calls and video rooms

| Method & path | Access | Purpose | Notes |
|---------------|--------|---------|-------|
| POST `/calls` `{calleeId}` | user | Start a direct call → `{callId, roomToken, livekitUrl}` | Checks: not blocked either way, callee `who_can_call`, callee online and not busy, caller not suspended. 10/min, 60/h |
| POST `/calls/:id/accept` | participant | → `{roomToken}` | Only the invited callee, only while `ringing` |
| POST `/calls/:id/decline` | participant | | |
| POST `/calls/:id/cancel` | caller | Hang up while ringing | |
| POST `/calls/:id/end` | participant | End an active call | Server also ends it from LiveKit webhooks |
| POST `/calls/:id/quality` | participant | Client stats summary | |
| GET `/calls/:id` | participant | Call summary (duration, AI features used, quality) | |
| GET `/calls/history?filter=all\|missed\|incoming\|outgoing` | user | Call history | |
| POST `/video/rooms/:roomId/token` | participant | Re-issue a token (reconnect after token expiry) | Short TTL (10 min) |
| POST `/webhooks/livekit` | LiveKit (signed) | Participant/room/egress events | Verified with the LiveKit webhook signature; idempotent |

Group calls (later) add `POST /calls {calleeIds[]}` and `POST /calls/:id/invite`, with no change to the room model.

### AI identities

| Method & path | Access | Purpose |
|---------------|--------|---------|
| POST `/identities/uploads` `{mimeType, sizeBytes}` | ent:`ai.identity` | → signed PUT URL to the quarantine bucket (5 min expiry). 10/day |
| POST `/identities` `{uploadId, name, consent: {basis, documentVersion}}` | ent:`ai.identity` | Creates the consent record + identity (`processing`). Enforces `identities.max` |
| GET `/identities` | user | List own identities. Thumbnails as 5-min signed URLs. Each item has `locked: true` when the caller is not `PREMIUM_ACTIVE` (view only) |
| GET `/identities/:id` | owner | Status, rejection reason |
| PATCH `/identities/:id` `{name?, isDefault?}` | owner + ent:`ai.identity` | Rename / set preferred |
| DELETE `/identities/:id` | owner | Hard-delete media + tombstone row. Allowed without Premium (users can always delete their data) |
| POST `/identities/:id/preview` | owner + ent:`ai.identity` | Starts a **self-preview** AI session (ingest room only, no call) for the Original → AI Preview screen. Counts toward quota at a reduced rate |

The brief's `POST /identities/:id/activate` becomes `POST /ai/sessions` (or `PATCH /ai/sessions/:id` mid-call). Activation is a property of a call session, not of the identity.

### Voices

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/voices` | user | Preset voices + own custom voices, all flagged `locked` for non-Premium users (all voice transformation is Premium, D5) |
| POST `/voices/uploads` | ent:`ai.voice.custom` | Signed upload URL for consent recording + samples |
| POST `/voices` `{name, uploadId, consent}` | ent:`ai.voice.custom` | Create a custom voice (`processing`). Rights attestation + consent phrase check (05 §7.4) |
| PATCH `/voices/:id` | owner + ent:`ai.voice` | Rename / set default |
| DELETE `/voices/:id` | owner | Hard-delete. Always allowed |
| GET `/voices/:id/preview` | user | Short signed URL to a pre-rendered sample clip (free users can listen, to see what they'd unlock) |

### AI sessions (real-time)

| Method & path | Access | Purpose |
|---------------|--------|---------|
| POST `/ai/sessions` `{callId, identityId?, voiceId?}` | participant + **`PREMIUM_ACTIVE`** + ent:`ai.identity` and/or ent:`ai.voice` + quota + country flag. Free users get `402 premium_required` → UI shows the upgrade prompt (D7) | Admission control, dispatches a worker → `{aiSessionId, ingestToken, ingestUrl, status}`. Returns `503 ai_capacity` when the GPU pool is full |
| PATCH `/ai/sessions/:id` `{identityId?, voiceId?}` | owner | Switch identity/voice mid-call (re-validated) |
| DELETE `/ai/sessions/:id` | owner | Turn off |
| GET `/ai/sessions/:id` | owner | Status, fps, latency (for the in-call status chip) |
| POST `/internal/ai/heartbeat` | AI worker (mTLS + HMAC) | Usage + health → `continue`/`revoke` |

The brief's `/ai/identity/session` and `/ai/voice/session` are merged into one resource, because one worker serves both features for lip-sync reasons (02 §3.4).

### Messaging

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/conversations?filter=all\|requests\|unread` | user | Inbox |
| POST `/conversations` `{memberIds[], title?}` | user | Direct (deduplicated by pair) or group. Checks `who_can_message` and blocks; lands in the recipient's requests if they don't follow the sender |
| GET `/conversations/:id/messages?cursor=` | member | History |
| POST `/conversations/:id/messages` `{body, kind, attachment?, replyToId?, clientNonce}` | member | Send (30/min; lower for new accounts). Delivered via gateway |
| PATCH / DELETE `/messages/:id` | sender | Edit (15 min window) / delete |
| POST `/conversations/:id/read` `{upTo}` | member | Read receipt |
| POST `/conversations/:id/accept` · `/decline` | member | Message requests |
| GET `/messages/search?q=` | user | Search own conversations |
| POST `/conversations/:id/attachments/upload-url` | member | Images/files, scanned before delivery |

### Notifications

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/notifications?cursor=&unread=true` | user | List |
| POST `/notifications/read` `{ids[]\|all}` | user | Mark read |
| POST `/me/push-subscriptions` · DELETE | user | Web push registration |

### Subscriptions and billing

| Method & path | Access | Purpose |
|---------------|--------|---------|
| GET `/plans?country=` | public | Plans, feature comparison (from `plan_entitlements`) and **available prices per provider/currency** (from `plan_prices`), with a suggested default provider |
| GET `/subscriptions/me` | user | Internal status (`FREE` / `PENDING` / `PREMIUM_ACTIVE` / `PREMIUM_PAST_DUE` / `PREMIUM_CANCELLED` / `PREMIUM_EXPIRED`), provider, renewal date, cancel-at-period-end |
| POST `/subscriptions/checkout` `{planCode, provider: 'paystack'\|'stripe', currency}` | user | → provider-hosted checkout URL. `409 subscription_exists` if a live subscription exists on **any** provider |
| POST `/subscriptions/cancel` `{confirm: true}` | user | **Cancel immediately, no refund** (D8). Calls the provider first, then sets `PREMIUM_CANCELLED` and revokes live AI sessions. To come back, the user starts a new checkout |
| POST `/subscriptions/change` `{planCode}` | user | Monthly ↔ annual. Stripe: prorated now. Paystack: takes effect at period end |
| POST `/billing/manage` | user | Provider self-service URL (Stripe portal / Paystack manage link) |
| GET `/billing/history` | user | Payments across all providers + receipt links |
| POST `/webhooks/:provider` (`paystack`, `stripe`) | provider (signed) | Raw-body signature verification (Paystack HMAC-SHA512 / Stripe-Signature) → `webhook_events` → queue ([08 §5](08-payments.md)) |

### Livestreaming (Stage 9)

`POST /livestreams` (create/schedule) · `POST /livestreams/:id/start` → host token · `POST /livestreams/:id/end` · `GET /live` (discovery) · `GET /livestreams/:id` · `POST /livestreams/:id/join` → viewer token (checks visibility: followers/subscribers/paid purchase) · `POST /livestreams/:id/moderators` · `POST /livestreams/:id/chat` · `POST /livestreams/:id/bans` · `GET /livestreams/:id/analytics` (host) · `GET /livestreams/:id/replay`.

### Admin (`apps/admin`, all `staff:*`, all writes logged to `admin_logs`)

| Area | Endpoints | Minimum role |
|------|-----------|--------------|
| Overview | GET `/admin/metrics/overview` (users, DAU/MAU, premium, revenue, active calls/streams, AI minutes, open reports, growth series) | support |
| Users | GET `/admin/users?q=&status=&premium=`, GET `/admin/users/:id` (profile, subscriptions, reports, AI usage, moderation history) | support |
| Moderation | POST `/admin/users/:id/actions` `{action: warn\|suspend\|ban\|unban\|ai_access_revoked, reason, expiresAt?}` | moderator (ban: admin) |
| Reports | GET `/admin/reports?status=&priority=`, PATCH `/admin/reports/:id` (assign/resolve) | moderator |
| AI content | GET `/admin/identities?status=`, POST `/admin/identities/:id/disable`, same for voices. Thumbnails only via short signed URLs, access-logged | moderator |
| Calls/streams | GET `/admin/calls/live`, POST `/admin/calls/:id/terminate`, same for livestreams | moderator |
| Payments | GET `/admin/payments`, GET `/admin/subscriptions`, POST `/admin/payments/:id/refund` | admin |
| Entitlements | POST `/admin/users/:id/entitlement-overrides` | admin |
| AI ops | GET `/admin/ai/usage`, GET `/admin/ai/workers` (health, capacity, fps) | admin |
| Staff | CRUD `/admin/staff` | super_admin |
| Settings | GET/PATCH `/admin/settings` (feature flags, plan config) | super_admin |
| Audit | GET `/admin/audit-log` | admin |

## 3. Realtime gateway (WebSocket)

Connect to `wss://rt.morphcall.app` with the access token in the handshake (validated as for REST, then re-validated on token refresh). Each socket joins `user:<id>`, plus `conversation:<id>` for open threads. **Clients cannot subscribe to arbitrary channels.** The server decides membership.

| Event (server → client) | Payload | Trigger |
|-------------------------|---------|---------|
| `call.incoming` | `{callId, caller, expiresAt}` | POST /calls |
| `call.updated` | `{callId, status, endReason?}` | accept/decline/cancel/end/timeout |
| `message.new` / `message.updated` | message | Send / edit / delete |
| `conversation.typing` | `{conversationId, userId}` | client `typing` (throttled 1 per 3 s) |
| `conversation.read` | `{conversationId, userId, upTo}` | read receipt |
| `presence.changed` | `{userId, status: online\|in_call\|offline}` | only to users allowed to see it |
| `notification.new` | notification | any |
| `entitlements.updated` | effective entitlements | billing webhook / override |
| `ai.session.updated` | `{aiSessionId, status, reason?}` | worker state changes, revoke |
| `account.restricted` | `{reason}` | moderation → client signs out of calls |

| Event (client → server) | Purpose |
|-------------------------|---------|
| `presence.heartbeat` (every 25 s) | Keeps `online` (Redis TTL 60 s) |
| `conversation.typing` | Typing indicator |
| `conversation.open` / `close` | Join/leave a conversation channel (membership checked) |

In-call signalling that must be very fast (worker "ready", identity crossfade done) uses **LiveKit data messages** inside the room, not the gateway.

## 4. Error codes the UI must handle (excerpt)

`validation_error`, `unauthenticated`, `account_restricted`, `not_found`, `user_blocked`, `user_unavailable`, `user_busy`, `privacy_restricted`, `call_not_ringing`, `room_unavailable`, `premium_required` (HTTP 402, opens the upgrade prompt), `premium_past_due` (402, opens "update payment method"), `feature_unavailable_in_country`, `quota_exhausted`, `ai_capacity`, `ai_unavailable`, `identity_not_ready`, `identity_rejected`, `upload_invalid_type`, `upload_too_large`, `consent_required`, `subscription_exists`, `payment_failed`, `rate_limited`, `server_error`.
