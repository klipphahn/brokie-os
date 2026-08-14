create table if not exists public.discord_community_feed (
  singleton boolean primary key default true check (singleton),
  live_verified boolean not null default false,
  live_is_live boolean not null default false,
  live_title text not null default '' check (char_length(live_title) <= 256),
  live_url text check (
    live_url is null
    or (char_length(live_url) <= 1000 and live_url ~ '^https?://')
  ),
  roadmap_text text not null default '' check (char_length(roadmap_text) <= 3500),
  roadmap_url text check (roadmap_url is null or (char_length(roadmap_url) <= 1000 and roadmap_url ~ '^https?://')),
  events_text text not null default '' check (char_length(events_text) <= 3500),
  events_url text check (events_url is null or (char_length(events_url) <= 1000 and events_url ~ '^https?://')),
  giveaway_text text not null default '' check (char_length(giveaway_text) <= 3500),
  giveaway_url text check (giveaway_url is null or (char_length(giveaway_url) <= 1000 and giveaway_url ~ '^https?://')),
  truck_text text not null default '' check (char_length(truck_text) <= 3500),
  truck_url text check (truck_url is null or (char_length(truck_url) <= 1000 and truck_url ~ '^https?://')),
  gear_text text not null default '' check (char_length(gear_text) <= 3500),
  gear_url text check (gear_url is null or (char_length(gear_url) <= 1000 and gear_url ~ '^https?://')),
  official_links jsonb not null default '{}'::jsonb check (jsonb_typeof(official_links) = 'object'),
  official_socials jsonb not null default '{}'::jsonb check (jsonb_typeof(official_socials) = 'object'),
  announcement_enabled boolean not null default false,
  announcement_id text not null default '' check (
    announcement_id = ''
    or announcement_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  announcement_text text not null default '' check (char_length(announcement_text) <= 2000),
  announcement_url text check (
    announcement_url is null
    or (char_length(announcement_url) <= 1000 and announcement_url ~ '^https?://')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not live_is_live or live_verified),
  check (
    not announcement_enabled
    or (announcement_id <> '' and announcement_text <> '')
  )
);

alter table public.discord_community_feed enable row level security;

revoke all privileges on table public.discord_community_feed
  from public, anon, authenticated;
grant select, insert, update, delete on table public.discord_community_feed
  to service_role;

insert into public.discord_community_feed (singleton)
values (true)
on conflict (singleton) do nothing;
