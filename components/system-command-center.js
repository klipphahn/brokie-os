"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot, CheckCircle2, CircleHelp, Globe2, HardDrive, MessagesSquare,
  MonitorSmartphone, Network, RefreshCw, Server, ShieldAlert, ShoppingBag,
  Smartphone, TriangleAlert, Workflow
} from "lucide-react";
import {
  commandCenterFrameStatus,
  normalizeEcosystemHealthView
} from "@/lib/ecosystem-health-view";

const ICONS = {
  network: Network,
  computers: MonitorSmartphone,
  ai: Bot,
  virtualization: Server,
  storage: HardDrive,
  websites: Globe2,
  automation: Workflow
};

const ECOSYSTEM_ICONS = {
  website: Globe2,
  storefrontFeed: ShoppingBag,
  communityFeed: MessagesSquare,
  mobileApi: Smartphone,
  discordBot: Bot,
  localBridge: Network
};

const EMPTY_OVERVIEW = {
  overallStatus: "unknown",
  counts: {},
  monitored: 0,
  alerts: [],
  categories: [],
  timestampUtc: null
};
const EMPTY_LIST = [];

function formatTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

function statusLabel(status) {
  return status === "healthy" ? "All healthy" : String(status || "unknown").replaceAll("-", " ");
}

function StatusIcon({ status, size = 17 }) {
  if (status === "healthy") return <CheckCircle2 size={size} aria-hidden="true" />;
  if (status === "critical" || status === "degraded") return <ShieldAlert size={size} aria-hidden="true" />;
  if (status === "warning") return <TriangleAlert size={size} aria-hidden="true" />;
  return <CircleHelp size={size} aria-hidden="true" />;
}

function EcosystemStatusIcon({ status, size = 17 }) {
  if (status === "healthy") return <CheckCircle2 size={size} aria-hidden="true" />;
  if (status === "degraded") return <TriangleAlert size={size} aria-hidden="true" />;
  return <CircleHelp size={size} aria-hidden="true" />;
}

async function readJsonSnapshot(url, failedMessage, { requireOk = true } = {}) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || payload == null || (requireOk && !payload.ok) || payload.ok === false) {
      return { ok: false, error: String(payload?.error || failedMessage) };
    }

    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: String(error?.message || failedMessage) };
  }
}

