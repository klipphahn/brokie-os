alter table if exists storefront_featured_products
  add column if not exists product_type text not null default 'tee';

update storefront_featured_products
set product_type = coalesce(nullif(product_type, ''), 'tee')
where product_type is null or product_type = '';
