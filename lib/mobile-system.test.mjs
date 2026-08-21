import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadMobileSystemOverview,
  unavailableMobileSystemOverview
} from "./mobile-system.js";

describe("mobile system overview", () => {
  it("normalizes the existing Core system contract", async () => {
    const result = await loadMobileSystemOverview(async () => ({
      timestampUtc: "2026-08-21T18:00:00Z",
      categories: [
        {
          id: "ai",
          name: "AI",
          items: [
            {
              id: "primary-model",
              name: "Primary model",
              status: "healthy",
              summary: "qwen3:8b is available."
            },
            {
              id: "ipad-heartbeat",
              name: "iPad heartbeat",
              status: "warning",
              summary: "Heartbeat is stale."
            }
          ]
        }
      ],
      alerts: [
        {
          severity: "warning",
          source: "iPad",
          message: "Heartbeat is stale."
        }
      ]
    }));

    assert.equal(result.available, true);
    assert.equal(result.overallStatus, "warning");
    assert.equal(result.monitored, 2);
    assert.deepEqual(result.counts, {
      healthy: 1,
      warning: 1,
      critical: 0,
      unknown: 0
    });
    assert.equal(result.alerts[0].source, "iPad");
  });

  it("fails soft so business data remains available when Core is unreachable", async () => {
    const result = await loadMobileSystemOverview(async () => {
      throw new Error("private bridge unavailable");
    });

    assert.deepEqual(result, unavailableMobileSystemOverview());
  });
});
