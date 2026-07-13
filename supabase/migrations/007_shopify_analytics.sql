create table if not exists analytics_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'shopify',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  window_start timestamptz,
  orders_seen integer not null default 0,
  orders_saved integer not null default 0,
  items_saved integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_sync_runs_provider_started_idx
  on analytics_sync_runs(provider, started_at desc);

create table if not exists shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  legacy_order_id text,
  order_name text not null,
  processed_at timestamptz not null,
  shopify_created_at timestamptz not null,
  shopify_updated_at timestamptz not null,
  cancelled_at timestamptz,
  financial_status text,
  fulfillment_status text,
  currency_code text not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  shipping numeric(14,2) not null default 0,
  taxes numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  refunded numeric(14,2) not null default 0,
  item_quantity integer not null default 0,
  test boolean not null default false,
  source_name text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists shopify_orders_processed_at_idx
  on shopify_orders(processed_at desc);
create index if not exists shopify_orders_updated_at_idx
  on shopify_orders(shopify_updated_at desc);
create index if not exists shopify_orders_test_idx
  on shopify_orders(test);

create table if not exists shopify_order_items (
  id uuid primary key default gen_random_uuid(),
  shopify_line_item_id text not null unique,
  shopify_order_id text not null
    references shopify_orders(shopify_order_id) on delete cascade,
  shopify_product_id text,
  shopify_variant_id text,
  internal_product_id uuid references products(id) on delete set null,
  title text not null,
  variant_title text,
  sku text,
  quantity integer not null default 0,
  current_quantity integer not null default 0,
  original_unit_price numeric(14,2) not null default 0,
  discounted_unit_price numeric(14,2) not null default 0,
  original_line_total numeric(14,2) not null default 0,
  net_line_revenue numeric(14,2) not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists shopify_order_items_order_idx
  on shopify_order_items(shopify_order_id);
create index if not exists shopify_order_items_product_idx
  on shopify_order_items(shopify_product_id);
create index if not exists shopify_order_items_internal_product_idx
  on shopify_order_items(internal_product_id);

create table if not exists product_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  shopify_product_id text not null,
  internal_product_id uuid references products(id) on delete set null,
  orders integer not null default 0,
  units integer not null default 0,
  gross_sales numeric(14,2) not null default 0,
  net_revenue numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(metric_date, shopify_product_id)
);

create index if not exists product_daily_metrics_date_idx
  on product_daily_metrics(metric_date desc);
create index if not exists product_daily_metrics_product_idx
  on product_daily_metrics(shopify_product_id);

-- RLS remains disabled because Brokie OS accesses these tables only through
-- authenticated server routes using the Supabase service-role key.
