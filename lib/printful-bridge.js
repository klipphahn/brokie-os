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
  printfulProductDashboardUrl,
  variantIsSynced
} from "@/lib/printful";

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

export async function inspectPrintfulProduct({
  shopifyProductId,
  syncProductId
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
    artworkReady: artworkIsReady(variant),
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

  return {
    found: true,
    ready:
      totalVariants > 0 &&
      syncedVariants === totalVariants &&
      artworkReadyVariants === totalVariants,
    syncProduct,
    variants,
    totalVariants,
    syncedVariants,
    artworkReadyVariants,
    payload
  };
}

export async function autoConfigurePrintful({
  shopifyProductId,
  frontArtworkUrl,
  backArtworkUrl,
  retailPrice,
  blankName = "Comfort Colors 1717",
  defaultColor = "Black",
  defaultSize = "M"
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

  const catalog =
    await resolveDefaultCatalogProduct(blankName);

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

    if (
      variantIsSynced(syncVariant) &&
      artworkIsReady(syncVariant)
    ) {
      results.push({
        ok: true,
        skipped: true,
        syncVariantId: String(syncVariant.id),
        catalogVariantId:
          Number(syncVariant?.variant_id || 0) || null,
        name:
          syncVariant?.name ||
          syncVariant?.external_id ||
          "Variant",
        response: syncVariant
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
          "No compatible Comfort Colors 1717 catalog variant was found."
      });
      continue;
    }

    const files = [];
    if (frontArtworkUrl) {
      // Apparel products expose the explicit `front` placement. Printful's
      // generic `default` alias is not accepted for every catalog product
      // when it is combined with a back print (including CC 1717).
      files.push({ type: "front", url: frontArtworkUrl });
    }
    if (backArtworkUrl) {
      files.push({ type: "back", url: backArtworkUrl });
    }

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
      discovered.syncProduct?.id || null
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
        blankName
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
