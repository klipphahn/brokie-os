update public.storefront_settings
set
  announcement_text = 'THE BROKIE — TOGETHER WE WIN',
  hero_subheadline = 'Independent streetwear for people betting on themselves—and each other.',
  manifesto_headline = 'TOGETHER WE WIN.',
  manifesto_body = 'The Brokie is bigger than one person or one path. We move together, celebrate every win, and make our own definition of success.',
  fulfillment_note = 'Printed on demand. Fulfilled by Printful. Together we win.',
  collection_description = 'The latest pieces selected by The Brokie. Bold, independent, and made for the whole community.',
  updated_at = now()
where key = 'primary';
