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
