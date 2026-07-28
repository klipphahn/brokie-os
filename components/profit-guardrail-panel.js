"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import { calculateProfitability } from "@/lib/profit-guardrails";

function currency(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function percent(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export default function ProfitGuardrailPanel({
  productId,
  retailPrice,
  onStateChange,
  onUpdated,
  refreshToken = 0
}) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  async function load() {
    if (!productId) {
      setState(null);
      onStateChange?.(null);
      return;
    }

    setState(null);
    onStateChange?.(null);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/guardrails?productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" }
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Profit guardrail unavailable.");
      }
      setState(payload);
      onStateChange?.(payload);
    } catch (loadError) {
      setError(loadError.message);
      setState(null);
      onStateChange?.(null);
    } finally {
      setLoading(false);
    }
  }

  async function act(action, approvalId = null) {
    if (!productId && action === "refresh_product") return;
    setWorking(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          productId,
          approvalId
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Guardrail action failed.");
      }
      setMessage(payload.message || "Guardrail updated.");
      await load();
      onUpdated?.(payload);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorking("");
    }
  }

  function openPolicyEditor() {
    const policy = state?.policy || {};
    setPolicyForm({
      minimumMarginPercent: Number(policy.minimumMarginPercent ?? 30),
      targetMarginPercent: Number(policy.targetMarginPercent ?? 35),
      enforceMinimumMargin: policy.enforceMinimumMargin !== false
    });
    setMessage("");
    setError("");
    setPolicyOpen(true);
  }

  async function savePolicy() {
    if (!policyForm) return;
    setSavingPolicy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_policy",
          minimumMarginPercent: Number(policyForm.minimumMarginPercent),
          targetMarginPercent: Number(policyForm.targetMarginPercent),
          enforceMinimumMargin: policyForm.enforceMinimumMargin
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not update the policy.");
      }
      setMessage(payload.message || "Profit policy updated.");
      setPolicyOpen(false);
      await load();
      onUpdated?.(payload);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingPolicy(false);
    }
  }

  useEffect(() => {
    load();
  }, [productId, refreshToken]);

  const current = useMemo(() => {
    if (!state?.profitability) return null;
    return calculateProfitability({
      retailPrice,
      baseProductionCost:
        state.profitability.base_production_cost,
      extraPlacementCost:
        state.profitability.extra_placement_cost,
      policy: state.policy
    });
  }, [retailPrice, state]);

  const savedPrice = Number(state?.profitability?.retail_price || 0);
  const hasUnsavedPrice =
    current &&
    Number.isFinite(Number(retailPrice)) &&
    Math.abs(Number(retailPrice) - savedPrice) > 0.001;
  const status = current?.status || "needs_cost";
  const advisory = state?.policy?.enforceMinimumMargin === false;

  return (
    <section className={`profitGuardrail ${status}`}>
      <div className="profitGuardrailHead">
        <div>
          {status === "ready" ? (
            <CheckCircle2 size={20} />
          ) : (
            <ShieldAlert size={20} />
          )}
          <span>
            <strong>Profit & Launch Guardrail</strong>
            <small>
              {advisory
                ? `Advisory floor · ${Number(state?.policy?.minimumMarginPercent || 0).toFixed(0)}% reference · ${Number(state?.policy?.targetMarginPercent || 35).toFixed(0)}% target · missing cost still blocks`
                : `${Number(state?.policy?.minimumMarginPercent || 30).toFixed(0)}% hard floor · ${Number(state?.policy?.targetMarginPercent || 35).toFixed(0)}% target`}
            </small>
          </span>
        </div>
        <div className="profitGuardrailHeadActions">
          <span className={`profitGuardrailStatus ${status}`}>
            {advisory ? "advisory" : status.replace("_", " ")}
          </span>
          <button
            type="button"
            className="profitGuardrailPolicyToggle"
            onClick={() => (policyOpen ? setPolicyOpen(false) : openPolicyEditor())}
          >
            <SlidersHorizontal size={14} />
            {policyOpen ? "Close" : "Adjust policy"}
          </button>
        </div>
      </div>

      {policyOpen && policyForm && (
        <div className="profitGuardrailPolicyEditor">
          <p>
            Set your own margin targets, or switch the margin floor to advisory so
            you can price freely like the Printful dashboard. Advisory mode still
            shows estimated profit and does not block launches for a below-floor
            margin, but missing cost data continues to block launch.
          </p>
          <div className="profitGuardrailPolicyFields">
            <label>
              Minimum margin %
              <input
                type="number"
                min="0"
                max="89"
                step="1"
                value={policyForm.minimumMarginPercent}
                onChange={(event) =>
                  setPolicyForm((value) => ({
                    ...value,
                    minimumMarginPercent: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Target margin %
              <input
                type="number"
                min="0"
                max="89"
                step="1"
                value={policyForm.targetMarginPercent}
                onChange={(event) =>
                  setPolicyForm((value) => ({
                    ...value,
                    targetMarginPercent: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <label className="profitGuardrailPolicyToggleRow">
            <input
              type="checkbox"
              checked={policyForm.enforceMinimumMargin}
              onChange={(event) =>
                setPolicyForm((value) => ({
                  ...value,
                  enforceMinimumMargin: event.target.checked
                }))
              }
            />
            <span>
              Enforce the minimum margin as a hard launch block
              <small>
                Uncheck to make the margin floor advisory (missing cost still blocks).
              </small>
            </span>
          </label>
          <div className="profitGuardrailPolicyActions">
            <button
              type="button"
              onClick={savePolicy}
              disabled={savingPolicy}
            >
              {savingPolicy ? "Saving…" : "Save policy"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setPolicyOpen(false)}
              disabled={savingPolicy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!productId ? (
        <p className="profitGuardrailEmpty">
          Save the review and create the Shopify draft before running the profit check.
        </p>
      ) : loading ? (
        <p className="profitGuardrailEmpty">
          <LoaderCircle className="spin" size={16} /> Loading cost guardrails…
        </p>
      ) : current ? (
        <>
          <div className="profitGuardrailMetrics">
            <article>
              <span>Customer revenue</span>
              <strong>{currency(current.estimatedRevenue)}</strong>
            </article>
            <article>
              <span>Estimated total cost</span>
              <strong>{currency(current.estimatedTotalCost)}</strong>
            </article>
            <article>
              <span>Estimated profit</span>
              <strong>{currency(current.estimatedProfit)}</strong>
            </article>
            <article>
              <span>Estimated margin</span>
              <strong>{percent(current.marginPercent)}</strong>
            </article>
          </div>

          <div className="profitGuardrailRecommendation">
            <BadgeDollarSign size={18} />
            <div>
              <strong>
                Target price {currency(current.recommendedRetailPrice)}
              </strong>
              <span>
                Minimum safe price {currency(current.minimumRetailPrice)} · Printful production{" "}
                {currency(current.estimatedProductionCost)} · shipping reserve{" "}
                {currency(current.estimatedShippingCost)}
              </span>
            </div>
          </div>

          {hasUnsavedPrice && (
            <p className="profitGuardrailNote">
              This is a preview for the edited price. Save the review and rerun the check before launch.
            </p>
          )}

          {state.approval && (
            <div className="profitApproval">
              <div>
                <strong>{state.approval.title}</strong>
                <span>
                  {currency(state.approval.current_price)} →{" "}
                  {currency(state.approval.proposed_price)}
                </span>
                <p>{state.approval.summary}</p>
              </div>
              <div className="profitApprovalActions">
                <button
                  type="button"
                  onClick={() => act("approve_price", state.approval.id)}
                  disabled={!!working}
                >
                  <ThumbsUp size={15} />
                  {working === "approve_price" ? "Applying…" : "Approve price"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => act("reject_price", state.approval.id)}
                  disabled={!!working}
                >
                  <ThumbsDown size={15} /> Reject
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="profitGuardrailEmpty">
          Run the first check after Printful verifies every variant.
        </p>
      )}

      <div className="profitGuardrailActions">
        <button
          type="button"
          className="secondary"
          onClick={() => act("refresh_product")}
          disabled={!productId || !!working || loading}
        >
          <RefreshCw
            size={15}
            className={working === "refresh_product" ? "spin" : ""}
          />
          {working === "refresh_product" ? "Checking…" : "Run profit check"}
        </button>
        <span>
          {advisory
            ? "Advisory floor: set any retail price above; missing cost data still blocks launch."
            : "Prices only change after your approval."}
        </span>
      </div>

      {(message || error) && (
        <p className={`profitGuardrailMessage ${error ? "error" : "success"}`}>
          {error || message}
        </p>
      )}
    </section>
  );
}
