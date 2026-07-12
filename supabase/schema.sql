create extension if not exists "pgcrypto";

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text default '',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete set null,
  name text not null,
  front_artwork_url text,
  back_artwork_url text,
  thumbnail_url text,
  status text not null default 'needs_artwork',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  design_id uuid references designs(id) on delete set null,
  collection_id uuid references collections(id) on delete set null,
  title text not null,
  description text default '',
  product_type text not null,
  retail_price numeric(10,2) not null,
  printful_sync_product_id bigint,
  shopify_product_id text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  printful_catalog_variant_id bigint not null,
  printful_sync_variant_id bigint,
  color text,
  size text,
  sku text,
  retail_price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists publish_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  provider text not null,
  status text not null,
  response jsonb,
  created_at timestamptz not null default now()
);

alter table collections enable row level security;
alter table designs enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table publish_runs enable row level security;
