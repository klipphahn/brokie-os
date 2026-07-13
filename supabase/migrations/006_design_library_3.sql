alter table designs
  add column if not exists design_dna jsonb not null default '{}'::jsonb,
  add column if not exists color_palette text[] not null default '{}',
  add column if not exists theme text,
  add column if not exists target_audience text,
  add column if not exists visual_style text,
  add column if not exists placement text,
  add column if not exists parent_design_id uuid references designs(id) on delete set null,
  add column if not exists current_version integer not null default 1,
  add column if not exists archived_at timestamptz;

create table if not exists design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references designs(id) on delete cascade,
  version_number integer not null,
  name text not null,
  prompt text,
  artwork_url text,
  thumbnail_url text,
  design_dna jsonb not null default '{}'::jsonb,
  change_note text,
  created_at timestamptz not null default now(),
  unique(design_id, version_number)
);

create table if not exists design_metrics (
  design_id uuid primary key references designs(id) on delete cascade,
  views bigint not null default 0,
  clicks bigint not null default 0,
  orders bigint not null default 0,
  units_sold bigint not null default 0,
  revenue numeric(12,2) not null default 0,
  profit numeric(12,2) not null default 0,
  returns bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists designs_theme_idx on designs(theme);
create index if not exists designs_target_audience_idx on designs(target_audience);
create index if not exists designs_visual_style_idx on designs(visual_style);
create index if not exists designs_parent_design_id_idx on designs(parent_design_id);
create index if not exists designs_archived_at_idx on designs(archived_at);
create index if not exists design_versions_design_id_idx on design_versions(design_id);

insert into design_versions (
  design_id,
  version_number,
  name,
  prompt,
  artwork_url,
  thumbnail_url,
  design_dna,
  change_note
)
select
  d.id,
  1,
  d.name,
  d.prompt,
  d.front_artwork_url,
  d.thumbnail_url,
  coalesce(d.concept, '{}'::jsonb),
  'Imported original design'
from designs d
where not exists (
  select 1
  from design_versions v
  where v.design_id = d.id
);

insert into design_metrics (design_id)
select id from designs
on conflict (design_id) do nothing;

alter table design_versions enable row level security;
alter table design_metrics enable row level security;
