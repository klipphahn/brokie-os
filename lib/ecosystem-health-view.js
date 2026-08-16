export const ECOSYSTEM_CHECK_CATALOG = [
  { id: "website", label: "Public website", icon: "website" },
  { id: "storefrontFeed", label: "Storefront feed", icon: "storefrontFeed" },
  { id: "communityFeed", label: "Community feed", icon: "communityFeed" },
  { id: "mobileApi", label: "Mobile API", icon: "mobileApi" },
  { id: "discordBot", label: "Discord bot", icon: "discordBot" },
  { id: "localBridge", label: "Local bridge", icon: "localBridge" }
];

const ECOSYSTEM_STATUSES = new Set(["healthy", "degraded", "unconfigured"]);
const DETAIL_LIMIT = 500;

function asTrimmedString(value, fallback = "") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function safeDetail(value) {
  const text = asTrimmedString(value)
    .replace(/https?:\/\/[^\s]+/gi, "[redacted]")
    .slice(0, DETAIL_LIMIT)
    .trim();
  return text || "No detail available.";
}

export function formatLatencyMs(value) {
  if (value == null || value === "") return null;
  const latency = Number(value);
  if (!Number.isFinite(latency) || latency < 0) return null;
  return `${Math.round(latency)} ms`;
}

export function formatHttpStatus(value) {
  if (value == null || value === "") return null;
  const status = Number(value);
  if (!Number.isInteger(status) || status < 100 || status > 599) return null;
  return `HTTP ${status}`;
}

export function ecosystemStatusLabel(status) {
  if (status === "healthy") return "Healthy";
  if (status === "degraded") return "Degraded";
  if (status === "unconfigured") return "Unconfigured";
  return "Unknown";
}

const FRAME_SEVERITY = {
  critical: 0,
  degraded: 1,
  warning: 1,
  unknown: 2,
  unconfigured: 2,
  healthy: 3
};

function normalizeFrameStatus(value) {
  const status = asTrimmedString(value).toLowerCase();
  return Object.hasOwn(FRAME_SEVERITY, status) ? status : "unknown";
}

export function commandCenterFrameStatus(ecosystemStatus, localStatus) {
  const statuses = [ecosystemStatus, localStatus].map(normalizeFrameStatus);
  let worstRank = FRAME_SEVERITY.healthy;

  for (const status of statuses) {
    const rank = FRAME_SEVERITY[status];
    if (rank < worstRank) worstRank = rank;
  }

  if (worstRank === 0) return "critical";
  if (worstRank === 1) {
    return statuses.includes("degraded") ? "degraded" : "warning";
  }
  if (worstRank === 2) {
    return statuses.includes("unknown") ? "unknown" : "unconfigured";
  }
  return "healthy";
}

export function aggregateEcosystemViewStatus(checks) {
  const configured = (Array.isArray(checks) ? checks : []).filter(
    (check) => check?.status !== "unconfigured"
  );
  if (configured.length === 0) return "unconfigured";
  if (configured.some((check) => check.status !== "healthy")) return "degraded";
  return "healthy";
}

export function explainUnconfiguredServices(checks) {
  const unconfigured = (Array.isArray(checks) ? checks : []).filter(
    (check) => check?.status === "unconfigured"
  );
  if (unconfigured.length === 0) return "";

  const names = unconfigured
    .map((check) => asTrimmedString(check?.label, check?.id || "Service"))
    .join(", ");
  const verb = unconfigured.length === 1 ? "is" : "are";
  const parts = [
    `${names} ${verb} unconfigured. Unconfigured means required server-side settings are missing; it is not a healthy result.`
  ];

  if (unconfigured.some((check) => check.id === "discordBot")) {
    parts.push(
      "Discord bot stays unconfigured until Brokie OS defines a bot health URL; this dashboard will not invent a probe target."
    );
  }
  if (unconfigured.some((check) => check.id === "localBridge")) {
    parts.push(
      "Local bridge stays unconfigured until Brokie AI session credentials are set (BROKIE_AI_BASE_URL, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, and BROKIE_AI_CONSOLE_KEY)."
    );
  }

  parts.push("Add the missing configuration, then refresh this view.");
  return parts.join(" ");
}

function normalizeStatus(value, { missing } = {}) {
  if (missing) return "unconfigured";
  const status = asTrimmedString(value).toLowerCase();
  return ECOSYSTEM_STATUSES.has(status) ? status : "degraded";
}

function roundedMetric(value, label) {
  if (label == null) return null;
  return Math.round(Number(value));
}

function normalizeCheck(raw, catalog, { missing } = {}) {
  const status = normalizeStatus(raw?.status, { missing });
  const latencyLabel = formatLatencyMs(raw?.latencyMs);
  const httpStatusLabel = formatHttpStatus(raw?.httpStatus);
  const fallbackDetail = missing
    ? `${catalog.label} was not included in the health payload.`
    : status === "degraded" && !ECOSYSTEM_STATUSES.has(asTrimmedString(raw?.status).toLowerCase())
      ? "Unrecognized status."
      : "No detail available.";

  return {
    id: catalog.id,
    label: asTrimmedString(raw?.label, catalog.label),
    icon: catalog.icon,
    status,
    statusLabel: ecosystemStatusLabel(status),
    latencyMs: roundedMetric(raw?.latencyMs, latencyLabel),
    latencyLabel,
    httpStatus: httpStatusLabel ? Number(raw.httpStatus) : null,
    httpStatusLabel,
    detail: raw?.detail == null || asTrimmedString(raw?.detail) === ""
      ? fallbackDetail
      : safeDetail(raw.detail)
  };
}

export function normalizeEcosystemHealthView(payload) {
  const byId = new Map();
  if (Array.isArray(payload?.checks)) {
    for (const check of payload.checks) {
      const id = asTrimmedString(check?.id);
      if (id && !byId.has(id)) byId.set(id, check);
    }
  }

  const checks = ECOSYSTEM_CHECK_CATALOG.map((catalog) => {
    const raw = byId.get(catalog.id);
    return normalizeCheck(raw || { id: catalog.id }, catalog, { missing: !raw });
  });

  const counts = { healthy: 0, degraded: 0, unconfigured: 0 };
  for (const check of checks) {
    counts[check.status] += 1;
  }

  const status = aggregateEcosystemViewStatus(checks);
  const latencyLabel = formatLatencyMs(payload?.latencyMs);

  return {
    status,
    statusLabel: ecosystemStatusLabel(status),
    checkedAt: payload?.checkedAt ? String(payload.checkedAt) : null,
    latencyMs: roundedMetric(payload?.latencyMs, latencyLabel),
    latencyLabel,
    counts,
    checks,
    unconfiguredExplanation: explainUnconfiguredServices(checks)
  };
}
