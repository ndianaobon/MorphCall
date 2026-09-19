-- MorphCall — migration 0003: pin search_path on trigger helpers (Supabase security advisor 0011).
alter function app.touch_updated_at() set search_path = '';
