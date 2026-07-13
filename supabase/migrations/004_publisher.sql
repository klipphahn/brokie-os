create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  thumbnail_url text,
  mime_type text default 'image/png',
  asset_type text not null default 'artwork',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists design_assets (
  design_id uuid not null references designs(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  placement text not null default 'front',
  sort_order integer not null default 0,
  primary key (design_id, asset_id, placement)
);

alter table products
  add column if not exists seo_title text,
  add column if not exists meta_description text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists shopify_handle text,
  add column if not exists shopify_admin_url text,
  add column if not exists printful_status text not null default 'not_configured',
  add column if not exists publish_error text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_design_id_unique
  on products(design_id)
  where design_id is not null;

alter table publish_runs
  add column if not exists step text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

alter table assets enable row level security;
alter table design_assets enable row level security;
