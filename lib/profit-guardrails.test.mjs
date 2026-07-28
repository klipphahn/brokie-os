import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PROFIT_POLICY,
  calculateProfitability,
  evaluateLaunchGate,
  normalizeProfitPolicy
} from "./profit-guardrails.js";

describe("normalizeProfitPolicy", () => {
  it("defaults enforceMinimumMargin to true", () => {
    const policy = normalizeProfitPolicy({});
    assert.equal(policy.enforceMinimumMargin, true);
    assert.equal(policy.minimumMarginPercent, 30);
    assert.equal(policy.targetMarginPercent, 35);
  });

  it("reads camelCase and snake_case enforcement flags", () => {
    assert.equal(
      normalizeProfitPolicy({ enforceMinimumMargin: false })
        .enforceMinimumMargin,
      false
    );
    assert.equal(
      normalizeProfitPolicy({ enforce_minimum_margin: false })
        .enforceMinimumMargin,
      false
    );
    assert.equal(
      normalizeProfitPolicy({ enforce_minimum_margin: true })
        .enforceMinimumMargin,
      true
    );
  });

  it("coerces common string/number boolean forms", () => {
    for (const value of [false, "false", "0", "no", "off", 0]) {
      assert.equal(
        normalizeProfitPolicy({ enforceMinimumMargin: value })
          .enforceMinimumMargin,
        false,
        `expected false for ${JSON.stringify(value)}`
      );
    }
    for (const value of [true, "true", "1", "yes", "on", 1]) {
      assert.equal(
        normalizeProfitPolicy({ enforceMinimumMargin: value })
          .enforceMinimumMargin,
        true,
        `expected true for ${JSON.stringify(value)}`
      );
    }
  });

  it("allows a minimum margin of 0 and keeps target at or above it", () => {
    const policy = normalizeProfitPolicy({
      minimum_margin_percent: 0,
      target_margin_percent: 0
    });
    assert.equal(policy.minimumMarginPercent, 0);
    assert.equal(policy.targetMarginPercent, 0);

    const raised = normalizeProfitPolicy({
      minimumMarginPercent: 12,
      targetMarginPercent: 5
    });
    assert.equal(raised.minimumMarginPercent, 12);
    assert.equal(raised.targetMarginPercent, 12);
  });
});

describe("evaluateLaunchGate", () => {
  it("enforces the hard floor by default", () => {
    assert.deepEqual(evaluateLaunchGate("ready"), {
      readyToLaunch: true,
      hardBlocked: false
    });
    assert.deepEqual(evaluateLaunchGate("warning"), {
      readyToLaunch: true,
      hardBlocked: false
    });
    assert.deepEqual(evaluateLaunchGate("blocked"), {
      readyToLaunch: false,
      hardBlocked: true
    });
    assert.deepEqual(evaluateLaunchGate("needs_cost"), {
      readyToLaunch: false,
      hardBlocked: true
    });
    assert.deepEqual(evaluateLaunchGate(null), {
      readyToLaunch: false,
      hardBlocked: true
    });
  });

  it("never blocks launches in advisory mode", () => {
    const advisory = { enforceMinimumMargin: false };
    for (const status of [
      "ready",
      "warning",
      "blocked",
      "needs_cost",
      null,
      undefined
    ]) {
      assert.deepEqual(
        evaluateLaunchGate(status, advisory),
        { readyToLaunch: true, hardBlocked: false },
        `advisory should allow status ${status}`
      );
    }
  });

  it("treats snake_case advisory policy rows the same way", () => {
    assert.deepEqual(
      evaluateLaunchGate("blocked", { enforce_minimum_margin: false }),
      { readyToLaunch: true, hardBlocked: false }
    );
  });
});

describe("calculateProfitability with advisory policy", () => {
  it("still computes blocked status for display while carrying the flag", () => {
    const result = calculateProfitability({
      retailPrice: 10,
      baseProductionCost: 20,
      policy: {
        ...DEFAULT_PROFIT_POLICY,
        enforceMinimumMargin: false,
        minimumMarginPercent: 30
      }
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.policy.enforceMinimumMargin, false);
    assert.equal(typeof result.marginPercent, "number");
    assert.ok(result.marginPercent < 30);
  });
});
