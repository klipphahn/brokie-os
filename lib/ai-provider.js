const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

function cleanBaseUrl(value) {
  return String(value || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
}

export function getAiProviderConfig(env = process.env) {
  return {
    routing: String(env.AI_TEXT_ROUTING || "local-first").toLowerCase(),
    ollamaUrl: cleanBaseUrl(env.OLLAMA_BASE_URL),
    ollamaModel: env.OLLAMA_TEXT_MODEL || DEFAULT_OLLAMA_MODEL,
    openaiModel: env.OPENAI_TEXT_MODEL || DEFAULT_OPENAI_MODEL,
    hasOpenAiKey: Boolean(env.OPENAI_API_KEY)
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function getAiProviderStatus({ env = process.env } = {}) {
  const config = getAiProviderConfig(env);
  let local = { available: false, model: config.ollamaModel, url: config.ollamaUrl };

  try {
    const response = await fetchWithTimeout(`${config.ollamaUrl}/api/tags`, {}, 2500);
    if (response.ok) {
      const payload = await response.json();
      const models = Array.isArray(payload?.models) ? payload.models.map((item) => item?.name).filter(Boolean) : [];
      local = {
        ...local,
        available: true,
        installed: models,
        modelInstalled: models.includes(config.ollamaModel)
      };
    }
  } catch {
    // Local AI is optional; status remains unavailable and cloud can still serve requests.
  }

  return {
    routing: config.routing,
    local,
    cloud: {
      available: config.hasOpenAiKey,
      provider: "openai",
      model: config.openaiModel
    }
  };
}

async function generateWithOllama({ messages, schema, env = process.env }) {
  const config = getAiProviderConfig(env);
  const response = await fetchWithTimeout(
    `${config.ollamaUrl}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages,
        stream: false,
        format: schema || "json",
        options: { temperature: 0.7 }
      })
    },
    45000
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Ollama request failed with HTTP ${response.status}.`);
  }

  const text = payload?.message?.content;
  if (!text) throw new Error("Ollama returned no text.");
  return { provider: "ollama", model: config.ollamaModel, text };
}

function extractOpenAiOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

async function generateWithOpenAi({ messages, schema, schemaName = "brokie_ai_response", env = process.env }) {
  const config = getAiProviderConfig(env);
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured.");

  const input = messages.map((message) => ({
    role: message.role,
    content: [{ type: "input_text", text: message.content }]
  }));

  const body = { model: config.openaiModel, input };
  if (schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema
      }
    };
  }

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    },
    60000
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed with HTTP ${response.status}.`);
  }

  const text = extractOpenAiOutputText(payload);
  if (!text) throw new Error("OpenAI returned no text.");
  return { provider: "openai", model: config.openaiModel, text };
}

export async function generateText({ messages, schema, schemaName, env = process.env }) {
  const config = getAiProviderConfig(env);
  const routing = config.routing;
  const errors = [];

  const tryLocal = routing !== "cloud-only";
  const tryCloud = routing !== "local-only";

  if (tryLocal) {
    try {
      const result = await generateWithOllama({ messages, schema, env });
      return { ...result, fallbackUsed: false };
    } catch (error) {
      errors.push({ provider: "ollama", message: error.message });
    }
  }

  if (tryCloud) {
    try {
      const result = await generateWithOpenAi({ messages, schema, schemaName, env });
      return { ...result, fallbackUsed: tryLocal };
    } catch (error) {
      errors.push({ provider: "openai", message: error.message });
    }
  }

  const detail = errors.map((item) => `${item.provider}: ${item.message}`).join(" | ");
  throw new Error(`No AI text provider completed the request.${detail ? ` ${detail}` : ""}`);
}
