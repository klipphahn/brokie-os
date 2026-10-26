import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { CommunityDiscordFeedSchema, safeCommunityDiscordFeed } from "./community-discord.js";

test("maintenance GET preserves the fallback and headers without invoking upstream clients", async () => {
  const calls = [];
  const forbidden = (name) => () => {
    calls.push(name);
    throw new Error(`Unexpected upstream call: ${name}`);
  };
  // Evaluate the actual route, replacing imports with controlled dependencies.
  const source = readFileSync(new URL("../app/api/community/discord/route.js", import.meta.url), "utf8")
    .replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, "")
    .replace(/export async function/g, "async function");
  const { GET } = runInNewContext(`${source}\n({ GET });`, {
    NextResponse: { json: (body, options) => Response.json(body, options) },
    safeCommunityDiscordFeed,
    tryCreateSupabaseAdminClient: forbidden("Supabase public-feed client"),
    createSupabaseAdminClient: forbidden("Supabase admin client"),
    loadStorefrontFeed: forbidden("storefront/Supabase/Shopify loader"),
    buildCommunityDiscordFeed: forbidden("live feed builder"),
    fetch: forbidden("network fetch"),
    requireAdminApiUser: forbidden("admin auth")
  });
  const response = await GET();
  assert.deepEqual(calls, []);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, safeCommunityDiscordFeed());
  assert.equal(CommunityDiscordFeedSchema.safeParse(body).success, true);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0, must-revalidate");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
});
