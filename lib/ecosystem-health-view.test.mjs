import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ECOSYSTEM_CHECK_CATALOG,
  aggregateEcosystemViewStatus,
  commandCenterFrameStatus,
  ecosystemStatusLabel,
  explainUnconfiguredServices,
  formatHttpStatus,
  formatLatencyMs,
  normalizeEcosystemHealthView
} from "./ecosystem-health-view.js";

function healthyCheck(id, overrides = {}) {
  return {
    id,
    label: ECOSYSTEM_CHECK_CATALOG.find((item) => item.id === id)?.label,
    status: "healthy",
    latencyMs: 12,
    httpStatus: 200,
    detail: "Reached the service.",
    ...overrides
  };
}

describe("ecosystem health view model", () => {
  it("fills the six canonical checks from an empty payload", () => {
    const view = normalizeEcosystemHealthView(null);

    assert.equal(ECOSYSTEM_CHECK_CATALOG.length, 6);
    assert.deepEqual(
      view.checks.map((check) => check.id),
      ECOSYSTEM_CHECK_CATALOG.map((check) => check.id)
    );
    assert.equal(view.status, "unconfigured");
    assert.equal(view.statusLabel, "Unconfigured");
    assert.equal(view.checkedAt, null);
    assert.equal(view.latencyMs, null);
    assert.equal(view.latencyLabel, null);
    assert.deepEqual(view.counts, { healthy: 0, degraded: 0, unconfigured: 6 });
    assert.match(view.unconfiguredExplanation, /not a healthy result/i);
    assert.match(view.checks[0].detail, /not included/i);
  });

  it("keeps canonical order, ignores extras, and fills missing checks", () => {
    const view = normalizeEcosystemHealthView({
      status: "healthy",
      checks: [
        healthyCheck("mobileApi"),
        healthyCheck("website"),
        { id: "mysteryProbe", status: "healthy", detail: "ignore me" }
      ]
    });

    assert.deepEqual(
      view.checks.map((check) => [check.id, check.status]),
      [
        ["website", "healthy"],
        ["storefrontFeed", "unconfigured"],
        ["communityFeed", "unconfigured"],
        ["mobileApi", "healthy"],
        ["discordBot", "unconfigured"],
        ["localBridge", "unconfigured"]
      ]
    );
    assert.equal(view.checks.some((check) => check.id === "mysteryProbe"), false);
    assert.equal(view.status, "healthy");
    assert.deepEqual(view.counts, { healthy: 2, degraded: 0, unconfigured: 4 });
  });

  it("recomputes aggregate status and counts instead of trusting the payload", () => {
    const view = normalizeEcosystemHealthView({
      status: "healthy",
      counts: { healthy: 99, degraded: 0, unconfigured: 0 },
      checks: [
        healthyCheck("website"),
        healthyCheck("storefrontFeed", { status: "degraded", httpStatus: 503 }),
        healthyCheck("communityFeed"),
        healthyCheck("mobileApi"),
        healthyCheck("discordBot", { status: "unconfigured", latencyMs: null, httpStatus: null }),
        healthyCheck("localBridge", { status: "unconfigured", latencyMs: null, httpStatus: null })
      ]
    });

    assert.equal(view.status, "degraded");
    assert.deepEqual(view.counts, { healthy: 3, degraded: 1, unconfigured: 2 });
  });

  it("treats invalid statuses as degraded and omits bad latency or HTTP values", () => {
    const view = normalizeEcosystemHealthView({
      checkedAt: "2026-08-16T17:00:00.000Z",
      latencyMs: "41.6",
      checks: [
        healthyCheck("website", {
          status: "EXPLODED",
          latencyMs: "fast",
          httpStatus: "OK",
          detail: "   "
        }),
        healthyCheck("storefrontFeed", {
          latencyMs: -8,
          httpStatus: 99
        }),
        healthyCheck("communityFeed", {
          latencyMs: 15.4,
          httpStatus: 401
        })
      ]
    });

    const website = view.checks[0];
    assert.equal(website.status, "degraded");
    assert.equal(website.statusLabel, "Degraded");
    assert.equal(website.latencyLabel, null);
    assert.equal(website.httpStatusLabel, null);
    assert.equal(website.detail, "Unrecognized status.");

    const storefront = view.checks[1];
    assert.equal(storefront.latencyMs, null);
    assert.equal(storefront.httpStatus, null);

    const community = view.checks[2];
    assert.equal(community.latencyMs, 15);
    assert.equal(community.latencyLabel, "15 ms");
    assert.equal(community.httpStatus, 401);
    assert.equal(community.httpStatusLabel, "HTTP 401");

    assert.equal(view.checkedAt, "2026-08-16T17:00:00.000Z");
    assert.equal(view.latencyMs, 42);
    assert.equal(view.latencyLabel, "42 ms");
  });

  it("redacts URLs in detail text and keeps a bounded fallback", () => {
    const view = normalizeEcosystemHealthView({
      checks: [
        healthyCheck("website", {
          detail: "Failed at https://secret.example.test/health with token"
        })
      ]
    });

    assert.equal(
      view.checks[0].detail.includes("secret.example.test"),
      false
    );
    assert.match(view.checks[0].detail, /\[redacted\]/);
  });

  it("explains unconfigured Discord bot and local bridge actions", () => {
    const view = normalizeEcosystemHealthView({
      checks: [
        healthyCheck("website"),
        healthyCheck("storefrontFeed"),
        healthyCheck("communityFeed"),
        healthyCheck("mobileApi"),
        {
          id: "discordBot",
          status: "unconfigured",
          detail: "No Discord bot probe is configured in Brokie OS."
        },
        {
          id: "localBridge",
          status: "unconfigured",
          detail: "Local bridge credentials are not configured."
        }
      ]
    });

    assert.equal(view.status, "healthy");
    assert.match(view.unconfiguredExplanation, /Discord bot stays unconfigured/);
    assert.match(view.unconfiguredExplanation, /BROKIE_AI_BASE_URL/);
    assert.match(view.unconfiguredExplanation, /refresh this view/i);
    assert.equal(
      explainUnconfiguredServices(view.checks.filter((check) => check.status === "healthy")),
      ""
    );
  });

  it("combines ecosystem and local statuses by worst severity for the frame", () => {
    assert.equal(commandCenterFrameStatus("degraded", "healthy"), "degraded");
    assert.equal(commandCenterFrameStatus("healthy", "critical"), "critical");
    assert.equal(commandCenterFrameStatus("degraded", "critical"), "critical");
    assert.equal(commandCenterFrameStatus("healthy", "warning"), "warning");
    assert.equal(commandCenterFrameStatus("degraded", "warning"), "degraded");
    assert.equal(commandCenterFrameStatus("unconfigured", "healthy"), "unconfigured");
    assert.equal(commandCenterFrameStatus("unconfigured", "unknown"), "unknown");
    assert.equal(commandCenterFrameStatus("warning", "unconfigured"), "warning");
    assert.equal(commandCenterFrameStatus("healthy", "healthy"), "healthy");
    assert.equal(commandCenterFrameStatus(null, "healthy"), "unknown");
    assert.equal(commandCenterFrameStatus("healthy", undefined), "unknown");
    assert.equal(commandCenterFrameStatus("EXPLODED", "healthy"), "unknown");
  });

  it("formats latency and HTTP status defensively", () => {
    assert.equal(formatLatencyMs(0), "0 ms");
    assert.equal(formatLatencyMs("18"), "18 ms");
    assert.equal(formatLatencyMs(null), null);
    assert.equal(formatLatencyMs(-1), null);
    assert.equal(formatHttpStatus(200), "HTTP 200");
    assert.equal(formatHttpStatus("401"), "HTTP 401");
    assert.equal(formatHttpStatus(99), null);
    assert.equal(formatHttpStatus("nope"), null);
    assert.equal(ecosystemStatusLabel("degraded"), "Degraded");
    assert.equal(aggregateEcosystemViewStatus([]), "unconfigured");
  });
});
