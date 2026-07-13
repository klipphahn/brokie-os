alter table products
  add column if not exists online_store_publication_id text,
  add column if not exists online_store_published boolean not null default false,
  add column if not exists online_store_url text,
  add column if not exists printful_confirmed_at timestamptz,
  add column if not exists launched_at timestamptz;

create index if not exists products_online_store_published_idx
  on products(online_store_published);
