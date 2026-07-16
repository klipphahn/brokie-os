alter table if exists storefront_featured_products
  add column if not exists product_type text not null default 'tee',
  add column if not exists family text not null default 'apparel';

update storefront_featured_products
set
  product_type = case
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%hoodie%'
      or lower(coalesce(nullif(display_title, ''), product_title, '')) like '%pacheco%'
      then 'hoodie'
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%crop%'
      then 'crop-top'
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%hat%'
      or lower(coalesce(nullif(display_title, ''), product_title, '')) like '%cap%'
      or lower(coalesce(nullif(display_title, ''), product_title, '')) like '%beanie%'
      then 'hat'
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%sticker%'
      then 'sticker'
    else coalesce(nullif(product_type, ''), 'tee')
  end,
  family = case
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%hat%'
      or lower(coalesce(nullif(display_title, ''), product_title, '')) like '%cap%'
      or lower(coalesce(nullif(display_title, ''), product_title, '')) like '%beanie%'
      then 'headwear'
    when lower(coalesce(nullif(display_title, ''), product_title, '')) like '%sticker%'
      then 'sticker'
    else 'apparel'
  end;
