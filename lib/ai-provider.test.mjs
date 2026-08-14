import test from "node:test";
import assert from "node:assert/strict";
import { getAiProviderConfig } from "./ai-provider.js";

test("hybrid AI defaults to local-first routing", () => {
  const config = getAiProviderConfig({});
  assert.equal(config.routing, "local-first");
  assert.equal(config.ollamaUrl, "http://127.0.0.1:11434");
  assert.equal(config.ollamaModel, "qwen2.5:7b");
  assert.equal(config.openaiModel, "gpt-5.4-mini");
  assert.equal(config.hasOpenAiKey, false);
});

test("hybrid AI honors explicit provider configuration", () => {
  const config = getAiProviderConfig({
    AI_TEXT_ROUTING: "cloud-only",
    OLLAMA_BASE_URL: "http://10.0.0.25:11434/",
    OLLAMA_TEXT_MODEL: "llama3.1:8b",
    OPENAI_TEXT_MODEL: "gpt-5.4-mini",
    OPENAI_API_KEY: "test-key"
  });

  assert.equal(config.routing, "cloud-only");
  assert.equal(config.ollamaUrl, "http://10.0.0.25:11434");
  assert.equal(config.ollamaModel, "llama3.1:8b");
  assert.equal(config.hasOpenAiKey, true);
});
