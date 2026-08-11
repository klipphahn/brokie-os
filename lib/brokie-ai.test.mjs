import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
});
