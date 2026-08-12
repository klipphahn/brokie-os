const ALLOWED_MODES = new Set([
  "assistant",
  "content-metadata",
  "log-summary",
  "job-routing"
]);

function readConfig() {
  const baseUrl = process.env.BROKIE_AI_BASE_URL?.replace(/\/+$/, "");
  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  const consoleKey = process.env.BROKIE_AI_CONSOLE_KEY;

  if (!baseUrl || !clientId || !clientSecret || !consoleKey) {
    throw new Error("Brokie AI server credentials are not configured.");
  }

  return { baseUrl, clientId, clientSecret, consoleKey };
}

export function normalizeBrokieAiRequest(body) {
  const mode = String(body?.mode || "assistant");
  const prompt = String(body?.prompt || "").trim();
  const conversation = Array.isArray(body?.conversation)
    ? body.conversation.slice(-6).map((item) => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        text: String(item?.text || "").slice(0, 1500)
      }))
    : [];

  if (!ALLOWED_MODES.has(mode)) {
    throw new Error("Unsupported Brokie AI work mode.");
  }

  if (!prompt || prompt.length > 8000) {
    throw new Error("Prompt must be between 1 and 8,000 characters.");
  }

  return {
    mode,
    prompt,
    context: { source: "brokie-os", conversation }
  };
}

const ALLOWED_QUEUE_ADAPTERS = new Set([
  "auto",
  "assistant",
  "content-metadata",
  "log-summary",
  "job-routing",
  "failure-analysis",
  "storage-classification",
  "context-compression"
]);

export function normalizeBrokieAiQueueRequest(body) {
  const text = String(body?.text || "").trim();
  const adapter = String(body?.adapter || "auto");
  const repository = body?.repository ? String(body.repository) : null;
  const testProfile = body?.testProfile ? String(body.testProfile) : null;

  if (!text || text.length > 20000) {
    throw new Error("Task must be between 1 and 20,000 characters.");
  }
  if (!ALLOWED_QUEUE_ADAPTERS.has(adapter)) {
    throw new Error("Unsupported queue adapter.");
  }
  if (repository && repository !== "brokie-os") {
    throw new Error("Repository is not allowlisted.");
  }
  if (testProfile && !["node-test", "node-lint"].includes(testProfile)) {
    throw new Error("Test profile is not allowlisted.");
  }

  return { text, adapter, repository, testProfile };
}

export function normalizeProposalDecision(body) {
  const action = String(body?.action || "");
  if (!["approve", "reject"].includes(action)) {
    throw new Error("Decision must be approve or reject.");
  }
  return { action };
}

const ACTIVITY_STATUSES = new Set([
  "queued",
  "approved",
  "processing",
  "completed",
  "failed",
  "awaiting-approval",
  "rejected"
]);

export function normalizeAutomationActivity(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items.slice(0, 100).flatMap((item) => {
        const id = String(item?.id || "").slice(0, 160);
        const status = String(item?.status || "");
        if (!id || !ACTIVITY_STATUSES.has(status)) return [];
        return [{
          id,
          type: item?.type === "cursor" ? "cursor" : "local-ai",
          status,
          timestampUtc: String(item?.timestampUtc || ""),
          title: String(item?.title || "Automation task").slice(0, 160),
          summary: String(item?.summary || "No summary available.").slice(0, 1000),
          model: item?.model ? String(item.model).slice(0, 100) : null,
          target: item?.target ? String(item.target).slice(0, 120) : null,
          resultSummary: item?.resultSummary ? String(item.resultSummary).slice(0, 1000) : null,
          error: item?.error ? String(item.error).slice(0, 1000) : null,
          retryStatus: ["not-scheduled", "scheduled", "exhausted"].includes(item?.retryStatus)
            ? item.retryStatus
            : "not-applicable",
          testProfile: item?.testProfile ? String(item.testProfile).slice(0, 80) : null
        }];
      })
    : [];

  const count = (key) => Math.max(0, Number(payload?.counts?.[key]) || 0);
  return {
    timestampUtc: payload?.timestampUtc ? String(payload.timestampUtc) : null,
    counts: {
      queued: count("queued"),
      processing: count("processing"),
      completed: count("completed"),
      failed: count("failed"),
      awaitingApproval: count("awaitingApproval")
    },
    items
  };
}

const HEALTH_STATUSES = new Set(["healthy", "warning", "critical", "unknown"]);

function normalizeHealthStatus(value) {
  const status = String(value || "unknown");
  return HEALTH_STATUSES.has(status) ? status : "unknown";
}

export function normalizeSystemOverview(payload) {
  const categories = Array.isArray(payload?.categories)
    ? payload.categories.slice(0, 12).flatMap((category) => {
        const id = String(category?.id || "").slice(0, 80);
        if (!id) return [];
        const items = Array.isArray(category?.items)
          ? category.items.slice(0, 100).flatMap((item) => {
              const itemId = String(item?.id || "").slice(0, 160);
              if (!itemId) return [];
              return [{
                id: itemId,
                name: String(item?.name || "System check").slice(0, 160),
                status: normalizeHealthStatus(item?.status),
                summary: String(item?.summary || "No status summary available.").slice(0, 500),
                detail: item?.detail ? String(item.detail).slice(0, 1000) : null,
                timestampUtc: item?.timestampUtc ? String(item.timestampUtc) : null
              }];
            })
          : [];
        const counts = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
        items.forEach((item) => { counts[item.status] += 1; });
        const categoryStatus = counts.critical
          ? "critical"
          : counts.warning
            ? "warning"
            : counts.unknown
              ? "unknown"
              : "healthy";
        return [{
          id,
          name: String(category?.name || id).slice(0, 120),
          description: String(category?.description || "").slice(0, 500),
          status: categoryStatus,
          counts,
          items
        }];
      })
    : [];

  const counts = { healthy: 0, warning: 0, critical: 0, unknown: 0 };
  categories.forEach((category) => {
    Object.keys(counts).forEach((key) => { counts[key] += category.counts[key]; });
  });
  const alerts = Array.isArray(payload?.alerts)
    ? payload.alerts.slice(0, 50).map((alert) => ({
        severity: normalizeHealthStatus(alert?.severity),
        source: String(alert?.source || "System").slice(0, 160),
        message: String(alert?.message || "Attention required.").slice(0, 500),
        detail: alert?.detail ? String(alert.detail).slice(0, 1000) : null,
        timestampUtc: alert?.timestampUtc ? String(alert.timestampUtc) : null
      })).filter((alert) => ["warning", "critical"].includes(alert.severity))
    : [];
  const overallStatus = counts.critical
    ? "critical"
    : counts.warning
      ? "warning"
      : counts.unknown
        ? "unknown"
        : "healthy";

  return {
    timestampUtc: payload?.timestampUtc ? String(payload.timestampUtc) : null,
    overallStatus,
    monitored: categories.reduce((total, category) => total + category.items.length, 0),
    counts,
    alerts,
    categories
  };
}

export async function fetchBrokieAi(path, options = {}) {
  const { baseUrl, clientId, clientSecret, consoleKey } = readConfig();

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "CF-Access-Client-Id": clientId,
      "CF-Access-Client-Secret": clientSecret,
      "X-Brokie-Console-Key": consoleKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    },
    cache: "no-store",
    signal: AbortSignal.timeout(55000)
  });
}

export async function readBrokieAiResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.detail || payload?.error || "Brokie AI is currently unavailable."
    );
  }

  return payload || {};
}
