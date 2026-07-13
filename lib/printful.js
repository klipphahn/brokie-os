const API_BASE = "https://api.printful.com";

function credentials() {
  const token = process.env.PRINTFUL_TOKEN?.trim();
  const storeId = process.env.PRINTFUL_STORE_ID?.trim();

  if (!token) {
    throw new Error("PRINTFUL_TOKEN is missing.");
  }

  if (!storeId) {
    throw new Error("PRINTFUL_STORE_ID is missing.");
  }

  return { token, storeId };
}

export function printfulHeaders(extra = {}) {
  const { token, storeId } = credentials();

  return {
    Authorization: `Bearer ${token}`,
    "X-PF-Store-Id": storeId,
    "Content-Type": "application/json",
    ...extra
  };
}

export async function printfulRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: printfulHeaders(options.headers || {}),
    cache: "no-store"
  });

  let payload;
  const text = await response.text();

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.result ||
      payload?.message ||
      `Printful request failed with HTTP ${response.status}.`;

    const error = new Error(
      typeof message === "string"
        ? message
        : JSON.stringify(message)
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function numericShopifyId(gid) {
  return String(gid || "").split("/").filter(Boolean).pop() || "";
}

export async function getPrintfulStores() {
  return printfulRequest("/stores");
}

export async function getSyncProductByExternalId(externalProductId) {
  const clean = String(externalProductId || "").replace(/^@/, "");
  if (!clean) throw new Error("A Shopify product ID is required.");

  return printfulRequest(
    `/sync/products/@${encodeURIComponent(clean)}`
  );
}

export async function getSyncProduct(syncProductId) {
  return printfulRequest(
    `/sync/products/${encodeURIComponent(syncProductId)}`
  );
}

export async function listSyncProducts(offset = 0, limit = 100) {
  return printfulRequest(
    `/sync/products?offset=${offset}&limit=${limit}`
  );
}

export async function listCatalogProducts() {
  return printfulRequest("/products");
}

export async function getCatalogProduct(productId) {
  return printfulRequest(
    `/products/${encodeURIComponent(productId)}`
  );
}

export async function configureSyncVariant(
  syncVariantId,
  payload
) {
  return printfulRequest(
    `/sync/variant/${encodeURIComponent(syncVariantId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizedSize(value) {
  const text = normalizeText(value)
    .replace(/\bextra small\b/g, "xs")
    .replace(/\bsmall\b/g, "s")
    .replace(/\bmedium\b/g, "m")
    .replace(/\blarge\b/g, "l")
    .replace(/\bextra large\b/g, "xl");

  const matches = text.match(
    /\b(5xl|4xl|3xl|2xl|xxxl|xxl|xl|xs|s|m|l)\b/g
  );

  if (!matches?.length) return "";
  const valueFound = matches[matches.length - 1];

  return {
    xxl: "2xl",
    xxxl: "3xl"
  }[valueFound] || valueFound;
}

function optionValues(variant) {
  if (Array.isArray(variant?.options)) {
    return variant.options.flatMap((option) => [
      option?.value,
      option?.name
    ]);
  }

  if (
    variant?.options &&
    typeof variant.options === "object"
  ) {
    return Object.entries(variant.options).flatMap(
      ([key, value]) => [key, value]
    );
  }

  return [];
}

export function syncVariantDescriptor(variant) {
  const values = [
    variant?.name,
    variant?.external_id,
    variant?.external_variant_id,
    variant?.sku,
    ...optionValues(variant)
  ].filter(Boolean);

  return normalizeText(values.join(" "));
}

export function catalogVariantDescriptor(variant) {
  return normalizeText(
    [
      variant?.name,
      variant?.color,
      variant?.size,
      variant?.sku,
      variant?.product?.name
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function extractCatalogResult(payload) {
  const result = payload?.result || {};
  const product = result?.product || result;
  const variants =
    result?.variants ||
    product?.variants ||
    [];

  return { product, variants };
}

export function extractSyncResult(payload) {
  const result = payload?.result || {};
  const syncProduct =
    result?.sync_product ||
    result?.product ||
    result;
  const syncVariants =
    result?.sync_variants ||
    result?.variants ||
    [];

  return { syncProduct, syncVariants };
}

export function variantIsSynced(variant) {
  return Boolean(
    variant?.synced === true ||
      variant?.is_synced === true ||
      (
        Number(variant?.variant_id || 0) > 0 &&
        Array.isArray(variant?.files) &&
        variant.files.length > 0
      )
  );
}

export function artworkIsReady(variant) {
  return Boolean(
    Array.isArray(variant?.files) &&
      variant.files.some(
        (file) =>
          file?.id ||
          file?.url ||
          file?.preview_url
      )
  );
}

export function findCatalogProduct(
  products,
  desiredName = "Comfort Colors 1717"
) {
  const target = normalizeText(desiredName);
  const items =
    products?.result ||
    products?.items ||
    products ||
    [];

  return (
    items.find(
      (product) =>
        normalizeText(product?.title || product?.name) === target
    ) ||
    items.find((product) =>
      normalizeText(product?.title || product?.name).includes(
        target
      )
    ) ||
    items.find((product) => {
      const name = normalizeText(
        product?.title || product?.name
      );
      return (
        name.includes("comfort colors") &&
        name.includes("1717")
      );
    })
  );
}

function exactColorMatch(descriptor, color) {
  const normalized = normalizeText(color);
  if (!normalized) return false;

  const paddedDescriptor = ` ${descriptor} `;
  return paddedDescriptor.includes(` ${normalized} `);
}

export function chooseCatalogVariant(
  syncVariant,
  catalogVariants,
  {
    defaultColor = "Black",
    defaultSize = "M"
  } = {}
) {
  const descriptor = syncVariantDescriptor(syncVariant);
  const isDefault =
    !descriptor ||
    descriptor.includes("default title") ||
    descriptor === "default";

  const requestedSize =
    normalizedSize(descriptor) ||
    normalizedSize(defaultSize);

  const colorCandidates = catalogVariants
    .map((variant) => variant?.color)
    .filter(Boolean);

  const requestedColor =
    colorCandidates.find((color) =>
      exactColorMatch(descriptor, color)
    ) || defaultColor;

  const available = catalogVariants.filter(
    (variant) =>
      variant?.in_stock !== false &&
      variant?.availability_status !== "discontinued"
  );

  const exact = available.find((variant) => {
    const size = normalizedSize(
      variant?.size || variant?.name
    );
    return (
      size === requestedSize &&
      normalizeText(variant?.color) ===
        normalizeText(requestedColor)
    );
  });

  if (exact) {
    return {
      variant: exact,
      confidence: isDefault ? "default" : "exact",
      requestedColor,
      requestedSize
    };
  }

  const sizeOnly = available.find(
    (variant) =>
      normalizedSize(variant?.size || variant?.name) ===
      requestedSize
  );

  if (sizeOnly) {
    return {
      variant: sizeOnly,
      confidence: "size-only",
      requestedColor,
      requestedSize
    };
  }

  const fallback = available[0] || catalogVariants[0];

  return {
    variant: fallback || null,
    confidence: "fallback",
    requestedColor,
    requestedSize
  };
}

export function printfulProductDashboardUrl(storeId) {
  return `https://www.printful.com/dashboard/store/${encodeURIComponent(
    storeId
  )}/products`;
}
