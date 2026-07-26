-- Adds an advisory/enforced switch to the profit guardrail.
--
-- When enforce_minimum_margin is true (default, unchanged behavior) the minimum
-- margin is a hard launch block and Brokie OS auto-creates price-change
-- approvals. When false the guardrail is advisory: margin and profit are still
-- calculated and displayed, but launches are never blocked and no forced
-- price-change approvals are created — so retail prices can be set freely, the
-- way they are on the Printful dashboard.

alter table profit_guardrail_settings
  add column if not exists enforce_minimum_margin boolean not null default true;
