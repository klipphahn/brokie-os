# Brokie web/admin agent guide

## Role and workflow

Cursor handles implementation on a feature branch. Before editing, summarize the
requested outcome and inspect the affected routes, components, server helpers,
and migrations. Do not work directly on `main`. Keep changes focused, run the
quality gates, and leave a review-ready summary with risks and deployment steps.

## Architecture

- Next.js 16 App Router, React 19, and plain JavaScript.
- `app/`: pages and route handlers. Admin/API behavior must fail closed.
- `components/`: client and server UI components.
- `lib/`: auth, Supabase, Shopify, Printful, storefront, and business rules.
- `supabase/migrations/`: ordered production database changes.
- `shopify-theme/`: storefront theme assets; keep separate from Next.js UI.
- Production is the Vercel project `brokie-os`, aliased to
  `https://admin.thebrokie.com`. GitHub `main` is the production branch.

## Commands

- Install: `pnpm install --frozen-lockfile`
- Develop: `pnpm dev`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Run production build: `pnpm start`

Use Node 22 and pnpm. Do not switch package managers or commit another lockfile.

## Coding standards

- Follow existing JavaScript and App Router patterns; do not introduce
  TypeScript as part of an unrelated change.
- Keep authorization checks in shared server helpers and at route boundaries.
- Validate untrusted API input and never expose server credentials to client
  components.
- Preserve public fallback behavior when external services are unavailable.
- Prefer small components and shared business-rule helpers over duplicated route
  logic.
- Add or update a Supabase migration for schema changes; never edit production
  data manually as a substitute for a migration.

## Secrets and deployment

- Never read, print, commit, or rewrite `.env.local`, `.env.production.local`, or
  backup env files.
- External integrations include Supabase, Shopify, Printful, OpenAI, and Vercel.
- A pull request must pass lint and build before merge. Database migrations and
  required Vercel variables must be called out explicitly in the handoff.
- Do not deploy or promote production unless the user explicitly asks.
