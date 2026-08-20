import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchBrokieAiAdmin,
  normalizeAutomationActivity,
  normalizeBrokieAiQueueRequest,
  normalizeProposalDecision,
  normalizeSystemOverview
} from "./brokie-ai.js";

describe("Brokie AI automation boundaries", () => {
  it("normalizes an allowlisted task", () => {
    assert.deepEqual(normalizeBrokieAiQueueRequest({
      text: "  inspect the admin dashboard  ",
      repository: "brokie-os",
      testProfile: "node-test"
    }), {
      text: "inspect the admin dashboard",
      adapter: "auto",
      repository: "brokie-os",
      testProfile: "node-test"
    });
  });

  it("rejects arbitrary repositories and test commands", () => {
    assert.throws(() => normalizeBrokieAiQueueRequest({ text: "task", repository: "other" }), /allowlisted/);
    assert.throws(() => normalizeBrokieAiQueueRequest({ text: "task", testProfile: "rm-all" }), /allowlisted/);
  });

  it("allows only explicit approval decisions", () => {
    assert.deepEqual(normalizeProposalDecision({ action: "approve" }), { action: "approve" });
    assert.throws(() => normalizeProposalDecision({ action: "execute" }), /approve or reject/);
  });

  it("uses the separate admin credential for proposal decisions", async () => {
    const names = [
      "BROKIE_AI_BASE_URL",
      "CF_ACCESS_CLIENT_ID",
      "CF_ACCESS_CLIENT_SECRET",
      "BROKIE_AI_CONSOLE_KEY",
      "BROKIE_AI_ADMIN_TOKEN"
    ];
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    const originalFetch = globalThis.fetch;
    process.env.BROKIE_AI_BASE_URL = "https://ai.example.test";
    process.env.CF_ACCESS_CLIENT_ID = "client-id";
    process.env.CF_ACCESS_CLIENT_SECRET = "client-secret";
    process.env.BROKIE_AI_CONSOLE_KEY = "console-key";

    try {
      delete process.env.BROKIE_AI_ADMIN_TOKEN;
      await assert.rejects(
        () => fetchBrokieAiAdmin("/api/ai/proposals/job/decision", { method: "POST" }),
        /admin credential is not configured/
      );

      process.env.BROKIE_AI_ADMIN_TOKEN = "admin-token";
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://ai.example.test/api/ai/proposals/job/decision");
        assert.equal(options.headers.Authorization, "Bearer admin-token");
        assert.equal(options.headers["X-Brokie-Console-Key"], "console-key");
        return new Response("{}", { status: 200 });
      };
      const response = await fetchBrokieAiAdmin(
        "/api/ai/proposals/job/decision",
        { method: "POST", headers: { Authorization: "Bearer caller-supplied" } }
      );
      assert.equal(response.status, 200);
    } finally {
      globalThis.fetch = originalFetch;
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });

  it("sanitizes automation activity and drops unsupported statuses", () => {
    const result = normalizeAutomationActivity({
      counts: { completed: 2, failed: -4 },
      items: [
        { id: "safe", status: "completed", type: "cursor", summary: "done", retryStatus: "scheduled" },
        { id: "unsafe", status: "execute-now" }
      ]
    });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "safe");
    assert.equal(result.items[0].retryStatus, "scheduled");
    assert.equal(result.counts.completed, 2);
    assert.equal(result.counts.failed, 0);
  });

  it("normalizes whole-system health and recomputes trusted counts", () => {
    const result = normalizeSystemOverview({
      overallStatus: "critical",
      counts: { healthy: 999 },
      alerts: [{ severity: "critical", source: "Backup", message: "Failed" }],
      categories: [{
        id: "storage",
        name: "Storage",
        items: [
          { id: "backup", name: "Backup", status: "critical", summary: "Failed" },
          { id: "invalid", status: "destroyed" }
        ]
      }]
    });
    assert.equal(result.monitored, 2);
    assert.equal(result.counts.healthy, 0);
    assert.equal(result.counts.critical, 1);
    assert.equal(result.counts.unknown, 1);
    assert.equal(result.alerts[0].source, "Backup");
  });
});
