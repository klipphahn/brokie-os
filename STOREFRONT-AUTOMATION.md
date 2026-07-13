# The Brokie storefront automation

This release makes Brokie OS the source of truth for the public merch experience.

## What is automated

- Homepage announcement, hero, calls to action, and manifesto
- Selection and ordering of up to eight real Shopify products
- Public, cacheable product feed for `thebrokie.com` and Shopify Flora
- Creation and updating of a Shopify featured collection
- Publication of that collection to Shopify's Online Store
- Live product images, prices, titles, and links in Flora

## One-time database setup

Run `supabase/migrations/010_storefront_manager.sql` in the Supabase SQL Editor.

## One-time Flora setup

Pull the duplicated Flora theme with Shopify CLI. From Windows PowerShell, install the section into that local theme:

```powershell
./scripts/install-flora-section.ps1 -ThemePath "C:\path\to\the-brokie-flora"
```

Push the duplicate theme without publishing it. In Shopify's visual editor, open the merch template, add **Brokie OS merch feed**, and set its feed URL to:

```text
https://admin.thebrokie.com/api/storefront/featured
```

Preview desktop and mobile, then publish the duplicate theme when approved.

## Day-to-day use

1. Open **Storefront** in Brokie OS.
2. Edit the hero and brand message.
3. Choose and order featured Shopify products.
4. Click **Save feed**.
5. Click **Sync Shopify collection** when the collection membership changes.

Flora and any `thebrokie.com` merch block using the public feed update automatically. Direct theme-file writes are intentionally not required for routine updates.

## Connect the existing thebrokie.com merch page

Add this once where the merch cards should appear:

```html
<div data-brokie-merch></div>
<script defer src="https://admin.thebrokie.com/storefront/brokie-merch-embed.js"></script>
```

The widget is isolated from the site's existing styles and reads the same public feed as Flora. New featured products and copy updates then appear without editing the main site again.
