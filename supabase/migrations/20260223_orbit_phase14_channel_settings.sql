-- Orbit Phase 14: Advanced channel settings for Discord-like management
-- Apply after previous Orbit migrations.

alter table public.channels
  add column if not exists topic text;

alter table public.channels
  add column if not exists slowmode_seconds integer not null default 0;

alter table public.channels
  add column if not exists is_age_restricted boolean not null default false;

alter table public.channels
  add column if not exists hide_after_days integer not null default 3;

alter table public.channels
  drop constraint if exists channels_topic_length_check;

alter table public.channels
  add constraint channels_topic_length_check
  check (topic is null or length(topic) <= 1024);

alter table public.channels
  drop constraint if exists channels_slowmode_seconds_check;

alter table public.channels
  add constraint channels_slowmode_seconds_check
  check (slowmode_seconds >= 0 and slowmode_seconds <= 21600);

alter table public.channels
  drop constraint if exists channels_hide_after_days_check;

alter table public.channels
  add constraint channels_hide_after_days_check
  check (hide_after_days in (1, 3, 7, 14, 30));
