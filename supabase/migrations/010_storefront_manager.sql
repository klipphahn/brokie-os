create table if not exists storefront_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique default 'primary',
  site_name text not null default 'the brokie',
  shop_domain text not null default 'shop.thebrokie.com',
  announcement_text text not null default '',
  hero_eyebrow text not null default '',
  hero_headline text not null default '',
  hero_subheadline text not null default '',
  primary_cta_label text not null default 'SHOP THE DROP',
  primary_cta_url text not null default '/collections/the-brokie-featured',
  secondary_cta_label text not null default 'OUR STORY',
  secondary_cta_url text not null default 'https://thebrokie.com',
  manifesto_headline text not null default '',
  manifesto_body text not null default '',
  collection_title text not null default 'The Brokie Featured',
  collection_handle text not null default 'the-brokie-featured',
  collection_description text not null default '',
  shopify_collection_id text,
  palette jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists storefront_featured_products (
  id uuid primary key default gen_random_uuid(),
  shopify_product_id text not null unique,
  position integer not null default 0,
  badge text not null default '',
  display_title text not null default '',
  display_subtitle text not null default '',
  product_title text not null,
  product_handle text not null,
  product_url text,
  image_url text,
  image_alt text,
  min_price numeric(12,2),
  max_price numeric(12,2),
  currency_code text not null default 'USD',
  shopify_status text not null default 'ACTIVE',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storefront_featured_position_idx
  on storefront_featured_products(active, position);

insert into storefront_settings (
  key,
  site_name,
  shop_domain,
  announcement_text,
  hero_eyebrow,
  hero_headline,
  hero_subheadline,
  manifesto_headline,
  manifesto_body,
  collection_description,
  palette
)
values (
  'primary',
  'the brokie',
  'shop.thebrokie.com',
  'FOUNDERS DROP 001 — BUILT FOR THE PEOPLE STILL BUILDING',
  'THE BROKIE GOODS',
  'WE DON''T NEED MONEY TO BE DANGEROUS.',
  'Premium workwear and streetwear for builders, creators, and people earning what comes next.',
  'BROKE TODAY. BUILDING FOREVER.',
  'We build. We sacrifice. We stay loyal. We keep showing up.',
  'The latest pieces selected by The Brokie. Built for the people still building.',
  '{"background":"#080808","panel":"#151515","orange":"#ff4f00","gold":"#ffc107","text":"#ffffff","muted":"#9a9a9a"}'::jsonb
)
on conflict (key) do nothing;

alter table storefront_settings enable row level security;
alter table storefront_featured_products enable row level security;
