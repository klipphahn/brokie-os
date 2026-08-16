import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { safeCommunityDiscordFeed } from "./community-discord.js";
import {
  aggregateEcosystemStatus,
  BROKIE_OS_ORIGIN,
  collectEcosystemHealth,
  isValidCommunityFeed,
  isValidStorefrontFeed,
  redactSensitiveText
} from "./ecosystem-health.js";

const ORIGIN = "https://admin.example.test";
const WEBSITE_URL = "https://website.example.test/";
const DISCORD_BOT_URL = "https://discord-bot.example.test/health";
const BRIDGE_BASE = "https://bridge.example.test";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function htmlResponse(status = 200) {
  return new Response("<!doctype html>", {
    status,
    headers: { "Content-Type": "text/html" }
  });
}

function validStorefrontFeed() {
  return {
    ok: true,
    schemaVersion: "1.2",
    storefront: { title: "Merch" },
    products: [],
    brain: { mood: "brokie" },
    launch: { ready: 0, blocked: 0, live: 0 }
  };
}

function assertNoTargetUrls(report) {
  const serialized = JSON.stringify(report);
  for (const token of [
    ORIGIN,
    "admin.example.test",
    WEBSITE_URL,
    "website.example.test",
    DISCORD_BOT_URL,
    "discord-bot.example.test",
    BRIDGE_BASE,
    "bridge.example.test",
    "cf-access-secret",
    "console-key-value",
    "super-secret-token"
  ]) {
    assert.equal(
      serialized.includes(token),
      false,
      `report leaked ${token}`
    );
  }
}

function routeFor(url) {
  const parsed = new URL(url);
  return `${parsed.host}${parsed.pathname}`;
}

