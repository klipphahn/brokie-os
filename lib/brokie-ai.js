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
