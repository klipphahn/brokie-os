alter table storefront_settings
  add column if not exists shipping_policy_title text not null default 'Shipping',
  add column if not exists shipping_policy_body text not null default 'Orders are fulfilled by Printful and usually ship after production is complete. You will get tracking as soon as the order leaves the facility.',
  add column if not exists returns_policy_title text not null default 'Returns',
  add column if not exists returns_policy_body text not null default 'Because each item is made to order, returns are limited to damaged, misprinted, or incorrect items. Reach out quickly if something arrives wrong so we can help fix it.',
  add column if not exists fulfillment_note text not null default 'Printed on demand. Fulfilled by Printful. Together we win.';

update storefront_settings
set
  shipping_policy_title = coalesce(nullif(shipping_policy_title, ''), 'Shipping'),
  shipping_policy_body = coalesce(nullif(shipping_policy_body, ''), 'Orders are fulfilled by Printful and usually ship after production is complete. You will get tracking as soon as the order leaves the facility.'),
  returns_policy_title = coalesce(nullif(returns_policy_title, ''), 'Returns'),
  returns_policy_body = coalesce(nullif(returns_policy_body, ''), 'Because each item is made to order, returns are limited to damaged, misprinted, or incorrect items. Reach out quickly if something arrives wrong so we can help fix it.'),
  fulfillment_note = coalesce(nullif(fulfillment_note, ''), 'Printed on demand. Fulfilled by Printful. Together we win.')
where key = 'primary';

