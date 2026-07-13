create table if not exists factory_runs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete set null,
  name text not null,
  theme text not null,
  audience text not null,
  product_type text not null,
  visual_style text not null,
  mood text not null,
  placement text not null,
  palette text not null,
  colors text[] not null default '{}',
  base_prompt text not null,
  requested_count integer not null check (requested_count between 1 and 50),
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'queued',
  auto_publish boolean not null default false,
  estimated_image_requests integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists factory_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references factory_runs(id) on delete cascade,
  sequence_number integer not null,
  creative_angle text not null,
  prompt text not null,
  status text not null default 'queued',
  design_id uuid references designs(id) on delete set null,
  concept_name text,
  artwork_url text,
  error_message text,
  attempts integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id, sequence_number)
);

create index if not exists factory_runs_status_idx
  on factory_runs(status, created_at desc);

create index if not exists factory_jobs_run_status_idx
  on factory_jobs(run_id, status, sequence_number);

alter table designs
  add column if not exists factory_run_id uuid references factory_runs(id) on delete set null,
  add column if not exists factory_job_id uuid references factory_jobs(id) on delete set null;

create index if not exists designs_factory_run_idx
  on designs(factory_run_id);

alter table factory_runs enable row level security;
alter table factory_jobs enable row level security;
