alter table products
  add column if not exists printful_sync_product_id text,
  add column if not exists printful_external_product_id text,
  add column if not exists printful_store_id text,
  add column if not exists printful_catalog_product_id integer,
  add column if not exists printful_catalog_product_name text,
  add column if not exists printful_product_url text,
  add column if not exists printful_variant_count integer not null default 0,
  add column if not exists printful_synced_variant_count integer not null default 0,
  add column if not exists printful_last_verified_at timestamptz,
  add column if not exists printful_error text,
  add column if not exists printful_details jsonb not null default '{}'::jsonb;

create table if not exists printful_variant_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  printful_sync_variant_id text not null,
  external_variant_id text,
  catalog_variant_id integer,
  catalog_product_id integer,
  variant_name text,
  color text,
  size text,
  synced boolean not null default false,
  artwork_ready boolean not null default false,
  retail_price numeric(12,2),
  details jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(product_id, printful_sync_variant_id)
);

create index if not exists printful_variant_links_product_idx
  on printful_variant_links(product_id);

create index if not exists products_printful_sync_product_idx
  on products(printful_sync_product_id);

alter table printful_variant_links enable row level security;
