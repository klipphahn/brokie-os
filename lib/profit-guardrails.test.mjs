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
  const enforced = { enforceMinimumMargin: true };
  const advisory = { enforceMinimumMargin: false };

  it("keeps ready and warning launchable in both modes", () => {
    for (const policy of [enforced, advisory, undefined]) {
      assert.deepEqual(evaluateLaunchGate("ready", policy), {
        readyToLaunch: true,
        hardBlocked: false
      });
      assert.deepEqual(evaluateLaunchGate("warning", policy), {
        readyToLaunch: true,
        hardBlocked: false
      });
    }
  });

  it("fails closed on needs_cost and missing status in both modes", () => {
    for (const policy of [enforced, advisory]) {
      for (const status of ["needs_cost", null, undefined]) {
        assert.deepEqual(
          evaluateLaunchGate(status, policy),
          { readyToLaunch: false, hardBlocked: true },
          `expected fail-closed for ${status} with enforce=${policy.enforceMinimumMargin}`
        );
      }
    }
  });

  it("blocks below-floor margin only when enforcement is on", () => {
    assert.deepEqual(evaluateLaunchGate("blocked", enforced), {
      readyToLaunch: false,
      hardBlocked: true
    });
    assert.deepEqual(evaluateLaunchGate("blocked", advisory), {
      readyToLaunch: true,
      hardBlocked: false
    });
    assert.deepEqual(evaluateLaunchGate("blocked"), {
      readyToLaunch: false,
      hardBlocked: true
    });
  });

  it("treats snake_case advisory policy rows the same way", () => {
    assert.deepEqual(
      evaluateLaunchGate("blocked", { enforce_minimum_margin: false }),
      { readyToLaunch: true, hardBlocked: false }
    );
    assert.deepEqual(
      evaluateLaunchGate("needs_cost", { enforce_minimum_margin: false }),
      { readyToLaunch: false, hardBlocked: true }
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
    assert.deepEqual(evaluateLaunchGate(result.status, result.policy), {
      readyToLaunch: true,
      hardBlocked: false
    });
  });
});
