import {
  COMMUNITY_SCHEMA_VERSION,
  CommunityDiscordFeedSchema
} from "./community-discord.js";

export const ECOSYSTEM_HEALTH_SCHEMA_VERSION = "1.0";
export const DEFAULT_HEALTH_TIMEOUT_MS = 4000;
export const PUBLIC_WEBSITE_URL = "https://thebrokie.com";
export const BROKIE_OS_ORIGIN = "https://admin.thebrokie.com";

const STOREFRONT_FEED_PATH = "/api/storefront/featured";
const COMMUNITY_FEED_PATH = "/api/community/discord";
const MOBILE_API_PATH = "/api/mobile/app";
const LOCAL_BRIDGE_SESSION_PATH = "/api/ai/session";

const CHECK_IDS = {
  website: "website",
  storefrontFeed: "storefrontFeed",
  communityFeed: "communityFeed",
  mobileApi: "mobileApi",
  discordBot: "discordBot",
  localBridge: "localBridge"
};

export function redactSensitiveText(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[redacted]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted]")
    .replace(
      /\b(authorization|bearer|token|secret|password|api[_-]?key|console[_-]?key|cf-access-client-(?:id|secret)|x-brokie-console-key)\b([=:\s]+)[^\s]+/gi,
      "$1$2[redacted]"
    )
    .replace(
      /\b[A-Za-z0-9+/_-]{24,}={0,2}\b/g,
      "[redacted]"
    );
}

export function isValidStorefrontFeed(payload) {
  return Boolean(
    payload &&
      payload.ok === true &&
      typeof payload.schemaVersion === "string" &&
      payload.schemaVersion.trim() &&
      payload.storefront &&
      typeof payload.storefront === "object" &&
      Array.isArray(payload.products) &&
      payload.brain &&
      typeof payload.brain === "object" &&
      payload.launch &&
      typeof payload.launch === "object"
  );
}

export function isValidCommunityFeed(payload) {
  return CommunityDiscordFeedSchema.safeParse(payload).success;
}

export function aggregateEcosystemStatus(checks) {
  const configured = (Array.isArray(checks) ? checks : []).filter(
    (check) => check?.status !== "unconfigured"
  );
  if (configured.length === 0) return "unconfigured";
  if (configured.some((check) => check.status !== "healthy")) return "degraded";
  return "healthy";
}

function isLocalBridgeConfigured(env) {
  return Boolean(
    String(env?.BROKIE_AI_BASE_URL || "").trim() &&
      String(env?.CF_ACCESS_CLIENT_ID || "").trim() &&
      String(env?.CF_ACCESS_CLIENT_SECRET || "").trim() &&
      String(env?.BROKIE_AI_CONSOLE_KEY || "").trim()
  );
}

function joinUrl(origin, path) {
  return `${String(origin || "").replace(/\/+$/, "")}${path}`;
}

function safeHttpStatus(response) {
  const status = Number(response?.status);
  return Number.isInteger(status) ? status : null;
}

function unconfiguredCheck(id, label, detail) {
  return {
    id,
    label,
    status: "unconfigured",
    latencyMs: null,
    httpStatus: null,
    detail
  };
}

