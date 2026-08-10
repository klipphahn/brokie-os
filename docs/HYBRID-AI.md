# Brokie OS Hybrid AI

Brokie OS can route text generation to a local Ollama node first and fall back to OpenAI when the local node is unavailable or cannot complete the request. Image generation remains on the existing OpenAI image path.

## Environment

```bash
AI_TEXT_ROUTING=local-first
OLLAMA_BASE_URL=http://YOUR-OLLAMA-NODE:11434
OLLAMA_TEXT_MODEL=qwen2.5:7b
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_API_KEY=...
```

`AI_TEXT_ROUTING` accepts `local-first`, `local-only`, or `cloud-only`.

## Routes

- `GET /api/ai/status` — authenticated provider health and model status.
- `POST /api/ai/text` — authenticated text gateway using local-first routing and automatic cloud fallback.

The text route returns the provider, model, and whether fallback was used so the admin UI can display where each request ran.

## Network note

The deployed Brokie OS server must be able to reach `OLLAMA_BASE_URL`. A private RFC1918 address such as `192.168.x.x` will not be reachable from a cloud deployment without a tunnel, VPN, reverse proxy, or other secure network path. Do not expose Ollama directly to the public Internet without authentication and transport security.

## Next integration seam

Existing features should import `generateText` from `lib/ai-provider.js` rather than calling OpenAI directly. The current merch artwork/image path should remain unchanged; only text/concept generation should move through the provider gateway.
