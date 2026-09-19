-- MorphCall — migration 0001: initial schema (source of truth; docs/03-database.md describes it)
-- Target: PostgreSQL 15+ (Supabase). All app tables live in schema "app".
-- Conventions:
--   * uuid PKs (gen_random_uuid), timestamptz everywhere, snake_case.
--   * Status/enum-like columns are text + CHECK (easier to evolve than PG enums).
--   * deleted_at = soft delete. Biometric-like payloads (identity images, embeddings,
--     voice samples/models) are HARD-deleted from storage; only a tombstone row remains.
--   * RLS is enabled on every table with NO policies: the anon/authenticated roles
--     used by the browser can read/write nothing directly. The API connects with a
--     dedicated role (morphcall_api) granted an allow-all policy. Authz lives in the API.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists app;
set search_path = app, public, extensions;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- users & profiles
-- ---------------------------------------------------------------------------
create table users (
  id               uuid primary key references auth.users(id) on delete restrict,
  email            citext not null unique,
  status           text   not null default 'active'
                   check (status in ('active','suspended','banned','pending_deletion','deleted')),
  date_of_birth    date,                                   -- 18+ gate for calls/discovery
  country_code     char(2),
  data_region      text   not null default 'global'        -- where this user's sensitive data is stored/processed (D2)
                   check (data_region in ('global','eu','us','ng','uk')),
  is_creator       boolean not null default false,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index users_status_idx on users (status) where deleted_at is null;

create table profiles (
  user_id          uuid primary key references users(id) on delete cascade,
  username         citext not null,
  display_name     text   not null check (char_length(display_name) between 1 and 50),
  bio              text   check (char_length(bio) <= 300),
  avatar_path      text,                                   -- public bucket key
  cover_path       text,
  onboarding_step  smallint not null default 0,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{3,24}$')
);
create unique index profiles_username_uq on profiles (username);
create index profiles_display_name_trgm on profiles using gin (display_name gin_trgm_ops);
create index profiles_username_trgm     on profiles using gin ((username::text) gin_trgm_ops);

create table profile_stats (                              -- denormalised counters, updated async
  user_id          uuid primary key references users(id) on delete cascade,
  followers_count  integer not null default 0,
  following_count  integer not null default 0,
  friends_count    integer not null default 0,
  calls_count      integer not null default 0,
  updated_at       timestamptz not null default now()
);

create table interests (
  id               smallserial primary key,
  slug             text not null unique,
  label            text not null,
  is_active        boolean not null default true
);

create table user_interests (
  user_id          uuid     not null references users(id) on delete cascade,
  interest_id      smallint not null references interests(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (user_id, interest_id)
);
create index user_interests_interest_idx on user_interests (interest_id);

create table user_settings (
  user_id                 uuid primary key references users(id) on delete cascade,
  who_can_call            text not null default 'followers'
                          check (who_can_call in ('everyone','followers','friends','nobody')),
  who_can_message         text not null default 'everyone'
                          check (who_can_message in ('everyone','followers','friends','nobody')),
  online_visibility       text not null default 'everyone'
                          check (online_visibility in ('everyone','followers','friends','nobody')),
  profile_visibility      text not null default 'public'
                          check (profile_visibility in ('public','followers','private')),
  show_ai_badge_to_me     boolean not null default true,   -- viewer pref; cannot hide others' disclosure
  default_identity_id     uuid,                            -- FK added after identities
  default_voice_id        uuid,                            -- FK added after voice_profiles
  video_quality           text not null default 'auto' check (video_quality in ('auto','720p','480p','360p')),
  theme                   text not null default 'system' check (theme in ('system','dark','light')),
  notification_prefs      jsonb not null default '{}'::jsonb,
  updated_at              timestamptz not null default now()
);

create table user_devices (                               -- web push subscriptions
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth_secret      text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz
);
create index user_devices_user_idx on user_devices (user_id);

-- ---------------------------------------------------------------------------
-- staff / RBAC
-- ---------------------------------------------------------------------------
create table admin_users (
  user_id          uuid primary key references users(id) on delete restrict,
  role             text not null check (role in ('moderator','support','admin','super_admin')),
  mfa_required     boolean not null default true,
  created_by       uuid references admin_users(user_id),
  created_at       timestamptz not null default now(),
  disabled_at      timestamptz
);

create table admin_logs (                                 -- append-only audit trail
  id               bigint generated always as identity primary key,
  admin_id         uuid not null references admin_users(user_id),
  action           text not null,                          -- e.g. 'user.suspend'
  target_type      text not null,
  target_id        text not null,
  before           jsonb,
  after            jsonb,
  reason           text,
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create index admin_logs_target_idx on admin_logs (target_type, target_id, created_at desc);
create index admin_logs_admin_idx  on admin_logs (admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- social graph
-- ---------------------------------------------------------------------------
create table follows (
  follower_id      uuid not null references users(id) on delete cascade,
  followee_id      uuid not null references users(id) on delete cascade,
  status           text not null default 'active' check (status in ('active','requested')), -- 'requested' for private profiles
  created_at       timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id, created_at desc);

create table friends (                                    -- one row per unordered pair
  user_low         uuid not null references users(id) on delete cascade,
  user_high        uuid not null references users(id) on delete cascade,
  requested_by     uuid not null references users(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending','accepted')),
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high))
);
create index friends_high_idx on friends (user_high);

create table favorites (
  user_id          uuid not null references users(id) on delete cascade,
  favorite_user_id uuid not null references users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (user_id, favorite_user_id),
  check (user_id <> favorite_user_id)
);

create table blocks (
  blocker_id       uuid not null references users(id) on delete cascade,
  blocked_id       uuid not null references users(id) on delete cascade,
  reason           text,
  created_at       timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);   -- "is anyone blocking me" checks

-- ---------------------------------------------------------------------------
-- billing & entitlements
-- ---------------------------------------------------------------------------
create table plans (                                     -- provider-agnostic product definition (D1)
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,                   -- 'free','premium_monthly','premium_annual'
  name             text not null,
  tier             text not null check (tier in ('free','premium','creator')),
  billing_interval text check (billing_interval in ('month','year')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table plan_prices (                                -- one row per plan × provider × currency
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references plans(id) on delete restrict,
  provider          text not null check (provider in ('paystack','stripe')),
  currency          char(3) not null,                      -- 'NGN','USD',…
  amount_minor      integer not null check (amount_minor > 0),  -- kobo/cents
  provider_price_id text not null,                         -- Paystack plan_code / Stripe price id
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (provider, provider_price_id),
  unique (plan_id, provider, currency)
);

create table country_feature_flags (                      -- per-market availability after legal review (D2)
  country_code     char(2) not null,
  feature_key      text not null,                          -- 'ai.identity','ai.voice','livestream',…
  enabled          boolean not null,
  note             text,
  updated_at       timestamptz not null default now(),
  primary key (country_code, feature_key)
);

create table plan_entitlements (                          -- AI feature permissions live here
  plan_id          uuid not null references plans(id) on delete cascade,
  feature_key      text not null,                          -- 'ai.identity','ai.voice.neural','ai.minutes_month','identities.max','voices.max','call.max_minutes'
  enabled          boolean not null default true,
  limit_value      integer,                                -- null = unlimited
  primary key (plan_id, feature_key)
);

create table entitlement_overrides (                      -- staff grants/removals, promos
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  feature_key      text not null,
  enabled          boolean not null,
  limit_value      integer,
  reason           text not null,
  granted_by       uuid references admin_users(user_id),
  starts_at        timestamptz not null default now(),
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index entitlement_overrides_user_idx on entitlement_overrides (user_id, feature_key);

create table billing_customers (
  user_id              uuid not null references users(id) on delete cascade,
  provider             text not null check (provider in ('stripe','paystack')),
  provider_customer_id text not null,
  created_at           timestamptz not null default now(),
  primary key (user_id, provider),
  unique (provider, provider_customer_id)
);

create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users(id) on delete restrict,
  plan_id                  uuid not null references plans(id),
  plan_price_id            uuid references plan_prices(id),  -- null for provider = 'manual'
  provider                 text not null check (provider in ('stripe','paystack','manual')),
  provider_subscription_id text,
  -- Internal, provider-independent state (D6). FREE = no live row. Only PREMIUM_ACTIVE grants AI features.
  status                   text not null default 'PENDING' check (status in
                           ('PENDING','PREMIUM_ACTIVE','PREMIUM_PAST_DUE','PREMIUM_CANCELLED','PREMIUM_EXPIRED')),
  provider_status          text,                               -- raw provider status, for debugging only
  provider_metadata        jsonb not null default '{}'::jsonb, -- e.g. Paystack email_token (needed to disable)
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,  -- provider-side flag seen in reconciliation only; never grants access (D8: our cancel is immediate)
  canceled_at              timestamptz,
  ended_at                 timestamptz,                      -- when Premium access ended; starts the 30-day AI-data purge clock (D9)
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  check (status not in ('PREMIUM_CANCELLED','PREMIUM_EXPIRED') or ended_at is not null)
);
-- at most one live subscription per user, across ALL providers (prevents double billing)
create unique index subscriptions_one_live_uq on subscriptions (user_id)
  where status in ('PENDING','PREMIUM_ACTIVE','PREMIUM_PAST_DUE');
create index subscriptions_period_end_idx on subscriptions (current_period_end) where status = 'PREMIUM_ACTIVE';

create table subscription_events (                        -- every internal state transition (audit)
  id                   bigint generated always as identity primary key,
  subscription_id      uuid not null references subscriptions(id) on delete restrict,
  from_status          text,
  to_status            text not null,
  cause                text not null,                      -- 'webhook','reconciliation','expiry_sweeper','admin'
  webhook_event_id     uuid,                               -- FK added after webhook_events
  admin_id             uuid references admin_users(user_id),
  created_at           timestamptz not null default now()
);
create index subscription_events_sub_idx on subscription_events (subscription_id, created_at);

create table payments (                                   -- one per invoice / charge attempt group
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete restrict,
  subscription_id      uuid references subscriptions(id),
  provider             text not null,
  provider_invoice_id  text,
  amount_minor         integer not null,
  currency             char(3) not null,
  status               text not null check (status in ('pending','succeeded','failed','refunded','partially_refunded','disputed')),
  description          text,
  receipt_url          text,
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (provider, provider_invoice_id)
);
create index payments_user_idx on payments (user_id, created_at desc);

create table payment_transactions (                       -- charges, refunds, chargebacks
  id                   uuid primary key default gen_random_uuid(),
  payment_id           uuid not null references payments(id) on delete restrict,
  provider_txn_id      text not null,
  type                 text not null check (type in ('charge','refund','chargeback','adjustment')),
  amount_minor         integer not null,
  currency             char(3) not null,
  status               text not null check (status in ('pending','succeeded','failed')),
  failure_code         text,
  webhook_event_id     uuid,
  created_at           timestamptz not null default now(),
  unique (provider_txn_id, type)
);

create table webhook_events (                             -- idempotency + replay for all providers
  id                   uuid primary key default gen_random_uuid(),
  provider             text not null check (provider in ('stripe','paystack','livekit')),
  event_id             text not null,
  event_type           text not null,
  payload              jsonb not null,
  received_at          timestamptz not null default now(),
  processed_at         timestamptz,
  attempts             smallint not null default 0,
  last_error           text,
  unique (provider, event_id)
);
create index webhook_events_unprocessed_idx on webhook_events (received_at) where processed_at is null;

alter table subscription_events
  add constraint subscription_events_webhook_fk foreign key (webhook_event_id) references webhook_events(id);
alter table payment_transactions
  add constraint payment_transactions_webhook_fk foreign key (webhook_event_id) references webhook_events(id);

-- ---------------------------------------------------------------------------
-- consent (immutable)
-- ---------------------------------------------------------------------------
create table consent_records (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete restrict,
  subject_type         text not null check (subject_type in ('identity','voice','biometric_processing','recording','terms','privacy')),
  subject_id           uuid,                               -- identity/voice id when applicable
  basis                text check (basis in ('self','licensed','subject_permission','original_artwork','public_domain','rights_attestation')),
  document_version     text not null,                      -- version of the attestation text shown
  verification_method  text not null default 'attestation'
                       check (verification_method in ('attestation','liveness_match','voice_phrase')),
  verified_at          timestamptz,
  ip_hash              text,
  user_agent           text,
  withdrawn_at         timestamptz,
  created_at           timestamptz not null default now()
);
create index consent_records_user_idx on consent_records (user_id, subject_type);

-- ---------------------------------------------------------------------------
-- AI identities & voices
-- ---------------------------------------------------------------------------
create table identity_uploads (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  storage_key          text not null,                      -- private quarantine bucket
  mime_type            text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes           integer not null check (size_bytes <= 10485760),
  sha256               char(64),
  width                integer,
  height               integer,
  status               text not null default 'pending_upload'
                       check (status in ('pending_upload','uploaded','scanning','validating','accepted','rejected','purged')),
  rejection_code       text,                               -- 'no_face','multiple_faces','too_small','blurry','unsupported','malware','policy'
  quality_scores       jsonb,
  scanned_at           timestamptz,
  purged_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index identity_uploads_user_idx on identity_uploads (user_id, created_at desc);
create index identity_uploads_sha_idx  on identity_uploads (sha256);      -- repeat-abuse / hash-list matching

create table identities (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 40),
  kind                 text not null default 'photo' check (kind in ('photo','stylized','system')),
  mode                 text not null default 'swap' check (mode in ('swap','reenact')),
  status               text not null default 'processing'
                       check (status in ('processing','ready','rejected','failed','disabled')),
  upload_id            uuid references identity_uploads(id),
  consent_id           uuid references consent_records(id),
  source_key           text,                               -- encrypted original, kept so identities can be re-prepared when the model changes (D3)
  embedding_key        text,                               -- encrypted model-specific asset (embedding / prepared portrait)
  thumbnail_key        text,                               -- private; served via short-lived signed URL
  model_version        text,
  disabled_reason      text,                               -- moderation
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  check (kind = 'system' or consent_id is not null)
);
create index identities_user_idx on identities (user_id) where deleted_at is null;

create table voice_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references users(id) on delete cascade,   -- null for system presets
  name                 text not null check (char_length(name) between 1 and 40),
  kind                 text not null check (kind in ('dsp_preset','neural_preset','custom')),
  preset_key           text,
  status               text not null default 'ready'
                       check (status in ('processing','ready','rejected','failed','disabled')),
  consent_id           uuid references consent_records(id),
  sample_key           text,                               -- encrypted, purged after model prep
  model_key            text,                               -- encrypted speaker embedding / model
  preview_key          text,                               -- short synthetic preview clip
  model_version        text,
  disabled_reason      text,
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  check (kind <> 'custom' or (user_id is not null and consent_id is not null)),
  check (kind = 'custom' or preset_key is not null)
);
create index voice_profiles_user_idx on voice_profiles (user_id) where deleted_at is null;
create unique index voice_profiles_preset_uq on voice_profiles (preset_key) where user_id is null;

alter table user_settings
  add constraint user_settings_default_identity_fk foreign key (default_identity_id) references identities(id) on delete set null,
  add constraint user_settings_default_voice_fk    foreign key (default_voice_id)    references voice_profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- rooms, calls, AI sessions
-- ---------------------------------------------------------------------------
create table video_rooms (
  id                   uuid primary key default gen_random_uuid(),
  livekit_room_name    text not null unique,
  type                 text not null check (type in ('call','ai_ingest','livestream')),
  status               text not null default 'open' check (status in ('open','closed')),
  region               text,
  max_participants     smallint not null default 2,
  created_by           uuid references users(id) on delete set null,
  created_at           timestamptz not null default now(),
  closed_at            timestamptz
);
create index video_rooms_open_idx on video_rooms (type, created_at) where status = 'open';

create table call_sessions (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null unique references video_rooms(id),
  caller_id            uuid not null references users(id) on delete restrict,
  type                 text not null default 'direct' check (type in ('direct','group')),
  status               text not null default 'ringing'
                       check (status in ('ringing','active','ended','missed','declined','canceled','failed')),
  end_reason           text check (end_reason in ('hangup','network','timeout','blocked','moderation','error')),
  ended_by             uuid references users(id) on delete set null,
  ring_started_at      timestamptz not null default now(),
  answered_at          timestamptz,
  ended_at             timestamptz,
  duration_seconds     integer,
  quality_summary      jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index call_sessions_caller_idx on call_sessions (caller_id, created_at desc);
create index call_sessions_live_idx   on call_sessions (status) where status in ('ringing','active');

create table room_participants (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references video_rooms(id) on delete cascade,
  call_session_id      uuid references call_sessions(id) on delete cascade,
  user_id              uuid references users(id) on delete set null,
  role                 text not null check (role in ('caller','callee','participant','host','cohost','moderator','viewer','ai_worker')),
  livekit_identity     text not null,
  invite_status        text check (invite_status in ('invited','accepted','declined','missed')),
  joined_at            timestamptz,
  left_at              timestamptz,
  created_at           timestamptz not null default now()
);
create index room_participants_room_idx on room_participants (room_id);
create index room_participants_user_idx on room_participants (user_id, created_at desc); -- call history
create unique index room_participants_identity_uq on room_participants (room_id, livekit_identity) where left_at is null;

create table ai_processing_sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete restrict,
  call_session_id      uuid references call_sessions(id) on delete set null,
  livestream_id        uuid,                               -- FK added after livestreams
  target_room_id       uuid not null references video_rooms(id),
  ingest_room_id       uuid references video_rooms(id),
  identity_id          uuid references identities(id) on delete set null,
  voice_profile_id     uuid references voice_profiles(id) on delete set null,
  features             text[] not null,                    -- {'identity','voice'}
  status               text not null default 'requested'
                       check (status in ('requested','starting','active','degraded','ended','failed','revoked')),
  end_reason           text,
  worker_id            text,
  region               text,
  model_versions       jsonb,
  started_at           timestamptz,
  ended_at             timestamptz,
  billable_seconds     integer not null default 0,
  avg_fps              numeric(5,2),
  p95_latency_ms       integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index ai_sessions_user_idx   on ai_processing_sessions (user_id, created_at desc);
create index ai_sessions_live_idx   on ai_processing_sessions (status) where status in ('requested','starting','active','degraded');
create index ai_sessions_call_idx   on ai_processing_sessions (call_session_id);

create table ai_usage_ledger (                            -- metering; source for quotas & admin analytics
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references users(id) on delete restrict,
  ai_session_id        uuid not null references ai_processing_sessions(id),
  feature              text not null check (feature in ('identity','voice')),
  seconds              integer not null check (seconds > 0),
  usage_month          date not null,                      -- first day of month (UTC)
  recorded_at          timestamptz not null default now()
);
create index ai_usage_user_month_idx on ai_usage_ledger (user_id, usage_month);

-- ---------------------------------------------------------------------------
-- messaging
-- ---------------------------------------------------------------------------
create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  type                 text not null check (type in ('direct','group')),
  direct_key           text unique,                        -- '<lowUuid>:<highUuid>' for direct
  title                text,
  created_by           uuid references users(id) on delete set null,
  last_message_at      timestamptz,
  created_at           timestamptz not null default now(),
  check ((type = 'direct') = (direct_key is not null))
);

create table conversation_members (
  conversation_id      uuid not null references conversations(id) on delete cascade,
  user_id              uuid not null references users(id) on delete cascade,
  role                 text not null default 'member' check (role in ('owner','admin','member')),
  is_request           boolean not null default false,     -- message requests from non-followers
  last_read_at         timestamptz,
  muted_until          timestamptz,
  joined_at            timestamptz not null default now(),
  left_at              timestamptz,
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on conversation_members (user_id) where left_at is null;

create table messages (                                   -- partition by month at ~100k MAU
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null references conversations(id) on delete cascade,
  sender_id            uuid references users(id) on delete set null,
  kind                 text not null default 'text' check (kind in ('text','image','file','voice_note','call_event','system')),
  body                 text check (char_length(body) <= 4000),
  attachment           jsonb,
  reply_to_id          uuid references messages(id) on delete set null,
  client_nonce         text,                               -- idempotent send
  edited_at            timestamptz,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  unique (sender_id, client_nonce)
);
create index messages_conversation_idx on messages (conversation_id, created_at desc);
create index messages_body_trgm on messages using gin (body gin_trgm_ops) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,
  type                 text not null,                      -- 'message.new','call.missed','follow.new','follow.request','live.started','subscription.*','premium.*','system'
  actor_id             uuid references users(id) on delete set null,
  entity_type          text,
  entity_id            uuid,
  data                 jsonb not null default '{}'::jsonb,
  read_at              timestamptz,
  created_at           timestamptz not null default now()
);
create index notifications_user_idx   on notifications (user_id, created_at desc);
create index notifications_unread_idx on notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- livestreaming (Stage 9 — created now so FKs and admin views are stable)
-- ---------------------------------------------------------------------------
create table livestreams (
  id                   uuid primary key default gen_random_uuid(),
  host_id              uuid not null references users(id) on delete restrict,
  room_id              uuid not null unique references video_rooms(id),
  title                text not null check (char_length(title) between 1 and 100),
  description          text,
  visibility           text not null default 'public' check (visibility in ('public','followers','subscribers','paid')),
  price_minor          integer check (price_minor is null or price_minor > 0),
  currency             char(3),
  status               text not null default 'scheduled' check (status in ('scheduled','live','ended','canceled','removed')),
  scheduled_for        timestamptz,
  started_at           timestamptz,
  ended_at             timestamptz,
  peak_viewers         integer not null default 0,
  total_viewers        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((visibility = 'paid') = (price_minor is not null))
);
create index livestreams_live_idx on livestreams (started_at desc) where status = 'live';
create index livestreams_host_idx on livestreams (host_id, created_at desc);

alter table ai_processing_sessions
  add constraint ai_sessions_livestream_fk foreign key (livestream_id) references livestreams(id) on delete set null;

create table livestream_viewers (
  id                   uuid primary key default gen_random_uuid(),
  livestream_id        uuid not null references livestreams(id) on delete cascade,
  user_id              uuid references users(id) on delete set null,
  role                 text not null default 'viewer' check (role in ('viewer','moderator')),
  joined_at            timestamptz not null default now(),
  left_at              timestamptz
);
create index livestream_viewers_stream_idx on livestream_viewers (livestream_id, joined_at);

create table recordings (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references video_rooms(id),
  livestream_id        uuid references livestreams(id) on delete set null,
  egress_id            text unique,
  storage_key          text,
  status               text not null default 'starting' check (status in ('starting','recording','processing','ready','failed','deleted')),
  duration_seconds     integer,
  size_bytes           bigint,
  expires_at           timestamptz,
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

-- ---------------------------------------------------------------------------
-- trust & safety
-- ---------------------------------------------------------------------------
create table reports (
  id                   uuid primary key default gen_random_uuid(),
  reporter_id          uuid references users(id) on delete set null,
  target_type          text not null check (target_type in ('user','message','call','livestream','identity','voice','ai_session')),
  target_id            uuid not null,
  target_user_id       uuid references users(id) on delete set null,
  reason               text not null check (reason in
                       ('harassment','hate','sexual_content','minor_safety','impersonation','deepfake_misuse','scam','spam','violence','self_harm','other')),
  details              text check (char_length(details) <= 2000),
  evidence             jsonb,                              -- ids of related ai_session/messages, never raw media
  priority             smallint not null default 3,        -- 1 = urgent (minor_safety, violence)
  status               text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
  assigned_to          uuid references admin_users(user_id),
  resolution_note      text,
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index reports_queue_idx  on reports (status, priority, created_at) where status in ('open','in_review');
create index reports_target_idx on reports (target_user_id, created_at desc);

create table moderation_actions (
  id                   uuid primary key default gen_random_uuid(),
  report_id            uuid references reports(id) on delete set null,
  target_user_id       uuid not null references users(id) on delete restrict,
  action               text not null check (action in
                       ('warn','suspend','ban','unban','content_removed','identity_disabled','voice_disabled','ai_access_revoked','stream_ended','call_terminated')),
  target_type          text,
  target_id            uuid,
  reason               text not null,
  expires_at           timestamptz,                        -- temporary suspensions
  created_by           uuid not null references admin_users(user_id),
  created_at           timestamptz not null default now(),
  revoked_at           timestamptz,
  revoked_by           uuid references admin_users(user_id)
);
create index moderation_actions_user_idx on moderation_actions (target_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- triggers & RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['users','profiles','subscriptions','country_feature_flags','payments','identity_uploads','identities',
                           'voice_profiles','call_sessions','ai_processing_sessions','livestreams','reports']
  loop
    execute format('create trigger %I_touch before update on app.%I for each row execute function app.touch_updated_at()', t, t);
  end loop;

  for t in select tablename from pg_tables where schemaname = 'app'
  loop
    execute format('alter table app.%I enable row level security', t);
  end loop;
end $$;

-- audit tables are append-only for the API role
revoke update, delete on app.admin_logs, app.consent_records, app.subscription_events from public;

-- Premium status as the rest of the platform sees it (D6). Latest subscription wins; never subscribed = FREE.
-- Entitlement resolution (03 §3) builds on this; only has_premium_access = true unlocks AI features.
create view app.user_premium_status with (security_invoker = true) as
select u.id                                   as user_id,
       coalesce(s.status, 'FREE')             as status,
       s.provider,
       s.current_period_end,
       s.cancel_at_period_end,
       (s.status = 'PREMIUM_ACTIVE' and s.current_period_end > now()) is true as has_premium_access
from app.users u
left join lateral (
  select status, provider, current_period_end, cancel_at_period_end
  from app.subscriptions
  where user_id = u.id
  order by created_at desc
  limit 1
) s on true;
