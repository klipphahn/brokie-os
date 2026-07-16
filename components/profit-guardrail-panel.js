"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
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
              {Number(state?.policy?.minimumMarginPercent || 30).toFixed(0)}% hard floor ·{" "}
              {Number(state?.policy?.targetMarginPercent || 35).toFixed(0)}% target
            </small>
          </span>
        </div>
        <span className={`profitGuardrailStatus ${status}`}>
          {status.replace("_", " ")}
        </span>
      </div>

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
        <span>Prices only change after your approval.</span>
      </div>

      {(message || error) && (
        <p className={`profitGuardrailMessage ${error ? "error" : "success"}`}>
          {error || message}
        </p>
      )}
    </section>
  );
}
