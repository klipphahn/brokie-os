import {
  fetchBrokieAi,
  normalizeSystemOverview,
  readBrokieAiResponse
} from "./brokie-ai.js";

export const MOBILE_SYSTEM_TIMEOUT_MS = 4000;

export function unavailableMobileSystemOverview() {
  return {
    available: false,
    timestampUtc: null,
    overallStatus: "unknown",
    monitored: 0,
    counts: { healthy: 0, warning: 0, critical: 0, unknown: 0 },
    alerts: []
  };
}

async function fetchCurrentSystemOverview() {
  const response = await fetchBrokieAi("/api/ai/system", {
    timeoutMs: MOBILE_SYSTEM_TIMEOUT_MS
  });
  return readBrokieAiResponse(response);
}

export async function loadMobileSystemOverview(
  fetchSystemOverview = fetchCurrentSystemOverview
) {
  try {
    const payload = await fetchSystemOverview();
    const overview = normalizeSystemOverview(payload);
    return {
      available: true,
      timestampUtc: overview.timestampUtc,
      overallStatus: overview.overallStatus,
      monitored: overview.monitored,
      counts: overview.counts,
      alerts: overview.alerts
    };
  } catch {
    return unavailableMobileSystemOverview();
  }
}
