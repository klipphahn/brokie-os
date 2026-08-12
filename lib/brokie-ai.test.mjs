import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeAutomationActivity,
  normalizeBrokieAiQueueRequest,
  normalizeProposalDecision
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
});
