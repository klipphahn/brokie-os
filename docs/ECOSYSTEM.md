# Brokie ecosystem

These repositories have distinct deployment and ownership boundaries. Code
should stay in the repository that owns the behavior instead of copying
business logic between applications.

## Canonical repositories

- [`thebrokie-com`](https://github.com/klipphahn/thebrokie-com) is the public
  website. It presents customer-facing brand, storefront, and community
  experiences and consumes public feeds rather than control-plane credentials.
- [`brokie-os`](https://github.com/klipphahn/brokie-os) is the Vercel and
  Supabase control plane at `admin.thebrokie.com`. It owns admin authentication,
  operational workflows, public feed production, and integrations with
  Supabase, Shopify, Printful, and cloud AI providers.
- [`brokie-mobile`](https://github.com/klipphahn/brokie-mobile) is the
  authenticated iOS and Android operator app. Its canonical Brokie OS endpoint
  is `/api/mobile/app`.
- [`brokie-discord`](https://github.com/klipphahn/brokie-discord) is the
  Proxmox-hosted community automation bot. It owns Discord-specific bot and
  community automation behavior, not the public website or Brokie OS admin UI.
- [`brokie-command-center`](https://github.com/klipphahn/brokie-command-center)
  is the Windows/local fleet hub. It owns local worker orchestration and the
  operator-facing command-center tooling.
- **Brokie AI/local bridge** is the private inference and automation service
  boundary. `brokie-os` owns its authenticated cloud-facing `/api/local-ai/*`
  adapters; `brokie-command-center` owns the Windows/local fleet side. It is
  not a public browser API and must not expose local credentials or inference
  services directly.

## Public contracts

### Storefront feed

`brokie-os` owns `GET /api/storefront/featured`. The public site and Shopify
theme integrations may consume it cross-origin.

- The current success payload uses `schemaVersion: "1.2"` and contains
  `storefront`, `products`, `brain`, and `launch`.
- A successful read returns HTTP 200. An unavailable feed returns HTTP 503 with
  `{ "ok": false, "error": "..." }`.
- Responses allow public cross-origin reads, use `Cache-Control: no-store`, and
  are read-only. Consumers must not infer write access from this public route.
- `/merch` is the canonical Brokie OS storefront page. The historical
  `/storefront` page permanently redirects to `/merch`.

### Community feed

`brokie-os` owns public `GET` and `OPTIONS` requests at
`/api/community/discord`.

- The payload uses `schemaVersion: "1.0"` and includes verified live status,
  community information, official links and socials, announcements, published
  drops, and verified merch statistics.
- Public reads are cross-origin and never cached. If Supabase or storefront
  data is unavailable, GET still returns HTTP 200 with the safe inactive
  fallback contract.
- `POST /api/community/discord` is an authenticated Brokie OS control-plane
  write. It is not part of the public read contract, and authentication occurs
  before request-body parsing.

Consumers should branch on `schemaVersion` and `ok`, tolerate documented
fallbacks, and avoid depending on fields that are not part of these payloads.

## Protected ecosystem health contract

`GET /api/ecosystem/health` is a Brokie OS control-plane read. It is not a
public feed.

- Authentication uses `requireAdminApiUser`. Unauthenticated calls fail closed
  with HTTP 401. Unauthorized admin emails fail closed with HTTP 403.
- Successful responses are JSON with `Cache-Control: private, no-store` and
  `X-Content-Type-Options: nosniff`. The collector never writes to downstream
  systems.
- The payload uses `schemaVersion: "1.0"` and includes aggregate `status`,
  `checkedAt`, `latencyMs`, and a `checks` array. `ok: true` means the health
  document itself was produced; ecosystem `status` is `healthy`, `degraded`,
  or `unconfigured`.
- Phase 1 probes the public website, storefront feed, community feed, and
  mobile API reachability in parallel with a bounded timeout. Internal Brokie OS
  probes use the canonical origin `https://admin.thebrokie.com` and never take
  a probe target from the request `Host` header. An unauthenticated HTTP 401
  from `/api/mobile/app` counts as reachable. Public feed probes validate the
  documented response shapes.
- Discord bot health uses the existing private `discord_operations_state`
  heartbeat written by the Proxmox-hosted bot. A heartbeat no more than 15
  minutes old is healthy; missing, stale, or unavailable heartbeat data is
  degraded. This keeps the bot's host-local `/health` listener private. Local
  bridge uses the existing Brokie AI
  session credentials (`BROKIE_AI_BASE_URL`, `CF_ACCESS_CLIENT_ID`,
  `CF_ACCESS_CLIENT_SECRET`, `BROKIE_AI_CONSOLE_KEY`) and the existing
  `/api/ai/session` read. Missing optional configuration is `unconfigured`,
  not `healthy`.
- Responses must not include credentials, probe target URLs, or other
  connection details. Operators should treat `degraded` as an honest outage or
  contract mismatch, not as a missing dashboard.

## Authenticated dashboard

The Brokie Command Center on the admin dashboard (`#system-command-center`)
renders this contract for signed-in operators. It does not add a separate
health page.

- On load and refresh, the UI fetches `GET /api/ecosystem/health` and
  `GET /api/local-ai/system` in parallel. Ecosystem and local Brokie AI/Proxmox
  snapshots stay independent: one source can fail without clearing the other,
  and refresh keeps the last good snapshot visible.
- A prominent ecosystem summary sits above the existing whole-system
  categories. It shows aggregate status, checked time, total probe latency,
  healthy/degraded/unconfigured counts, and the six service cards. Ecosystem
  and local status pills stay independent; the outer command-center frame uses
  the worse of the two (critical, then degraded/warning, then
  unknown/unconfigured, then healthy).
- Each card shows `healthy`, `degraded`, or `unconfigured`, plus latency and
  HTTP status when present, and the redacted detail text. Missing or malformed
  payload fields are normalized instead of crashing the view.
- Unconfigured is not healthy. Local bridge stays unconfigured until Brokie AI
  session credentials are set. The dashboard explains that action instead of
  inventing probe targets.

## Temporary mobile compatibility route

`GET /api/mobile/app` and `POST /api/mobile/app` are the canonical
authenticated operator API. The shipped mobile app may still call the former
`/api/mobile/dashboard` path, so Brokie OS temporarily exposes:

- `GET /api/mobile/dashboard`
- `POST /api/mobile/dashboard`

Both handlers delegate directly to the matching `/api/mobile/app` handler.
They preserve its authentication, request handling, response body, status, and
existing headers, then add:

```text
Deprecation: @1786838400
Link: </api/mobile/app>; rel="successor-version"
```

The `Deprecation` value is the RFC 9745 structured date for August 16, 2026.
No removal date is currently promised. `brokie-mobile` should migrate to
`/api/mobile/app`; new consumers must not adopt the compatibility path.
