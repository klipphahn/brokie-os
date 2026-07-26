# AGENTS.md

## Cursor Cloud specific instructions

Brokie OS is a single **Next.js 16 App Router** app (plain JavaScript, not TypeScript) managed with **pnpm** on **Node 22**. Scripts live in `package.json`: `pnpm dev` (Turbopack, port 3000), `pnpm build`, `pnpm start`. There is no lint or automated-test setup in this repo.

- Run the app in dev with `pnpm dev` and open `http://localhost:3000`. The update script already runs `pnpm install`.
- Copy env before running if you need external integrations: `cp -n .env.example .env.local` (git-ignored). The app boots fine without it.
- `sharp` ships prebuilt binaries. `pnpm install` prints an "Ignored build scripts: sharp" warning — this is expected and does NOT need `pnpm approve-builds`; image processing works anyway.
- External services (Supabase, Shopify, Printful, OpenAI) are **cloud-only**; there is no local DB/Docker. Their credentials are not in the repo/env by default.
  - Without Supabase creds: admin/dashboard routes redirect to `/login` and non-public API routes return HTTP 401 (see `lib/supabase/proxy.js`). This is expected, not a bug.
  - The public storefront works without any creds: `/merch` and `GET /api/storefront/featured` render via a graceful fallback feed (`lib/storefront-feed.js`).
- Public (no-auth) paths: `/login`, `/merch`, `/storefront`, `/api/auth/*`, `/api/storefront/featured`, `/api/cron/*`.
- To exercise the admin dashboard / AI generation / Shopify / Printful end to end, fill `.env.local` with real credentials and, in Supabase, create an auth user whose email matches `ADMIN_EMAIL` (default `klipphahn@gmail.com`). The login route rejects any other email locally with a 403 before touching Supabase.
- Cron routes require `Authorization: Bearer <CRON_SECRET>`.
