-- Brokie OS accesses these operational tables exclusively from authenticated
-- Next.js server routes using the Supabase service-role key. Enabling RLS with
-- no public policies blocks direct anonymous/authenticated Data API access and
-- does not restrict the service role.

alter table if exists design_versions enable row level security;
alter table if exists design_metrics enable row level security;
alter table if exists analytics_sync_runs enable row level security;
alter table if exists shopify_orders enable row level security;
alter table if exists shopify_order_items enable row level security;
alter table if exists product_daily_metrics enable row level security;
alter table if exists printful_variant_links enable row level security;
alter table if exists factory_runs enable row level security;
alter table if exists factory_jobs enable row level security;
