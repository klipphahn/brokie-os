"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Package,
  RefreshCw,
  Rocket,
  Shirt,
  Sparkles,
  Workflow
} from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "launches", label: "Launches", icon: Rocket },
  { id: "merch", label: "Merch", icon: Shirt },
  { id: "alerts", label: "Alerts", icon: Bell }
];

function currency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function compact(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function statusFor(product = {}) {
  const live = Boolean(
    product.onlineStorePublished ||
      ["live", "active"].includes(String(product.status || "").toLowerCase())
  );
  const fulfilled = String(product.printful_status || "").toLowerCase() === "configured";

  if (live && fulfilled) {
    return { tone: "good", label: "Live + Fulfilled" };
  }
  if (live) return { tone: "warn", label: "Live on Shopify" };
  if (fulfilled) return { tone: "warn", label: "Printful Ready" };
  return { tone: "muted", label: "Building" };
}

function shortDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export default function MobileCommand() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [merch, setMerch] = useState(null);
  const [publisher, setPublisher] = useState(null);
  const [activities, setActivities] = useState([]);
  const [approval, setApproval] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [analyticsResponse, merchResponse, publisherResponse, activityResponse, automationResponse] =
        await Promise.all([
          fetch("/api/analytics?days=30", { cache: "no-store" }),
          fetch("/api/storefront/featured", { cache: "no-store" }),
          fetch("/api/publisher", { cache: "no-store" }),
          fetch("/api/activity", { cache: "no-store" }),
          fetch("/api/automation", { cache: "no-store" })
        ]);

      const analyticsData = await analyticsResponse.json();
      const merchData = await merchResponse.json();
      const publisherData = await publisherResponse.json();
      const activityData = await activityResponse.json();
      const automationData = await automationResponse.json();

      if (!analyticsResponse.ok || !analyticsData.ok) {
        throw new Error(analyticsData.error || "Could not load analytics.");
      }
      if (!merchResponse.ok || !merchData.ok) {
        throw new Error(merchData.error || "Could not load merch feed.");
      }
      if (!publisherResponse.ok || !publisherData.ok) {
        throw new Error(publisherData.error || "Could not load launch queue.");
      }
      if (!activityResponse.ok || !activityData.ok) {
        throw new Error(activityData.error || "Could not load alerts.");
      }
      if (!automationResponse.ok || !automationData.ok) {
        throw new Error(automationData.error || "Could not load approvals.");
      }

      setAnalytics(analyticsData);
      setMerch(merchData);
      setPublisher(publisherData);
      setActivities(activityData.activities || []);
      setApproval(automationData.approval || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function syncSales() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: false })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Sales sync failed.");
      }
      setMessage(payload.message || "Sales synced.");
      await load();
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncMerch() {
    setSyncing(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/storefront/collection", {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Merch sync failed.");
      }
      setMessage(
        `Collection synced: ${payload.changes?.added || 0} added, ${payload.changes?.removed || 0} removed.`
      );
      await load();
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  async function runAutomation() {
    setAutomating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: false, approved: true })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Automation failed.");
      }

      setMessage(payload.message || "Automation cycle completed.");
      await load();
    } catch (automationError) {
      setError(automationError.message);
    } finally {
      setAutomating(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const currentDrop = merch?.products?.[0] || null;
  const currentDropState = useMemo(() => statusFor(currentDrop || {}), [currentDrop]);
  const cards = analytics?.cards || {};
  const launchSummary = analytics?.launch || {
    total: 0,
    ready: 0,
    blocked: 0,
    live: 0,
    nextBlocked: null
  };

  return (
    <main className="commandShell">
      <section className="commandHeader">
        <div className="commandHeaderTop">
          <div>
            <span className="commandEyebrow">BROKIE COMMAND</span>
            <h1>The Brokie control room</h1>
            <p>Quick access to the merch brain, launches, and alerts from your phone.</p>
          </div>
          <button className="commandRefresh" onClick={load} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>

        <div className="commandQuickActions">
          <button onClick={runAutomation} disabled={syncing || automating}>
            {automating ? <LoaderCircle className="spin" size={16} /> : <Workflow size={16} />}
            Run automation
          </button>
          <button onClick={syncSales} disabled={syncing || automating}>
            <Sparkles size={16} />
            Sync sales
          </button>
          <button onClick={syncMerch} disabled={syncing || automating}>
            <Package size={16} />
            Sync merch
          </button>
          <a href="/merch" target="_blank" rel="noreferrer">
            Open merch
            <ExternalLink size={15} />
          </a>
        </div>

        {(message || error) && (
          <div className={`commandNotice ${error ? "error" : "success"}`}>
            {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{error || message}</span>
          </div>
        )}
      </section>

      {tab === "dashboard" && (
        <section className="commandPanelStack">
          <article className="commandHeroCard">
            <div className={`commandState commandState--${currentDropState.tone}`}>
              {currentDropState.label}
            </div>
            <h2>{currentDrop?.title || merch?.brain?.headline || "Keep building."}</h2>
            <p>{currentDrop?.description || merch?.brain?.summary || "Your live drop shows up here."}</p>
            <div className="commandMetaRow">
              <div>
                <span>North star</span>
                <strong>{merch?.brain?.northStar || "We don't need money to be dangerous."}</strong>
              </div>
              <div>
                <span>Next move</span>
                <strong>{merch?.brain?.nextAction || "Keep the queue moving."}</strong>
              </div>
            </div>
          </article>

          <div className="commandStats">
            <article>
              <span>Revenue</span>
              <strong>{currency(cards.revenue)}</strong>
            </article>
            <article>
              <span>Orders</span>
              <strong>{compact(cards.orders)}</strong>
            </article>
            <article>
              <span>Units</span>
              <strong>{compact(cards.units)}</strong>
            </article>
            <article>
              <span>Ready</span>
              <strong>{compact(launchSummary.ready)}</strong>
            </article>
          </div>

          <article className="commandApprovalCard">
            <div className="commandApprovalHead">
              <div>
                <span className="commandEyebrow">APPROVALS</span>
                <h2>Major approvals only</h2>
              </div>
              <Workflow size={18} />
            </div>
            {approval ? (
              <>
                <p>{approval.summary}</p>
                <div className="commandApprovalList">
                  {(approval.actions || []).map((item) => (
                    <div key={item.id} className={`commandApprovalItem ${item.status}`}>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="commandApprovalButton"
                  onClick={runAutomation}
                  disabled={syncing || automating}
                >
                  {automating ? <LoaderCircle className="spin" size={16} /> : <Workflow size={16} />}
                  {approval.approveLabel || "Approve & run"}
                </button>
              </>
            ) : (
              <div className="analyticsEmptyRow">Loading approvals…</div>
            )}
          </article>
        </section>
      )}

      {tab === "launches" && (
        <section className="commandPanelStack">
          <article className="commandLaunchSummary">
            <h2>Launch queue</h2>
            <div className="commandLaunchGrid">
              <div>
                <span>Total</span>
                <strong>{compact(launchSummary.total)}</strong>
              </div>
              <div>
                <span>Ready</span>
                <strong>{compact(launchSummary.ready)}</strong>
              </div>
              <div>
                <span>Blocked</span>
                <strong>{compact(launchSummary.blocked)}</strong>
              </div>
              <div>
                <span>Live</span>
                <strong>{compact(launchSummary.live)}</strong>
              </div>
            </div>
            <p>{merch?.brain?.brandRule || "The next launch should match the same merch brain as the desktop app."}</p>
          </article>

          <div className="commandList">
            {(publisher?.items || []).slice(0, 5).map((item) => (
              <article key={item.design?.id || item.product?.id}>
                <div>
                  <strong>{item.concept?.headline || item.design?.name || "Queued design"}</strong>
                  <p>{item.product?.printful_status || "not configured"}</p>
                </div>
              <span>{item.product?.status || item.design?.status || "queued"}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "merch" && (
        <section className="commandPanelStack">
          <article className="commandCurrentDrop">
            <div>
              <span className="commandEyebrow">CURRENT DROP</span>
              <h2>{currentDrop?.title || "The Brokie drop"}</h2>
              <p>{currentDrop?.description || currentDrop?.subtitle || merch?.storefront?.manifesto?.body}</p>
            </div>
            <div className={`commandState commandState--${currentDropState.tone}`}>
              {currentDropState.label}
            </div>
          </article>

          <div className="commandList">
            {(merch?.products || []).slice(0, 6).map((product) => {
              const state = statusFor(product);
              return (
                <article key={product.id}>
                  <div>
                    <strong>{product.title}</strong>
                    <p>{product.familyLabel || product.productType || "Merch"}</p>
                  </div>
                  <span className={`commandState commandState--${state.tone}`}>{state.label}</span>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "alerts" && (
        <section className="commandPanelStack">
          <article className="commandAlertsHeader">
            <h2>Alerts</h2>
            <p>Recent changes, launches, and syncs from the live system.</p>
          </article>

          <div className="commandAlerts">
            {(activities || []).slice(0, 8).map((activity) => (
              <article key={activity.id}>
                <div>
                  <strong>{activity.title}</strong>
                  <p>{activity.detail}</p>
                </div>
                <span>{shortDate(activity.created_at)}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <nav className="commandTabBar">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
