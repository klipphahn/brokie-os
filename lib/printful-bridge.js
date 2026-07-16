import {
  artworkIsReady,
  chooseCatalogVariant,
  configureSyncVariant,
  extractCatalogResult,
  extractSyncResult,
  findCatalogProduct,
  getCatalogProduct,
  getPrintfulStores,
  getSyncProduct,
  getSyncProductByExternalId,
  listCatalogProducts,
  numericShopifyId,
  normalizedSize,
  normalizeText,
  printfulProductDashboardUrl,
  variantIsSynced
} from "@/lib/printful";
import {
  defaultPrintfulBlankForProductType,
  getProductTypeTemplate,
  productTypeFamily
} from "@/lib/product-types";

export async function diagnosePrintful() {
  const stores = await getPrintfulStores();
  const configuredStoreId =
    process.env.PRINTFUL_STORE_ID?.trim();

  const list = Array.isArray(stores?.result)
    ? stores.result
    : stores?.result
      ? [stores.result]
      : [];

  const selected =
    list.find(
      (store) =>
        String(store?.id) === String(configuredStoreId)
    ) || list[0] || null;

  return {
    connected: true,
    configuredStoreId,
    selectedStore: selected,
    storeCount: list.length
  };
}

export async function discoverImportedProduct(
  shopifyProductGid
) {
  const externalId = numericShopifyId(shopifyProductGid);

  try {
    const payload =
      await getSyncProductByExternalId(externalId);
    const { syncProduct, syncVariants } =
      extractSyncResult(payload);

    return {
      found: true,
      externalId,
      syncProduct,
      syncVariants,
      payload
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        found: false,
        externalId,
        syncProduct: null,
        syncVariants: [],
        error:
          "The Shopify product has not finished importing into Printful yet."
      };
    }
    throw error;
  }
}

export async function resolveDefaultCatalogProduct(
  desiredName = "Comfort Colors 1717"
) {
  const list = await listCatalogProducts();
  const match = findCatalogProduct(list, desiredName);

  if (!match?.id) {
    throw new Error(
      `Printful catalog product "${desiredName}" was not found.`
    );
  }

  const payload = await getCatalogProduct(match.id);
  const { product, variants } =
    extractCatalogResult(payload);

  if (!variants.length) {
    throw new Error(
      `${desiredName} was found, but no catalog variants were returned.`
    );
  }

  return {
    product,
    variants,
    listMatch: match,
    payload
  };
}

const DEFAULT_BLANKS = {
  hoodie: "Independent Trading Co. IND4000",
  "long-sleeve": "Comfort Colors 6014",
  hat: "Closed-Back Trucker Cap | Flexfit 6511",
  sticker: "Die-Cut Stickers",
  tee: "Comfort Colors 1717"
};

export function resolveBlankNameForProductType(
  productType,
  override = ""
) {
  const requested = String(override || "").trim();
  if (requested) return requested;

  const family = productTypeFamily(productType);
  if (family === "headwear") {
    return process.env.PRINTFUL_DEFAULT_HAT ||
      DEFAULT_BLANKS.hat;
  }
  if (family === "sticker") {
    return process.env.PRINTFUL_DEFAULT_STICKER ||
      DEFAULT_BLANKS.sticker;
  }

  return (
    defaultPrintfulBlankForProductType(productType) ||
    process.env.PRINTFUL_DEFAULT_BLANK ||
    DEFAULT_BLANKS.tee
  );
}

function buildSyncFiles({
  productType,
  frontArtworkUrl,
  backArtworkUrl
}) {
  const family = productTypeFamily(productType);
  const template = getProductTypeTemplate(productType);
  const isAccessory = family !== "apparel";

  const files = [];
  if (frontArtworkUrl) {
    files.push({
      type: template.printfulFrontFileType || "front",
      url: frontArtworkUrl
    });
  }

  if (!isAccessory && backArtworkUrl) {
    files.push({ type: "back", url: backArtworkUrl });
  }

  return files;
}

export async function inspectPrintfulProduct({
  shopifyProductId,
  syncProductId,
  productType = "Heavyweight Tee"
}) {
  const discovered = syncProductId
    ? (() => getSyncProduct(syncProductId))()
    : null;

  const payload = discovered
    ? await discovered
    : (
        await discoverImportedProduct(shopifyProductId)
      ).payload;

  if (!payload) {
    return {
      found: false,
      ready: false,
      syncProduct: null,
      variants: [],
      totalVariants: 0,
      syncedVariants: 0,
      artworkReadyVariants: 0
    };
  }

  const { syncProduct, syncVariants } =
    extractSyncResult(payload);
  const template = getProductTypeTemplate(productType);
  const requiredFileTypes = template.printfulSides.map((side) =>
    side === "front"
      ? template.printfulFrontFileType || "front"
      : side
  );

  const variants = syncVariants.map((variant) => ({
    id: String(variant?.id || ""),
    externalId: String(
      variant?.external_id ||
      variant?.external_variant_id ||
      ""
    ),
    name:
      variant?.name ||
      variant?.variant?.name ||
      variant?.external_id ||
      "Variant",
    catalogVariantId:
      Number(variant?.variant_id || 0) || null,
    synced: variantIsSynced(variant),
    artworkReady: artworkIsReady(variant, requiredFileTypes),
    retailPrice:
      Number(variant?.retail_price || 0) || null,
    raw: variant
  }));

  const totalVariants = variants.length;
  const syncedVariants = variants.filter(
    (variant) => variant.synced
  ).length;
  const artworkReadyVariants = variants.filter(
    (variant) => variant.artworkReady
  ).length;
  const requestedSizes = new Set(
    variants
      .map((variant) => normalizedSize(variant.name))
      .filter(Boolean)
  );
  const mappedCatalogVariants = new Set(
    variants
      .map((variant) => Number(variant.catalogVariantId || 0))
      .filter(Boolean)
  );
  const variantMappingReady =
    requestedSizes.size <= 1 ||
    mappedCatalogVariants.size >= requestedSizes.size;

  return {
    found: true,
    ready:
      totalVariants > 0 &&
      syncedVariants === totalVariants &&
      artworkReadyVariants === totalVariants &&
      variantMappingReady,
    syncProduct,
    variants,
    totalVariants,
    syncedVariants,
    artworkReadyVariants,
    variantMappingReady,
    payload
  };
}

