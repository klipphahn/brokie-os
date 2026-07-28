-- Adds an advisory/enforced switch to the profit guardrail.
--
-- When enforce_minimum_margin is true (default, unchanged behavior) the minimum
-- margin is a hard launch block and Brokie OS auto-creates price-change
-- approvals. When false the margin floor is advisory: margin and profit are
-- still calculated and displayed, a below-floor "blocked" status does not stop
-- launch or force price-change approvals, and retail prices can be set freely
-- like the Printful dashboard — but missing cost/profitability data
-- (needs_cost) still fails closed and blocks launch.

alter table profit_guardrail_settings
  add column if not exists enforce_minimum_margin boolean not null default true;
