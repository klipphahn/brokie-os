# Install & migration history

Historical, version-by-version upgrade notes for Brokie OS. These were
previously kept as individual `INSTALL-V*.txt` files in the repository root
and are consolidated here.

The project uses **pnpm**. For a normal upgrade, preserve `.git`, `.env.local`,
`node_modules`, `.next`, and `pnpm-lock.yaml`, then run:

```bash
pnpm install
pnpm build
pnpm dev
```

Some releases needed a `rm -rf .next` before `pnpm build` to clear a stale
prerender cache (see the hotfixes below).

## Supabase migrations by version

Run each SQL file in the Supabase SQL Editor **before** deploying that version.
Analytics, Printful, and Design Factory tables are server-only — leave RLS
disabled on them (the routes use the Supabase service-role key).

| Version | Migration to run |
|---------|------------------|
| v1.5 | `supabase/migrations/003_foundry_activity.sql` |
| v1.7 | `supabase/migrations/004_publisher.sql` |
| v1.8 | `supabase/migrations/005_store_launch.sql` |
| v1.9 | `supabase/migrations/006_design_library_3.sql` |
| v2.0.1 | `supabase/migrations/007_shopify_analytics.sql` |
| v2.1 | `supabase/migrations/008_printful_bridge.sql` |
| v2.2 | `supabase/migrations/009_design_factory.sql` |

## Shopify scope changes

- **v1.8** — add `read_publications` and `write_publications` (keep
  `read_products` / `write_products`). Release a new Shopify app version and
  approve the updated access.
- **v2.0.1** — analytics additionally relies on `read_orders` and
  `read_all_orders` (see `README.md`).

## Printful configuration (v2.1+)

Confirm these environment variables are set (Vercel and `.env.local`):

- `PRINTFUL_TOKEN`
- `PRINTFUL_STORE_ID`

Optional defaults:

- `PRINTFUL_DEFAULT_BLANK=Comfort Colors 1717`
- `PRINTFUL_DEFAULT_COLOR=Black`
- `PRINTFUL_DEFAULT_SIZE=M`

## Hotfix notes

- **v2.2.1** — Design Factory is loaded browser-only via `next/dynamic` (SSR
  disabled) to fix a prerender `ReferenceError: Cannot access 'O' before
  initialization`. Run `rm -rf .next && pnpm build`. No new migration if
  `009_design_factory.sql` already ran.
- **v2.2.2** — replaced the newly added Lucide `Factory` icon (which pulled into
  the server-prerendered sidebar graph) with the stable `PackagePlus` icon. No
  migration. Run `rm -rf .next && pnpm build`.
- **v2.2.3** — fixed a Publisher temporal-dead-zone prerender crash (`current`
  was referenced before initialization by the Printful loader/effect). No
  migration. Run `rm -rf .next && pnpm build`.
