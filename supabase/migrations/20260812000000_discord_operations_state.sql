create table if not exists public.discord_operations_state (
  guild_id text primary key check (guild_id ~ '^[0-9]{16,24}$'),
  guild_name text not null default '' check (char_length(guild_name) <= 100),
  member_count integer not null default 0 check (member_count >= 0),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.discord_operations_state enable row level security;

revoke all privileges on table public.discord_operations_state
  from public, anon, authenticated;
grant select, insert, update, delete on table public.discord_operations_state
  to service_role;

create index if not exists discord_operations_state_updated_at_idx
  on public.discord_operations_state (updated_at desc);
