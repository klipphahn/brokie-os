const SAFETY_MS = 5 * 60 * 1000;
let token = null;
let expiresAt = 0;

function getConfig() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2026-07";

  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error("Missing Shopify environment variables.");
  }

  return {
    storeDomain: storeDomain.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    clientId,
    clientSecret,
    apiVersion
  };
}

export async function getShopifyAccessToken() {
  const now = Date.now();
  if (token && expiresAt > now + SAFETY_MS) return token;

  const { storeDomain, clientId, clientSecret } = getConfig();
  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "Shopify token request failed.");
  }

  token = data.access_token;
  expiresAt = now + Number(data.expires_in || 86399) * 1000;
  return token;
}

export async function shopifyGraphQL(query, variables = {}) {
  const { storeDomain, apiVersion } = getConfig();
  const accessToken = await getShopifyAccessToken();

  const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store"
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    throw new Error(
      payload?.errors?.map((error) => error.message).join("; ") ||
      `Shopify request failed (${response.status}).`
    );
  }

  return payload.data;
}

export function shopifyAdminProductUrl(id) {
  const { storeDomain } = getConfig();
  return `https://admin.shopify.com/store/${storeDomain.replace(".myshopify.com", "")}/products/${String(id).split("/").pop()}`;
}