export async function autoConfigurePrintful({
  shopifyProductId,
  productType,
  frontArtworkUrl,
  backArtworkUrl,
  retailPrice,
  blankName,
  defaultColor = "Black",
  defaultSize = "M",
  force = false
}) {
  if (!frontArtworkUrl && !backArtworkUrl) {
    throw new Error(
      "At least one public front or back artwork URL is required before Printful can be configured."
    );
  }

  const discovered =
    await discoverImportedProduct(shopifyProductId);

  if (!discovered.found) {
    throw new Error(discovered.error);
  }

  const resolvedBlankName =
    resolveBlankNameForProductType(
      productType,
      blankName
    );

  const catalog =
    await resolveDefaultCatalogProduct(
      resolvedBlankName
    );

  const results = [];

  for (const syncVariant of discovered.syncVariants) {
    if (!syncVariant?.id) {
      results.push({
        ok: false,
        name: syncVariant?.name || "Unknown variant",
        error:
          "Printful did not return a sync variant ID."
      });
      continue;
    }

    const match = chooseCatalogVariant(
      syncVariant,
      catalog.variants,
      { defaultColor, defaultSize }
    );

    if (!match.variant?.id) {
      results.push({
        ok: false,
        syncVariantId: String(syncVariant.id),
        name:
          syncVariant?.name ||
          syncVariant?.external_id ||
          "Variant",
        error:
          `No compatible ${resolvedBlankName} catalog variant was found.`
      });
      continue;
    }

    if (
      !force &&
      variantIsSynced(syncVariant) &&
      artworkIsReady(
        syncVariant,
        getProductTypeTemplate(productType).printfulSides.map((side) =>
          side === "front"
            ? getProductTypeTemplate(productType).printfulFrontFileType || "front"
            : side
        )
      ) &&
      Number(syncVariant?.variant_id || 0) ===
        Number(match.variant.id)
    ) {
      results.push({
        ok: true,
        skipped: true,
        syncVariantId: String(syncVariant.id),
        catalogVariantId: Number(match.variant.id),
        name:
          syncVariant?.name ||
          syncVariant?.external_id ||
          "Variant",
        response: syncVariant
      });
      continue;
    }

    const files = buildSyncFiles({
      productType,
      frontArtworkUrl,
      backArtworkUrl
    });

    const payload = {
      variant_id: Number(match.variant.id),
      retail_price: Number(retailPrice || 39.99).toFixed(2),
      is_ignored: false,
      files
    };

    try {
      const response = await configureSyncVariant(
        syncVariant.id,
        payload
      );

      results.push({
        ok: true,
        syncVariantId: String(syncVariant.id),
        externalVariantId: String(
          syncVariant?.external_id ||
          syncVariant?.external_variant_id ||
          ""
        ),
        name:
          syncVariant?.name ||
          syncVariant?.external_id ||
          "Variant",
        catalogVariantId: Number(match.variant.id),
        catalogProductId: Number(
          catalog.product?.id ||
          catalog.listMatch?.id
        ),
        catalogVariantName:
          match.variant?.name ||
          `${match.variant?.color || ""} ${
            match.variant?.size || ""
          }`.trim(),
        color: match.variant?.color || match.requestedColor,
        size:
          match.variant?.size || match.requestedSize,
        confidence: match.confidence,
        payload,
        response
      });
    } catch (error) {
      results.push({
        ok: false,
        syncVariantId: String(syncVariant.id),
        name:
          syncVariant?.name ||
          syncVariant?.external_id ||
          "Variant",
        catalogVariantId: Number(match.variant.id),
        color: match.variant?.color || match.requestedColor,
        size:
          match.variant?.size || match.requestedSize,
        confidence: match.confidence,
        payload,
      error: error.message,
      details: error.payload || null
    });
  }
  }

  const verification = await inspectPrintfulProduct({
    shopifyProductId,
    syncProductId:
      discovered.syncProduct?.id || null,
    productType
  });

  return {
    blank: {
      id: Number(
        catalog.product?.id ||
        catalog.listMatch?.id
      ),
      name:
        catalog.product?.title ||
        catalog.product?.name ||
        catalog.listMatch?.title ||
        catalog.listMatch?.name ||
        resolvedBlankName
    },
    syncProduct: discovered.syncProduct,
    results,
    verification
  };
}

export function printfulDashboardUrl() {
  return printfulProductDashboardUrl(
    process.env.PRINTFUL_STORE_ID
  );
}