function EcosystemServiceCard({ check }) {
  const Icon = ECOSYSTEM_ICONS[check.icon] || Server;
  const metrics = [
    check.latencyLabel ? ["Latency", check.latencyLabel] : null,
    check.httpStatusLabel ? ["HTTP status", check.httpStatusLabel] : null
  ].filter(Boolean);

  return (
    <article className={`ecosystemServiceCard status-${check.status}`}>
      <header>
        <div className="ecosystemServiceIcon"><Icon size={20} aria-hidden="true" /></div>
        <div>
          <h4>{check.label}</h4>
          <p className={`ecosystemServiceStatus status-${check.status}`}>
            <EcosystemStatusIcon status={check.status} size={14} />
            {check.statusLabel}
          </p>
        </div>
      </header>
      {metrics.length ? (
        <dl>
          {metrics.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p>{check.detail}</p>
    </article>
  );
}

function EcosystemHealthSummary({ ecosystem, error, loading }) {
  const counts = [
    ["Healthy", ecosystem?.counts.healthy || 0, "healthy"],
    ["Degraded", ecosystem?.counts.degraded || 0, "degraded"],
    ["Unconfigured", ecosystem?.counts.unconfigured || 0, "unconfigured"]
  ];

  return (
    <section className="ecosystemHealth" aria-labelledby="ecosystem-health-heading">
      <div className="ecosystemHealthHead">
        <div>
          <span className="eyebrow">ECOSYSTEM HEALTH</span>
          <h3 id="ecosystem-health-heading">Public and operator surfaces</h3>
          <p>
            Website, storefront, community, mobile API, Discord bot, and local
            bridge probes from the protected Brokie OS health contract.
          </p>
        </div>
        {ecosystem ? (
          <span className={`systemOverall status-${ecosystem.status}`}>
            <EcosystemStatusIcon status={ecosystem.status} /> {ecosystem.statusLabel}
          </span>
        ) : null}
      </div>

      {error ? <div className="managerNotice error" role="status">{error}</div> : null}

      {ecosystem ? (
        <>
          <div className="ecosystemMeta">
            <span>Checked {formatTime(ecosystem.checkedAt)}</span>
            <span>
              {ecosystem.latencyLabel
                ? `Total probe latency ${ecosystem.latencyLabel}`
                : "Total probe latency unavailable"}
            </span>
          </div>
          <div className="ecosystemCounts">
            {counts.map(([label, value, status]) => (
              <article className={`status-${status}`} key={label}>
                <EcosystemStatusIcon status={status} size={19} />
                <div><strong>{value}</strong><span>{label}</span></div>
              </article>
            ))}
          </div>
          {ecosystem.unconfiguredExplanation ? (
            <p className="ecosystemUnconfiguredNote">{ecosystem.unconfiguredExplanation}</p>
          ) : null}
          <div className="ecosystemServiceGrid">
            {ecosystem.checks.map((check) => (
              <EcosystemServiceCard check={check} key={check.id} />
            ))}
          </div>
        </>
      ) : loading ? (
        <div className="managerEmpty">
          <RefreshCw className="spin" aria-hidden="true" />
          <span>Collecting ecosystem health…</span>
        </div>
      ) : (
        <div className="managerEmpty">
          <CircleHelp aria-hidden="true" />
          <span>Ecosystem health has not loaded yet.</span>
        </div>
      )}
    </section>
  );
}

export default function SystemCommandCenter() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [ecosystem, setEcosystem] = useState(null);
  const [selected, setSelected] = useState("all");
  const [loading, setLoading] = useState(true);
  const [ecosystemError, setEcosystemError] = useState("");
  const [systemError, setSystemError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ecosystemResult, systemResult] = await Promise.all([
      readJsonSnapshot("/api/ecosystem/health", "Ecosystem health is unavailable.", {
        requireOk: false
      }),
      readJsonSnapshot("/api/local-ai/system", "System refresh failed.")
    ]);

    if (ecosystemResult.ok) {
      setEcosystem(normalizeEcosystemHealthView(ecosystemResult.payload));
      setEcosystemError("");
    } else {
      setEcosystemError(ecosystemResult.error);
    }

    if (systemResult.ok) {
      setOverview(systemResult.payload);
      setSystemError("");
    } else {
      setSystemError(systemResult.error);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const categories = Array.isArray(overview.categories) ? overview.categories : EMPTY_LIST;
  const alerts = Array.isArray(overview.alerts) ? overview.alerts : EMPTY_LIST;
  const visibleCategories = useMemo(
    () => selected === "all" ? categories : categories.filter((item) => item.id === selected),
    [categories, selected]
  );
  const hasSystemSnapshot = categories.length > 0 || Boolean(overview.timestampUtc);
  const frameStatus = commandCenterFrameStatus(ecosystem?.status, overview.overallStatus);
  const stats = [
    ["Healthy", overview.counts?.healthy || 0, "healthy"],
    ["Warnings", overview.counts?.warning || 0, "warning"],
    ["Critical", overview.counts?.critical || 0, "critical"],
    ["Unknown", overview.counts?.unknown || 0, "unknown"]
  ];

  return (
    <section
      className={`panel systemCommandCenter status-${frameStatus}`}
      id="system-command-center"
      aria-busy={loading}
    >
      <div className="panelHead systemCommandHead">
        <div>
          <span className="eyebrow">COMMAND CENTER</span>
          <h2>Brokie Command Center</h2>
          <p>
            Ecosystem reachability plus network, computers, AI, Proxmox, storage,
            websites, and automation in one view.
          </p>
        </div>
        <div className="systemCommandActions">
          <button
            type="button"
            className="secondary"
            onClick={load}
            disabled={loading}
            aria-busy={loading}
            aria-label={loading ? "Refreshing ecosystem and system health" : "Refresh ecosystem and system health"}
          >
            <RefreshCw className={loading ? "spin" : ""} size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <p className="srOnly" role="status" aria-live="polite">
        {loading ? "Refreshing ecosystem and system health." : ""}
      </p>

      <EcosystemHealthSummary
        ecosystem={ecosystem}
        error={ecosystemError}
        loading={loading}
      />

      <div className="systemLocalBlock" aria-label="Whole-system monitoring">
        <div className="systemLocalHead">
          <div>
            <span className="eyebrow">WHOLE-SYSTEM MONITORING</span>
            <p>Network, computers, AI, Proxmox, storage, websites, and automation.</p>
          </div>
          <span className={`systemOverall status-${overview.overallStatus || "unknown"}`}>
            <StatusIcon status={overview.overallStatus} /> {statusLabel(overview.overallStatus)}
          </span>
        </div>

        <div className="systemSnapshotLine">
          <strong>{overview.monitored || 0}</strong> checks monitored
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

        {systemError ? <div className="managerNotice error" role="status">{systemError}</div> : null}
        {alerts.length ? (
          <div className="systemAlerts" aria-label="System alerts">
            <div className="systemSectionTitle"><TriangleAlert size={17} aria-hidden="true" /><strong>Needs attention</strong><span>{alerts.length}</span></div>
            {alerts.slice(0, 8).map((alert, index) => (
              <article className={`status-${alert.severity}`} key={`${alert.source}-${index}`}>
                <StatusIcon status={alert.severity} />
                <div><strong>{alert.source}</strong><p>{alert.message}</p>{alert.detail ? <small>{alert.detail}</small> : null}</div>
              </article>
            ))}
          </div>
        ) : hasSystemSnapshot || (!loading && !systemError) ? (
          <div className="systemAllClear"><CheckCircle2 aria-hidden="true" /><strong>No active warnings or critical alerts.</strong></div>
        ) : null}

        <div className="systemCategoryTabs" aria-label="Filter system categories">
          <button type="button" className={selected === "all" ? "active" : ""} aria-pressed={selected === "all"} onClick={() => setSelected("all")}>All systems</button>
          {categories.map((category) => (
            <button type="button" className={selected === category.id ? `active status-${category.status}` : `status-${category.status}`} aria-pressed={selected === category.id} onClick={() => setSelected(category.id)} key={category.id}>
              {category.name}<span>{Array.isArray(category.items) ? category.items.length : 0}</span>
            </button>
          ))}
        </div>

        <div className="systemCategoryGrid" aria-live="polite">
          {loading && categories.length === 0 ? (
            <div className="managerEmpty"><RefreshCw className="spin" aria-hidden="true" /><span>Collecting system health…</span></div>
          ) : visibleCategories.map((category) => {
            const Icon = ICONS[category.id] || Server;
            const categoryItems = Array.isArray(category.items) ? category.items : [];
            const items = selected === "all" ? categoryItems.slice(0, 8) : categoryItems;
            return (
              <article className={`systemCategory status-${category.status}`} key={category.id}>
                <header>
                  <div className="systemCategoryIcon"><Icon size={20} aria-hidden="true" /></div>
                  <div><h3>{category.name}</h3><p>{category.description}</p></div>
                  <span className={`systemStatusDot status-${category.status}`} title={category.status} aria-hidden="true" />
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
                {categoryItems.length > items.length ? (
                  <button type="button" className="systemViewCategory" onClick={() => setSelected(category.id)}>
                    View {categoryItems.length - items.length} more checks
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
