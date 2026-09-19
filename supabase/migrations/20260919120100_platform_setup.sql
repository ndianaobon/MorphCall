-- MorphCall — migration 0002: Supabase wiring, API role, seed data, avatar storage.

-- ---------------------------------------------------------------------------
-- 1. Least-privilege role for the NestJS API (docs/03-database.md §6)
--    Created NOLOGIN here; LOGIN + password are set per environment, outside git.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'morphcall_api') then
    create role morphcall_api nologin noinherit;
  end if;
end $$;

grant usage on schema app, extensions to morphcall_api;
grant select, insert, update, delete on all tables in schema app to morphcall_api;
grant usage, select on all sequences in schema app to morphcall_api;
alter default privileges in schema app grant select, insert, update, delete on tables to morphcall_api;
alter default privileges in schema app grant usage, select on sequences to morphcall_api;

-- audit tables stay append-only for the API
revoke update, delete on app.admin_logs, app.consent_records, app.subscription_events from morphcall_api;

-- Browser roles never touch the app schema directly (it is also not exposed through the Data API).
revoke all on schema app from anon, authenticated;

-- RLS is on for every table; the API role gets an explicit allow-all policy. Anyone else: nothing.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'app'
  loop
    execute format(
      'create policy morphcall_api_all on app.%I for all to morphcall_api using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Keep app.users in step with Supabase Auth
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.users (id, email) values (new.id, new.email) on conflict (id) do nothing;
  insert into app.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into app.profile_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create or replace function app.handle_auth_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update app.users set email = new.email where id = new.id;
  return new;
end $$;

revoke execute on function app.handle_new_auth_user(), app.handle_auth_user_email_change() from public, anon, authenticated;

drop trigger if exists morphcall_on_auth_user_created on auth.users;
create trigger morphcall_on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

drop trigger if exists morphcall_on_auth_user_email_changed on auth.users;
create trigger morphcall_on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function app.handle_auth_user_email_change();

-- ---------------------------------------------------------------------------
-- 3. Seed data
-- ---------------------------------------------------------------------------
insert into app.interests (slug, label) values
  ('music', 'Music'), ('gaming', 'Gaming'), ('art-design', 'Art & Design'), ('film-tv', 'Film & TV'),
  ('travel', 'Travel'), ('fitness', 'Fitness'), ('tech', 'Tech'), ('business', 'Business'),
  ('fashion', 'Fashion'), ('food', 'Food'), ('sports', 'Sports'), ('books', 'Books'),
  ('photography', 'Photography'), ('comedy', 'Comedy'), ('languages', 'Languages'), ('dance', 'Dance'),
  ('anime', 'Anime'), ('podcasts', 'Podcasts'), ('science', 'Science'), ('education', 'Education')
on conflict (slug) do nothing;

insert into app.plans (code, name, tier, billing_interval) values
  ('free', 'Free', 'free', null),
  ('premium_monthly', 'Premium', 'premium', 'month'),
  ('premium_annual', 'Premium (Annual)', 'premium', 'year')
on conflict (code) do nothing;

-- Feature permissions are data (docs/03 §3). AI is Premium-only (D5, D6).
-- ai.minutes_month stays NULL (unlimited) until Stage 4 cost measurements set the allowance.
insert into app.plan_entitlements (plan_id, feature_key, enabled, limit_value)
select p.id, e.feature_key, e.enabled, e.limit_value
from app.plans p
join (values
  ('free',            'ai.identity',      false, null::int),
  ('free',            'ai.voice',         false, null),
  ('free',            'ai.voice.custom',  false, null),
  ('premium_monthly', 'ai.identity',      true,  null),
  ('premium_monthly', 'identities.max',   true,  10),
  ('premium_monthly', 'ai.voice',         true,  null),
  ('premium_monthly', 'ai.voice.custom',  true,  null),
  ('premium_monthly', 'voices.max',       true,  10),
  ('premium_monthly', 'ai.minutes_month', true,  null),
  ('premium_annual',  'ai.identity',      true,  null),
  ('premium_annual',  'identities.max',   true,  10),
  ('premium_annual',  'ai.voice',         true,  null),
  ('premium_annual',  'ai.voice.custom',  true,  null),
  ('premium_annual',  'voices.max',       true,  10),
  ('premium_annual',  'ai.minutes_month', true,  null)
) as e(plan_code, feature_key, enabled, limit_value) on e.plan_code = p.code
on conflict (plan_id, feature_key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Avatar storage (public images; identity data uses separate private buckets in Stage 4)
--    Browser uploads straight into its own folder <userId>/...; the API then records the path.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
