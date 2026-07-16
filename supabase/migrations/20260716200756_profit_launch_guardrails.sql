create table if not exists profit_guardrail_settings (
  id text primary key default 'primary',
  minimum_margin_percent numeric(5,2) not null default 30.00
    check (minimum_margin_percent >= 0 and minimum_margin_percent < 100),
  target_margin_percent numeric(5,2) not null default 35.00
    check (target_margin_percent >= 0 and target_margin_percent < 100),
  payment_fee_percent numeric(5,2) not null default 2.90
    check (payment_fee_percent >= 0 and payment_fee_percent < 100),
  payment_fee_fixed numeric(12,2) not null default 0.30
    check (payment_fee_fixed >= 0),
  customer_shipping_charge numeric(12,2) not null default 8.00
    check (customer_shipping_charge >= 0),
  fulfillment_shipping_reserve numeric(12,2) not null default 8.49
    check (fulfillment_shipping_reserve >= 0),
  fulfillment_tax_rate_percent numeric(5,2) not null default 9.00
    check (
      fulfillment_tax_rate_percent >= 0
      and fulfillment_tax_rate_percent < 100
    ),
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profit_guardrail_target_not_below_minimum
    check (target_margin_percent >= minimum_margin_percent)
);

insert into profit_guardrail_settings (
  id,
  minimum_margin_percent,
  target_margin_percent,
  payment_fee_percent,
  payment_fee_fixed,
  customer_shipping_charge,
  fulfillment_shipping_reserve,
  fulfillment_tax_rate_percent,
  currency
)
values (
  'primary',
  30.00,
  35.00,
  2.90,
  0.30,
  8.00,
  8.49,
  9.00,
  'USD'
)
on conflict (id) do nothing;

create table if not exists product_profitability (
  product_id uuid primary key references products(id) on delete cascade,
  retail_price numeric(12,2),
  customer_shipping_charge numeric(12,2) not null default 0.00,
  base_production_cost numeric(12,2),
  extra_placement_cost numeric(12,2) not null default 0.00,
  estimated_production_cost numeric(12,2),
  estimated_shipping_cost numeric(12,2),
  estimated_tax numeric(12,2),
  estimated_payment_fee numeric(12,2),
  estimated_total_cost numeric(12,2),
  estimated_revenue numeric(12,2),
  estimated_profit numeric(12,2),
  margin_percent numeric(7,2),
  minimum_retail_price numeric(12,2),
  recommended_retail_price numeric(12,2),
  status text not null default 'needs_cost'
    check (status in ('needs_cost', 'blocked', 'warning', 'ready')),
  cost_source text not null default 'unknown',
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (retail_price is null or retail_price >= 0),
  check (customer_shipping_charge >= 0),
  check (base_production_cost is null or base_production_cost >= 0),
  check (extra_placement_cost >= 0),
  check (estimated_production_cost is null or estimated_production_cost >= 0),
  check (estimated_shipping_cost is null or estimated_shipping_cost >= 0),
  check (estimated_tax is null or estimated_tax >= 0),
  check (estimated_payment_fee is null or estimated_payment_fee >= 0),
  check (estimated_total_cost is null or estimated_total_cost >= 0),
  check (estimated_revenue is null or estimated_revenue >= 0),
  check (minimum_retail_price is null or minimum_retail_price >= 0),
  check (recommended_retail_price is null or recommended_retail_price >= 0)
);

create index if not exists product_profitability_status_idx
  on product_profitability(status, updated_at desc);

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'executed',
        'cancelled',
        'expired',
        'superseded'
      )
    ),
  product_id uuid references products(id) on delete set null,
  title text not null,
  summary text not null default '',
  current_price numeric(12,2),
  proposed_price numeric(12,2),
  current_margin_percent numeric(7,2),
  target_margin_percent numeric(7,2),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  check (current_price is null or current_price >= 0),
  check (proposed_price is null or proposed_price >= 0)
);

create unique index if not exists approval_requests_unique_pending_idx
  on approval_requests(product_id, request_type)
  where status = 'pending' and product_id is not null;

create index if not exists approval_requests_status_created_idx
  on approval_requests(status, created_at desc);

alter table profit_guardrail_settings enable row level security;
alter table product_profitability enable row level security;
alter table approval_requests enable row level security;

revoke all privileges on table profit_guardrail_settings
  from public, anon, authenticated;
revoke all privileges on table product_profitability
  from public, anon, authenticated;
revoke all privileges on table approval_requests
  from public, anon, authenticated;

grant select, insert, update, delete on table profit_guardrail_settings
  to service_role;
grant select, insert, update, delete on table product_profitability
  to service_role;
grant select, insert, update, delete on table approval_requests
  to service_role;
