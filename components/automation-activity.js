"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RefreshCw } from "lucide-react";

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["failed", "Failed"],
  ["awaiting-approval", "Awaiting approval"]
];

function formatTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString();
}

function statusLabel(status) {
  return status.replaceAll("-", " ");
}

function matchesFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "active") return ["queued", "approved", "processing"].includes(item.status);
  return item.status === filter;
}

function retryLabel(status) {
  if (status === "scheduled") return "Scheduled";
  if (status === "exhausted") return "Exhausted";
  if (status === "not-scheduled") return "Not scheduled";
  return "Not applicable";
}

export default function AutomationActivity() {
  const [activity, setActivity] = useState({ counts: {}, items: [], timestampUtc: null });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/local-ai/activity", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Activity refresh failed.");
      setActivity(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const visibleItems = useMemo(
    () => activity.items.filter((item) => matchesFilter(item, filter)),
    [activity.items, filter]
  );

  const stats = [
    ["Queued", activity.counts.queued || 0, Clock3],
    ["Processing", activity.counts.processing || 0, LoaderCircle],
    ["Completed", activity.counts.completed || 0, CheckCircle2],
    ["Failed", activity.counts.failed || 0, AlertTriangle],
    ["Approval", activity.counts.awaitingApproval || 0, Activity]
  ];

  return (
    <section className="panel automationActivityPanel" id="automation-activity">
      <div className="panelHead">
        <div>
          <span className="eyebrow">LOCAL AUTOMATION OBSERVABILITY</span>
          <h2>Automation Activity</h2>
          <p className="automationActivityUpdated">Last snapshot: {formatTime(activity.timestampUtc)}</p>
        </div>
        <button type="button" className="secondary" onClick={load} disabled={loading}>
          <RefreshCw className={loading ? "spin" : ""} size={16} /> Refresh
        </button>
      </div>

      <div className="automationStats">
        {stats.map(([label, value, Icon]) => (
          <article key={label}>
            <Icon size={18} />
            <div><strong>{value}</strong><span>{label}</span></div>
          </article>
        ))}
      </div>

      <div className="automationFilters" aria-label="Filter automation activity">
        {FILTERS.map(([value, label]) => (
          <button
            type="button"
            className={filter === value ? "active" : ""}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="managerNotice error">{error}</div> : null}
      <div className="automationActivityList" aria-live="polite">
        {loading && activity.items.length === 0 ? (
          <div className="managerEmpty"><LoaderCircle className="spin" /><span>Loading automation activity…</span></div>
        ) : visibleItems.length === 0 ? (
          <div className="managerEmpty"><Activity /><span>No tasks match this view.</span></div>
        ) : visibleItems.map((item) => (
          <article className={"automationActivityItem status-" + item.status} key={item.type + "-" + item.id}>
            <div className="automationActivityTop">
              <span className="automationStatus">{statusLabel(item.status)}</span>
              <time dateTime={item.timestampUtc}>{formatTime(item.timestampUtc)}</time>
            </div>
            <h3>{item.title}</h3>
            <p>{item.error || item.resultSummary || item.summary}</p>
            <dl>
              <div><dt>Model</dt><dd>{item.model || "Not assigned"}</dd></div>
              <div><dt>Target</dt><dd>{item.target || "Not assigned"}</dd></div>
              <div><dt>Retry</dt><dd>{retryLabel(item.retryStatus)}</dd></div>
              <div><dt>Task ID</dt><dd>{item.id}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
