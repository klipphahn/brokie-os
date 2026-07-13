# Brokie OS v1

A clean Next.js App Router project for The Brokie brand.

## Why this build is different

- JavaScript instead of TypeScript, eliminating the prior TypeScript build failure
- Minimal pinned dependencies
- Printful connection test
- Printful synced-product dry-run and creation route
- Shopify Admin GraphQL connection test
- Supabase connection test and starter schema
- Founders Collection product builder
- Vercel-ready configuration

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Production build check

Always run this before pushing:

```bash
npm run build
```

## Vercel variables

Add these in Vercel → Project Settings → Environment Variables:

```text
PRINTFUL_TOKEN
PRINTFUL_STORE_ID
SHOPIFY_STORE_DOMAIN
SHOPIFY_ADMIN_ACCESS_TOKEN
SHOPIFY_API_VERSION
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Only Printful is required for the Printful builder. Shopify and Supabase can be connected afterward.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL Editor.

## Printful safety workflow

1. Select only the first tee.
2. Use one valid Printful catalog variant ID.
3. Supply public HTTPS artwork URLs.
4. Run Dry Test.
5. Inspect the payload.
6. Create the Printful product.
7. Verify it appears correctly in Printful and Shopify before creating more products.

## GitHub replacement workflow

This project is intended to replace the files in the existing `brokie-os` repository. Preserve your local `.env.local`, but never commit it.


## v1.1 Premium update

Adds Brand DNA, Design Library preview uploads, AI Studio collection planning, and Publish Center.


## v1.2 Shopify Sync

Uses Shopify client credentials to obtain a short-lived access token and display products from the Admin GraphQL API.

## v1.3 Live AI Product Studio

The AI Studio now calls OpenAI from a server-only route, creates structured merch copy, generates transparent PNG artwork, and uploads the result to the public Supabase `artwork` bucket when Supabase credentials are configured.

Required Vercel variable:

```text
OPENAI_API_KEY
```

Optional model overrides:

```text
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_IMAGE_MODEL=gpt-image-2
```

The API key is never sent to browser code. Image generation incurs OpenAI API usage charges.

## v1.3.1 Transparency compatibility fix

AI Studio now attempts native transparent output first. If the configured image model rejects transparent backgrounds, it automatically regenerates on pure black and removes that background server-side with `sharp`, producing a transparent PNG before Supabase upload.

## v1.4 Admin Authentication

Brokie OS is now protected with Supabase email/password authentication.

### Required setup

1. In Supabase, open **Authentication → Users → Add user**.
2. Create the administrator with the same email as `ADMIN_EMAIL`.
3. Set a strong password and mark the email as confirmed.
4. In Supabase **Authentication → Providers → Email**, disable public sign-ups if this is a private admin application.
5. Add this Vercel variable and redeploy:

```text
ADMIN_EMAIL=klipphahn@gmail.com
```

The proxy protects the dashboard and API routes, including AI generation. Unauthenticated API requests receive HTTP 401 instead of spending OpenAI tokens.


## v1.5 Foundry + Library Stabilization

Adds Foundry, visible generation stages, persistent Design Library 2.0, favorites/search/delete, and an activity log. Run `supabase/migrations/003_foundry_activity.sql` before deploying.


## v1.6 Foundry 2.0

Adds structured creative direction:

- product type
- audience
- visual style
- mood
- print placement
- approved color palette
- 1, 2, or 4 generated variations
- side-by-side comparison
- favorites and selected-concept workspace

Every variation is saved separately to the existing Supabase Design Library and activity log.

### Cost control

Each variation uses one text concept request and one image-generation request. Start with two variations and only use four when the direction is worth exploring.


## v1.7 Publisher

Run `supabase/migrations/004_publisher.sql` before using Publisher.

Publisher provides an idempotent review workflow:

1. Save reviewed metadata.
2. Create or update one Shopify draft per design.
3. Set its first/default Shopify variant price.
4. Activate the Shopify product after approval.
5. Preserve Shopify IDs and successful steps for retries.
6. Record all attempts in publish runs and the activity log.

### Printful limitation

The Printful synced-product creation endpoint does not apply to a normal Shopify-connected Printful store. Publisher therefore tracks Printful as a required manual fulfillment checkpoint instead of falsely claiming it can attach the product automatically. Configure the product in Printful before taking orders.


## v1.8 Store Launch

Adds a guarded Shopify Online Store launch pipeline:

1. Review metadata
2. Create or update the Shopify product
3. Confirm Printful fulfillment manually
4. Activate the Shopify product
5. Discover the Online Store publication
6. Publish using `publishablePublish`
7. Verify and save the storefront URL
8. Record every step in Supabase

### Shopify permissions required

The Shopify app now needs:

- `read_products`
- `write_products`
- `read_publications`
- `write_publications`

Release a new Shopify app version with those scopes and approve the updated installation before testing Store Launch.

### Printful safety gate

Brokie OS does not claim that Printful was configured automatically. The launch button remains disabled until the administrator explicitly confirms the synced Printful product, variants, placement, pricing, and fulfillment setup.


## v1.9 Design Library 3.0

The Design Library is now a full creative asset manager.

### Features

- Semantic-style search across names, prompts, tags, themes, audiences, styles, placements, and colors
- Filters for status, product type, audience, style, and theme
- Grid and list views
- Favorites and archive
- Full Design DNA editing
- Product and Shopify linkage
- Version history
- Duplicate, archive, restore, and permanent delete actions
- Performance-ready metrics for views, clicks, orders, revenue, profit, and returns
- Automatic Design DNA fields for newly generated Foundry concepts

### Database preparation

Run:

```sql
supabase/migrations/006_design_library_3.sql
```

before loading the new library.

Analytics values begin at zero. Later Shopify order and storefront event synchronization can populate the metrics table without changing the Design Library data model.


## v2.0.1 Shopify Sales Intelligence

This is the first working Performance Engine release.

### Included

- Manual Shopify order synchronization
- Incremental sync with a one-day overlap for edited/refunded orders
- Optional 12-month rebuild
- Order and line-item storage in Supabase
- Revenue, order, unit, refund, and average-order-value cards
- Revenue trend chart
- Top-product leaderboard
- Recent-order feed
- Sync history and plain-English errors
- Automatic updates to Design Library performance metrics

### Shopify scopes

The installed app must have:

- `read_orders`
- `read_all_orders`
- `read_products`
- `write_products`
- `read_publications`
- `write_publications`

### Notes

- Test orders are stored for auditing but excluded from dashboard totals.
- Product-level revenue uses Shopify line-item values after discounts and current returns/removals.
- Profit is intentionally not estimated yet. It will be added after Printful cost synchronization.
- Customer names, email addresses, phone numbers, and postal addresses are not stored by this release.


## v2.1 Printful Fulfillment Bridge

This release replaces the manual Printful checkbox with API-backed detection,
configuration, and verification for Shopify-connected Printful products.

### Workflow

1. Brokie OS creates or updates the Shopify product.
2. Printful imports the product from Shopify.
3. **Detect imported product** resolves it by Shopify external product ID.
4. **Configure Printful**:
   - locates Comfort Colors 1717 in the Printful catalog,
   - matches imported variant names to catalog color/size variants,
   - assigns the public front artwork,
   - sets the retail price,
   - updates each Printful sync variant.
5. **Verify fulfillment** checks that every imported variant:
   - has a Printful catalog variant,
   - is marked synced,
   - has artwork attached.
6. Store Launch remains disabled until verification passes.

### Required environment variables

- `PRINTFUL_TOKEN`
- `PRINTFUL_STORE_ID`

Optional defaults:

- `PRINTFUL_DEFAULT_BLANK=Comfort Colors 1717`
- `PRINTFUL_DEFAULT_COLOR=Black`
- `PRINTFUL_DEFAULT_SIZE=M`

### Important behavior

Printful does not import Shopify product changes instantly. The bridge handles
"not imported yet" as a waiting state and provides a direct Printful dashboard
link. The legacy `/api/printful/products` create-product route is retired
because it targets Manual Order/API stores rather than a Shopify-connected
store.


## v2.2 Design Factory

Design Factory creates an entire collection as a controlled, resumable queue.

### Capabilities

- Queue 5, 10, 15, or 25 designs
- Create a Supabase collection automatically
- Assign a unique creative angle to each design
- Generate one design at a time through the existing Foundry engine
- Save each result directly to Design Library
- Link designs to the factory run and collection
- Pause or stop after the current generation
- Resume later
- Retry failed jobs
- Cancel a run
- Track completed, failed, and remaining jobs
- Show artwork previews as jobs complete
- Estimate image and concept request volume before starting

### Safety

Design Factory does not automatically publish products live. Finished artwork is
saved for review in Design Library. Publisher and Printful verification remain
the controlled path to storefront launch.