describe("ecosystem health collection", () => {
  it("reports healthy checks, latency, and checkedAt without target URLs", async () => {
    const calls = [];
    const checkedAt = new Date("2026-08-16T17:00:00.000Z");
    const report = await collectEcosystemHealth({
      origin: ORIGIN,
      websiteUrl: WEBSITE_URL,
      now: () => checkedAt,
      env: {},
      async fetch(url, init) {
        calls.push({ url: String(url), method: init?.method, headers: init?.headers });
        const key = routeFor(url);
        if (key === "website.example.test/") return htmlResponse(200);
        if (key === "website.example.test") return htmlResponse(200);
        if (key === "admin.example.test/api/storefront/featured") {
          return jsonResponse(validStorefrontFeed());
        }
        if (key === "admin.example.test/api/community/discord") {
          return jsonResponse(safeCommunityDiscordFeed());
        }
        if (key === "admin.example.test/api/mobile/app") {
          return jsonResponse({ ok: false, error: "Authentication required" }, 401);
        }
        throw new Error(`unexpected ${url}`);
      }
    });

    assert.equal(report.ok, true);
    assert.equal(report.schemaVersion, "1.0");
    assert.equal(report.status, "healthy");
    assert.equal(report.checkedAt, "2026-08-16T17:00:00.000Z");
    assert.equal(typeof report.latencyMs, "number");
    assert.equal(report.checks.length, 6);
    assert.deepEqual(
      report.checks.map((check) => [check.id, check.status]),
      [
        ["website", "healthy"],
        ["storefrontFeed", "healthy"],
        ["communityFeed", "healthy"],
        ["mobileApi", "healthy"],
        ["discordBot", "unconfigured"],
        ["localBridge", "unconfigured"]
      ]
    );
    assert.equal(
      report.checks.find((check) => check.id === "mobileApi").httpStatus,
      401
    );
    assert.equal(
      report.checks.find((check) => check.id === "discordBot").latencyMs,
      null
    );
    assert.equal(calls.every((call) => call.method === "GET"), true);
    assert.equal(
      calls.some((call) => String(call.url).includes("/api/ai/session")),
      false
    );
    assertNoTargetUrls(report);
  });

  it("marks independent failures as degraded and aggregates degraded status", async () => {
    const report = await collectEcosystemHealth({
      origin: ORIGIN,
      websiteUrl: WEBSITE_URL,
      env: {},
      async fetch(url) {
        const key = routeFor(url);
        if (key === "website.example.test/") return htmlResponse(503);
        if (key === "admin.example.test/api/storefront/featured") {
          return jsonResponse({ ok: false, error: "Storefront feed is temporarily unavailable." }, 503);
        }
        if (key === "admin.example.test/api/community/discord") {
          return jsonResponse(safeCommunityDiscordFeed());
        }
        if (key === "admin.example.test/api/mobile/app") {
          return jsonResponse({ ok: false, error: "down" }, 500);
        }
        throw new Error(`unexpected ${url}`);
      }
    });

    assert.equal(report.status, "degraded");
    assert.equal(report.checks.find((check) => check.id === "website").status, "degraded");
    assert.equal(
      report.checks.find((check) => check.id === "storefrontFeed").status,
      "degraded"
    );
    assert.equal(
      report.checks.find((check) => check.id === "communityFeed").status,
      "healthy"
    );
    assert.equal(report.checks.find((check) => check.id === "mobileApi").status, "degraded");
  });

  it("treats hung probes as degraded timeouts and aborts the fetch", async () => {
    let websiteSignal = null;
    let aborted = false;
    const pendingTimers = new Set();
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = (fn, delay, ...args) => {
      const id = realSetTimeout((...cbArgs) => {
        pendingTimers.delete(id);
        fn(...cbArgs);
      }, delay, ...args);
      pendingTimers.add(id);
      return id;
    };
    globalThis.clearTimeout = (id) => {
      pendingTimers.delete(id);
      return realClearTimeout(id);
    };

    try {
      const report = await collectEcosystemHealth({
        origin: ORIGIN,
        websiteUrl: WEBSITE_URL,
        timeoutMs: 20,
        env: {},
        async fetch(url, init) {
          const key = routeFor(url);
          if (key === "website.example.test/") {
            websiteSignal = init.signal;
            assert.ok(init.signal, "probe fetch must receive an AbortSignal");
            return new Promise((_, reject) => {
              init.signal.addEventListener("abort", () => {
                aborted = true;
                const error = new Error("Aborted");
                error.name = "AbortError";
                reject(error);
              });
            });
          }
          if (key === "admin.example.test/api/storefront/featured") {
            return jsonResponse(validStorefrontFeed());
          }
          if (key === "admin.example.test/api/community/discord") {
            return jsonResponse(safeCommunityDiscordFeed());
          }
          if (key === "admin.example.test/api/mobile/app") {
            return jsonResponse({ ok: false, error: "Authentication required" }, 401);
          }
          throw new Error(`unexpected ${url}`);
        }
      });

      const website = report.checks.find((check) => check.id === "website");
      assert.equal(report.status, "degraded");
      assert.equal(website.status, "degraded");
      assert.equal(website.detail, "Timed out.");
      assert.equal(website.httpStatus, null);
      assert.equal(aborted, true);
      assert.equal(websiteSignal.aborted, true);
      assert.equal(pendingTimers.size, 0);
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    }
  });

  it("rejects invalid public feed shapes", async () => {
    assert.equal(isValidStorefrontFeed({ ok: true, products: [] }), false);
    assert.equal(isValidCommunityFeed({ ok: true, schemaVersion: "1.0" }), false);

    const report = await collectEcosystemHealth({
      origin: ORIGIN,
      websiteUrl: WEBSITE_URL,
      env: {},
      async fetch(url) {
        const key = routeFor(url);
        if (key === "website.example.test/") return htmlResponse(200);
        if (key === "website.example.test") return htmlResponse(200);
        if (key === "admin.example.test/api/storefront/featured") {
          return jsonResponse({ ok: true, schemaVersion: "1.2", products: "nope" });
        }
        if (key === "admin.example.test/api/community/discord") {
          return jsonResponse({ ok: true, schemaVersion: "9.9" });
        }
        if (key === "admin.example.test/api/mobile/app") {
          return jsonResponse({ ok: false, error: "Authentication required" }, 401);
        }
        throw new Error(`unexpected ${url}`);
      }
    });

    assert.equal(
      report.checks.find((check) => check.id === "storefrontFeed").status,
      "degraded"
    );
    assert.match(
      report.checks.find((check) => check.id === "storefrontFeed").detail,
      /shape is invalid/
    );
    assert.equal(
      report.checks.find((check) => check.id === "communityFeed").status,
      "degraded"
    );
    assert.match(
      report.checks.find((check) => check.id === "communityFeed").detail,
      /shape is invalid/
    );
  });

  it("redacts URLs and secrets from probe failures", async () => {
    const report = await collectEcosystemHealth({
      origin: ORIGIN,
      websiteUrl: WEBSITE_URL,
      env: {},
      async fetch(url) {
        throw new Error(
          `getaddrinfo ENOTFOUND https://leaked.example.test/status?token=super-secret-token bearer abc`
        );
      }
    });

    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes("leaked.example.test"), false);
    assert.equal(serialized.includes("super-secret-token"), false);
    assert.equal(serialized.includes("https://"), false);
    assert.equal(redactSensitiveText("https://x.test/a"), "[redacted]");
    assertNoTargetUrls(report);
  });

  it("probes the local bridge only with complete existing credentials", async () => {
    let bridgeCalled = false;
    const report = await collectEcosystemHealth({
      origin: ORIGIN,
      websiteUrl: WEBSITE_URL,
      discordBotUrl: DISCORD_BOT_URL,
      env: {
        BROKIE_AI_BASE_URL: `${BRIDGE_BASE}/`,
        CF_ACCESS_CLIENT_ID: "client-id",
        CF_ACCESS_CLIENT_SECRET: "cf-access-secret",
        BROKIE_AI_CONSOLE_KEY: "console-key-value"
      },
      async fetch(url, init) {
        const key = routeFor(url);
        if (key === "website.example.test/") return htmlResponse(200);
        if (key === "website.example.test") return htmlResponse(200);
        if (key === "admin.example.test/api/storefront/featured") {
          return jsonResponse(validStorefrontFeed());
        }
        if (key === "admin.example.test/api/community/discord") {
          return jsonResponse(safeCommunityDiscordFeed());
        }
        if (key === "admin.example.test/api/mobile/app") {
          return jsonResponse({ ok: false, error: "Authentication required" }, 401);
        }
        if (key === "discord-bot.example.test/health") {
          return new Response(null, { status: 204 });
        }
        if (key === "bridge.example.test/api/ai/session") {
          bridgeCalled = true;
          assert.equal(init.headers["CF-Access-Client-Id"], "client-id");
          assert.equal(init.headers["CF-Access-Client-Secret"], "cf-access-secret");
          assert.equal(init.headers["X-Brokie-Console-Key"], "console-key-value");
          return jsonResponse({ ok: true, online: true });
        }
        throw new Error(`unexpected ${url}`);
      }
    });

    assert.equal(bridgeCalled, true);
    assert.equal(report.status, "healthy");
    assert.equal(report.checks.find((check) => check.id === "discordBot").status, "healthy");
    assert.equal(report.checks.find((check) => check.id === "localBridge").status, "healthy");
    assertNoTargetUrls(report);
  });

  it("computes aggregate status from configured checks only", () => {
    assert.equal(aggregateEcosystemStatus([]), "unconfigured");
    assert.equal(
      aggregateEcosystemStatus([
        { status: "unconfigured" },
        { status: "unconfigured" }
      ]),
      "unconfigured"
    );
    assert.equal(
      aggregateEcosystemStatus([
        { status: "healthy" },
        { status: "unconfigured" }
      ]),
      "healthy"
    );
    assert.equal(
      aggregateEcosystemStatus([
        { status: "healthy" },
        { status: "degraded" },
        { status: "unconfigured" }
      ]),
      "degraded"
    );
  });

  it("defaults internal Brokie OS probes to the canonical origin", async () => {
    const urls = [];
    const report = await collectEcosystemHealth({
      websiteUrl: WEBSITE_URL,
      env: {},
      async fetch(url) {
        urls.push(String(url));
        const key = routeFor(url);
        if (key === "website.example.test/" || key === "website.example.test") {
          return htmlResponse(200);
        }
        if (key === "admin.thebrokie.com/api/storefront/featured") {
          return jsonResponse(validStorefrontFeed());
        }
        if (key === "admin.thebrokie.com/api/community/discord") {
          return jsonResponse(safeCommunityDiscordFeed());
        }
        if (key === "admin.thebrokie.com/api/mobile/app") {
          return jsonResponse({ ok: false, error: "Authentication required" }, 401);
        }
        throw new Error(`unexpected ${url}`);
      }
    });

    assert.equal(BROKIE_OS_ORIGIN, "https://admin.thebrokie.com");
    assert.deepEqual(
      urls.filter((url) => url.startsWith(`${BROKIE_OS_ORIGIN}/`)).sort(),
      [
        `${BROKIE_OS_ORIGIN}/api/community/discord`,
        `${BROKIE_OS_ORIGIN}/api/mobile/app`,
        `${BROKIE_OS_ORIGIN}/api/storefront/featured`
      ]
    );
    assert.equal(JSON.stringify(report).includes("admin.thebrokie.com"), false);
    assert.equal(report.status, "healthy");
  });

  it("does not derive probe targets from the incoming request URL", () => {
    const routePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../app/api/ecosystem/health/route.js"
    );
    const source = readFileSync(routePath, "utf8");
    assert.equal(source.includes("request.url"), false);
    assert.equal(source.includes("new URL("), false);
    assert.match(source, /origin:\s*BROKIE_OS_ORIGIN/);
  });
});