function settledCheck({ id, label, startedAt, finishedAt, httpStatus, status, detail }) {
  return {
    id,
    label,
    status,
    latencyMs: Math.max(0, finishedAt - startedAt),
    httpStatus,
    detail: redactSensitiveText(detail)
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

class ProbeTimeoutError extends Error {
  constructor() {
    super("Probe timed out.");
    this.name = "ProbeTimeoutError";
  }
}

function isTimeoutError(error) {
  return (
    error instanceof ProbeTimeoutError ||
    error?.name === "AbortError" ||
    error?.name === "TimeoutError"
  );
}

async function probeGet({ fetchImpl, url, timeoutMs, headers }) {
  const controller = new AbortController();
  let timer = null;

  const fetchPromise = Promise.resolve(
    fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/html;q=0.8, */*;q=0.5",
        ...(headers || {})
      }
    })
  );

  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ProbeTimeoutError());
      }, timeoutMs);

      fetchPromise.then(
        (response) => resolve(response),
        (error) => {
          if (controller.signal.aborted || isTimeoutError(error)) {
            reject(new ProbeTimeoutError());
            return;
          }
          reject(error);
        }
      );
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function failureDetail(error) {
  if (isTimeoutError(error)) return "Timed out.";
  return redactSensitiveText(error?.message || "Request failed.");
}

async function runCheck({
  id,
  label,
  fetchImpl,
  url,
  timeoutMs,
  now,
  headers,
  evaluate
}) {
  const startedAt = now().getTime();
  try {
    const response = await probeGet({ fetchImpl, url, timeoutMs, headers });
    const finishedAt = now().getTime();
    const httpStatus = safeHttpStatus(response);
    const result = await evaluate(response, httpStatus);
    return settledCheck({
      id,
      label,
      startedAt,
      finishedAt,
      httpStatus,
      status: result.status,
      detail: result.detail
    });
  } catch (error) {
    return settledCheck({
      id,
      label,
      startedAt,
      finishedAt: now().getTime(),
      httpStatus: null,
      status: "degraded",
      detail: failureDetail(error)
    });
  }
}

async function collectWebsite({ fetchImpl, websiteUrl, timeoutMs, now }) {
  return runCheck({
    id: CHECK_IDS.website,
    label: "Public website",
    fetchImpl,
    url: websiteUrl,
    timeoutMs,
    now,
    evaluate(_response, httpStatus) {
      if (httpStatus >= 200 && httpStatus < 400) {
        return { status: "healthy", detail: "Reached the public website." };
      }
      return {
        status: "degraded",
        detail: `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

async function collectStorefrontFeed({ fetchImpl, origin, timeoutMs, now }) {
  if (!origin) {
    return unconfiguredCheck(
      CHECK_IDS.storefrontFeed,
      "Storefront feed",
      "Storefront feed origin is not available."
    );
  }

  return runCheck({
    id: CHECK_IDS.storefrontFeed,
    label: "Storefront feed",
    fetchImpl,
    url: joinUrl(origin, STOREFRONT_FEED_PATH),
    timeoutMs,
    now,
    async evaluate(response, httpStatus) {
      const payload = await readJson(response);
      if (httpStatus === 200 && isValidStorefrontFeed(payload)) {
        return { status: "healthy", detail: "Storefront feed shape is valid." };
      }
      if (httpStatus === 503 && payload?.ok === false) {
        return {
          status: "degraded",
          detail: "Storefront feed reported unavailable."
        };
      }
      return {
        status: "degraded",
        detail:
          httpStatus === 200
            ? "Storefront feed shape is invalid."
            : `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

async function collectCommunityFeed({ fetchImpl, origin, timeoutMs, now }) {
  if (!origin) {
    return unconfiguredCheck(
      CHECK_IDS.communityFeed,
      "Community feed",
      "Community feed origin is not available."
    );
  }

  return runCheck({
    id: CHECK_IDS.communityFeed,
    label: "Community feed",
    fetchImpl,
    url: joinUrl(origin, COMMUNITY_FEED_PATH),
    timeoutMs,
    now,
    async evaluate(response, httpStatus) {
      const payload = await readJson(response);
      if (httpStatus === 200 && isValidCommunityFeed(payload)) {
        return {
          status: "healthy",
          detail: `Community feed shape is valid (${COMMUNITY_SCHEMA_VERSION}).`
        };
      }
      return {
        status: "degraded",
        detail:
          httpStatus === 200
            ? "Community feed shape is invalid."
            : `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

async function collectMobileApi({ fetchImpl, origin, timeoutMs, now }) {
  if (!origin) {
    return unconfiguredCheck(
      CHECK_IDS.mobileApi,
      "Mobile API",
      "Mobile API origin is not available."
    );
  }

  return runCheck({
    id: CHECK_IDS.mobileApi,
    label: "Mobile API",
    fetchImpl,
    url: joinUrl(origin, MOBILE_API_PATH),
    timeoutMs,
    now,
    evaluate(_response, httpStatus) {
      if (httpStatus === 401 || httpStatus === 403) {
        return {
          status: "healthy",
          detail: "Mobile API auth gate is reachable."
        };
      }
      if (httpStatus >= 200 && httpStatus < 300) {
        return {
          status: "healthy",
          detail: "Mobile API responded successfully."
        };
      }
      return {
        status: "degraded",
        detail: `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

async function collectDiscordBot({ fetchImpl, discordBotUrl, timeoutMs, now }) {
  if (!discordBotUrl) {
    return unconfiguredCheck(
      CHECK_IDS.discordBot,
      "Discord bot",
      "No Discord bot probe is configured in Brokie OS."
    );
  }

  return runCheck({
    id: CHECK_IDS.discordBot,
    label: "Discord bot",
    fetchImpl,
    url: discordBotUrl,
    timeoutMs,
    now,
    evaluate(_response, httpStatus) {
      if (httpStatus >= 200 && httpStatus < 400) {
        return { status: "healthy", detail: "Discord bot probe succeeded." };
      }
      return {
        status: "degraded",
        detail: `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

async function collectLocalBridge({ fetchImpl, env, timeoutMs, now }) {
  if (!isLocalBridgeConfigured(env)) {
    return unconfiguredCheck(
      CHECK_IDS.localBridge,
      "Local bridge",
      "Local bridge credentials are not configured."
    );
  }

  const baseUrl = String(env.BROKIE_AI_BASE_URL).replace(/\/+$/, "");
  return runCheck({
    id: CHECK_IDS.localBridge,
    label: "Local bridge",
    fetchImpl,
    url: `${baseUrl}${LOCAL_BRIDGE_SESSION_PATH}`,
    timeoutMs,
    now,
    headers: {
      "CF-Access-Client-Id": String(env.CF_ACCESS_CLIENT_ID),
      "CF-Access-Client-Secret": String(env.CF_ACCESS_CLIENT_SECRET),
      "X-Brokie-Console-Key": String(env.BROKIE_AI_CONSOLE_KEY)
    },
    evaluate(_response, httpStatus) {
      if (httpStatus >= 200 && httpStatus < 300) {
        return { status: "healthy", detail: "Local bridge session is reachable." };
      }
      return {
        status: "degraded",
        detail: `Unexpected HTTP ${httpStatus ?? "response"}.`
      };
    }
  });
}

function reportContainsSensitiveUrl(report, urls) {
  const serialized = JSON.stringify(report);
  return urls.some((url) => url && serialized.includes(url));
}

function stripSensitiveTargets(report, urls) {
  const tokens = [...new Set(urls.filter(Boolean).map(String))].sort(
    (left, right) => right.length - left.length
  );
  const scrub = (value) => {
    let next = redactSensitiveText(value);
    for (const token of tokens) {
      if (token && next.includes(token)) {
        next = next.split(token).join("[redacted]");
      }
    }
    return next;
  };

  if (!reportContainsSensitiveUrl(report, tokens) && tokens.length === 0) {
    return report;
  }

  return {
    ...report,
    checks: report.checks.map((check) => ({
      ...check,
      detail: scrub(check.detail)
    }))
  };
}

export async function collectEcosystemHealth({
  fetch: fetchImpl = globalThis.fetch.bind(globalThis),
  env = process.env,
  origin = BROKIE_OS_ORIGIN,
  websiteUrl = PUBLIC_WEBSITE_URL,
  discordBotUrl = null,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
  now = () => new Date()
} = {}) {
  const startedAt = now();
  const boundedTimeout = Math.max(1, Number(timeoutMs) || DEFAULT_HEALTH_TIMEOUT_MS);

  const checks = await Promise.all([
    collectWebsite({ fetchImpl, websiteUrl, timeoutMs: boundedTimeout, now }),
    collectStorefrontFeed({ fetchImpl, origin, timeoutMs: boundedTimeout, now }),
    collectCommunityFeed({ fetchImpl, origin, timeoutMs: boundedTimeout, now }),
    collectMobileApi({ fetchImpl, origin, timeoutMs: boundedTimeout, now }),
    collectDiscordBot({
      fetchImpl,
      discordBotUrl,
      timeoutMs: boundedTimeout,
      now
    }),
    collectLocalBridge({ fetchImpl, env, timeoutMs: boundedTimeout, now })
  ]);

  const finishedAt = now();
  const report = {
    ok: true,
    schemaVersion: ECOSYSTEM_HEALTH_SCHEMA_VERSION,
    status: aggregateEcosystemStatus(checks),
    checkedAt: startedAt.toISOString(),
    latencyMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    checks
  };

  const secretUrls = [
    websiteUrl,
    origin,
    discordBotUrl,
    env?.BROKIE_AI_BASE_URL
  ]
    .filter(Boolean)
    .flatMap((value) => [
      String(value),
      String(value).replace(/^https?:\/\//i, "")
    ]);

  return stripSensitiveTargets(report, secretUrls);
}
