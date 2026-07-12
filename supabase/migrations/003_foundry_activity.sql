alter table designs
  add column if not exists prompt text,
  add column if not exists product_type text,
  add column if not exists concept jsonb,
  add column if not exists favorite boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  title text not null,
  detail text default '',
  status text not null default 'success',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists generation_jobs (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  product_type text not null,
  status text not null default 'queued',
  current_step text default 'Queued',
  progress integer not null default 0 check (progress between 0 and 100),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table activity_logs enable row level security;
alter table generation_jobs enable row level security;
