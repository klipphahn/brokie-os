"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot, CheckCircle2, CircleHelp, Globe2, HardDrive, MonitorSmartphone,
  Network, RefreshCw, Server, ShieldAlert, TriangleAlert, Workflow
} from "lucide-react";

const ICONS = {
  network: Network,
  computers: MonitorSmartphone,
  ai: Bot,
  virtualization: Server,
  storage: HardDrive,
  websites: Globe2,
  automation: Workflow
};

function formatTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function statusLabel(status) {
  return status === "healthy" ? "All healthy" : status.replaceAll("-", " ");
}

function StatusIcon({ status, size = 17 }) {
  if (status === "healthy") return <CheckCircle2 size={size} />;
  if (status === "critical") return <ShieldAlert size={size} />;
  if (status === "warning") return <TriangleAlert size={size} />;
  return <CircleHelp size={size} />;
}

export default function SystemCommandCenter() {
  const [overview, setOverview] = useState({
    overallStatus: "unknown", counts: {}, monitored: 0, alerts: [], categories: [], timestampUtc: null
  });
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/local-ai/system", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "System refresh failed.");
      setOverview(payload);
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

  const visibleCategories = useMemo(
    () => selected === "all" ? overview.categories : overview.categories.filter((item) => item.id === selected),
    [overview.categories, selected]
  );
  const stats = [
    ["Healthy", overview.counts.healthy || 0, "healthy"],
    ["Warnings", overview.counts.warning || 0, "warning"],
    ["Critical", overview.counts.critical || 0, "critical"],
    ["Unknown", overview.counts.unknown || 0, "unknown"]
  ];

  return (
    <section className={`panel systemCommandCenter status-${overview.overallStatus}`} id="system-command-center">
      <div className="panelHead systemCommandHead">
        <div>
          <span className="eyebrow">WHOLE-SYSTEM MONITORING</span>
          <h2>Brokie Command Center</h2>
          <p>Network, computers, AI, Proxmox, storage, websites, and automation in one view.</p>
        </div>
        <div className="systemCommandActions">
          <span className={`systemOverall status-${overview.overallStatus}`}>
            <StatusIcon status={overview.overallStatus} /> {statusLabel(overview.overallStatus)}
          </span>
          <button type="button" className="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="systemSnapshotLine">
        <strong>{overview.monitored}</strong> checks monitored
        <span>Snapshot: {formatTime(overview.timestampUtc)}</span>
      </div>

      <div className="systemHealthStats">
        {stats.map(([label, value, status]) => (
          <article className={`status-${status}`} key={label}>
            <StatusIcon status={status} size={19} />
            <div><strong>{value}</strong><span>{label}</span></div>
          </article>
        ))}
      </div>

      {error ? <div className="managerNotice error">{error}</div> : null}
      {overview.alerts.length ? (
        <div className="systemAlerts" aria-label="System alerts">
          <div className="systemSectionTitle"><TriangleAlert size={17} /><strong>Needs attention</strong><span>{overview.alerts.length}</span></div>
          {overview.alerts.slice(0, 8).map((alert, index) => (
            <article className={`status-${alert.severity}`} key={`${alert.source}-${index}`}>
              <StatusIcon status={alert.severity} />
              <div><strong>{alert.source}</strong><p>{alert.message}</p>{alert.detail ? <small>{alert.detail}</small> : null}</div>
            </article>
          ))}
        </div>
      ) : !loading ? (
        <div className="systemAllClear"><CheckCircle2 /><strong>No active warnings or critical alerts.</strong></div>
      ) : null}

      <div className="systemCategoryTabs" aria-label="Filter system categories">
        <button type="button" className={selected === "all" ? "active" : ""} onClick={() => setSelected("all")}>All systems</button>
        {overview.categories.map((category) => (
          <button type="button" className={selected === category.id ? `active status-${category.status}` : `status-${category.status}`} onClick={() => setSelected(category.id)} key={category.id}>
            {category.name}<span>{category.items.length}</span>
          </button>
        ))}
      </div>

      <div className="systemCategoryGrid" aria-live="polite">
        {loading && overview.categories.length === 0 ? (
          <div className="managerEmpty"><RefreshCw className="spin" /><span>Collecting system health…</span></div>
        ) : visibleCategories.map((category) => {
          const Icon = ICONS[category.id] || Server;
          const items = selected === "all" ? category.items.slice(0, 8) : category.items;
          return (
            <article className={`systemCategory status-${category.status}`} key={category.id}>
              <header>
                <div className="systemCategoryIcon"><Icon size={20} /></div>
                <div><h3>{category.name}</h3><p>{category.description}</p></div>
                <span className={`systemStatusDot status-${category.status}`} title={category.status} />
              </header>
              <div className="systemCheckList">
                {items.map((item) => (
                  <div className={`systemCheck status-${item.status}`} key={item.id}>
                    <StatusIcon status={item.status} size={15} />
                    <div><strong>{item.name}</strong><span>{item.summary}</span>{item.detail ? <small>{item.detail}</small> : null}</div>
                    <time dateTime={item.timestampUtc || undefined}>{item.timestampUtc ? formatTime(item.timestampUtc) : "No report"}</time>
                  </div>
                ))}
              </div>
              {category.items.length > items.length ? (
                <button type="button" className="systemViewCategory" onClick={() => setSelected(category.id)}>
                  View {category.items.length - items.length} more checks
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
