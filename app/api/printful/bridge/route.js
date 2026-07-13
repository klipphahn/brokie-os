import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  autoConfigurePrintful,
  diagnosePrintful,
  discoverImportedProduct,
  inspectPrintfulProduct,
  printfulDashboardUrl
} from "@/lib/printful-bridge";
import { numericShopifyId } from "@/lib/printful";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server credentials are missing."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

async function loadProduct(supabase, productId) {
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, designs(id,name,front_artwork_url,back_artwork_url,thumbnail_url)"
    )
    .eq("id", productId)
    .single();

  if (error) throw error;
  return data;
}

async function recordRun(
  supabase,
  productId,
  step,
  status,
  response = null,
  errorMessage = null
) {
  await supabase.from("publish_runs").insert({
    product_id: productId,
    provider: "printful",
    step,
    status,
    response,
    error_message: errorMessage,
    updated_at: new Date().toISOString()
  });
}

async function saveInspection(
  supabase,
  product,
  inspection,
  extra = {}
) {
  const now = new Date().toISOString();
  const syncProductId = String(
    inspection?.syncProduct?.id || ""
  ) || null;

  const values = {
    printful_sync_product_id: syncProductId,
    printful_external_product_id:
      numericShopifyId(product.shopify_product_id),
    printful_store_id:
      process.env.PRINTFUL_STORE_ID || null,
    printful_product_url: printfulDashboardUrl(),
    printful_variant_count:
      inspection.totalVariants || 0,
    printful_synced_variant_count:
      inspection.syncedVariants || 0,
    printful_last_verified_at: now,
    printful_status: inspection.ready
      ? "configured"
      : inspection.found
        ? "imported"
        : "not_imported",
    printful_confirmed_at: inspection.ready
      ? now
      : null,
    printful_error: inspection.ready
      ? null
      : extra.error || null,
    printful_details: {
      ...(product.printful_details || {}),
      inspection,
      ...extra
    },
    ...extra.productValues,
    updated_at: now
  };

  const { data, error } = await supabase
    .from("products")
    .update(values)
    .eq("id", product.id)
    .select()
    .single();

  if (error) throw error;

  const clearedLinks = await supabase
    .from("printful_variant_links")
    .delete()
    .eq("product_id", product.id);
  if (clearedLinks.error) throw clearedLinks.error;

  if (inspection.variants?.length) {
    const rows = inspection.variants
      .filter((variant) => variant.id)
      .map((variant) => ({
        product_id: product.id,
        printful_sync_variant_id: variant.id,
        external_variant_id:
          variant.externalId || null,
        catalog_variant_id:
          variant.catalogVariantId || null,
        variant_name: variant.name,
        synced: variant.synced,
        artwork_ready: variant.artworkReady,
        retail_price: variant.retailPrice,
        details: variant.raw || {},
        verified_at: now,
        updated_at: now
      }));

    if (rows.length) {
      const { error: variantError } = await supabase
        .from("printful_variant_links")
        .upsert(rows, {
          onConflict:
            "product_id,printful_sync_variant_id"
        });

      if (variantError) throw variantError;
    }
  }

  return data;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const productId =
      url.searchParams.get("productId");

    const diagnostics = await diagnosePrintful();

    if (!productId) {
      return NextResponse.json({
        ok: true,
        diagnostics,
        dashboardUrl: printfulDashboardUrl()
      });
    }

    const supabase = db();
    const product = await loadProduct(
      supabase,
      productId
    );

    if (!product.shopify_product_id) {
      return NextResponse.json({
        ok: true,
        diagnostics,
        product,
        inspection: {
          found: false,
          ready: false,
          variants: [],
          totalVariants: 0,
          syncedVariants: 0,
          artworkReadyVariants: 0,
          message:
            "Create the Shopify product before connecting Printful."
        },
        dashboardUrl: printfulDashboardUrl()
      });
    }

    const inspection = await inspectPrintfulProduct({
      shopifyProductId:
        product.shopify_product_id
    });

    const saved = await saveInspection(
      supabase,
      product,
      inspection
    );

    return NextResponse.json({
      ok: true,
      diagnostics,
      product: saved,
      inspection,
      dashboardUrl: printfulDashboardUrl()
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        details: error?.payload || null
      },
      { status: error?.status || 400 }
    );
  }
}

export async function POST(request) {
  const supabase = db();
  let product = null;

  try {
    const body = await request.json();
    const action = String(body.action || "");
    const productId = String(body.productId || "");

    if (!productId) {
      throw new Error("Product id is required.");
    }

    product = await loadProduct(
      supabase,
      productId
    );

    if (!product.shopify_product_id) {
      throw new Error(
        "Create the Shopify product before connecting Printful."
      );
    }

    if (action === "detect") {
      const discovered =
        await discoverImportedProduct(
          product.shopify_product_id
        );

      if (!discovered.found) {
        const inspection = {
          found: false,
          ready: false,
          syncProduct: null,
          variants: [],
          totalVariants: 0,
          syncedVariants: 0,
          artworkReadyVariants: 0
        };

        const saved = await saveInspection(
          supabase,
          product,
          inspection,
          { error: discovered.error }
        );

        return NextResponse.json({
          ok: true,
          found: false,
          message: discovered.error,
          product: saved,
          inspection,
          dashboardUrl: printfulDashboardUrl()
        });
      }

      const inspection =
        await inspectPrintfulProduct({
          shopifyProductId:
            product.shopify_product_id,
          syncProductId:
            discovered.syncProduct?.id
        });

      const saved = await saveInspection(
        supabase,
        product,
        inspection
      );

      await recordRun(
        supabase,
        product.id,
        "detect_imported_product",
        "success",
        inspection
      );

      return NextResponse.json({
        ok: true,
        found: true,
        message: inspection.ready
          ? "Printful is already fully configured."
          : `Imported product detected with ${inspection.totalVariants} variant(s).`,
        product: saved,
        inspection,
        dashboardUrl: printfulDashboardUrl()
      });
    }

    if (action === "configure") {
      const frontArtworkUrl =
        body.artworkUrl ||
        product.designs?.front_artwork_url ||
        product.designs?.thumbnail_url;
      const backArtworkUrl =
        body.backArtworkUrl ||
        product.designs?.back_artwork_url ||
        null;

      const configured =
        await autoConfigurePrintful({
          shopifyProductId:
            product.shopify_product_id,
          frontArtworkUrl,
          backArtworkUrl,
          retailPrice:
            product.retail_price || body.retailPrice,
          blankName:
            body.blankName ||
            process.env.PRINTFUL_DEFAULT_BLANK ||
            "Comfort Colors 1717",
          defaultColor:
            body.defaultColor ||
            process.env.PRINTFUL_DEFAULT_COLOR ||
            "Black",
          defaultSize:
            body.defaultSize ||
            process.env.PRINTFUL_DEFAULT_SIZE ||
            "M"
        });

      const failures = configured.results.filter(
        (result) => !result.ok
      );

      const productValues = {
        printful_catalog_product_id:
          configured.blank.id,
        printful_catalog_product_name:
          configured.blank.name
      };

      const saved = await saveInspection(
        supabase,
        product,
        configured.verification,
        {
          productValues,
          autoConfiguration: {
            blank: configured.blank,
            results: configured.results
          },
          error: failures.length
            ? `${failures.length} variant(s) could not be configured.`
            : null
        }
      );

      const now = new Date().toISOString();
      const linkRows = configured.results
        .filter(
          (result) =>
            result.syncVariantId
        )
        .map((result) => ({
          product_id: product.id,
          printful_sync_variant_id:
            result.syncVariantId,
          external_variant_id:
            result.externalVariantId || null,
          catalog_variant_id:
            result.catalogVariantId || null,
          catalog_product_id:
            configured.blank.id,
          variant_name:
            result.name || null,
          color: result.color || null,
          size: result.size || null,
          synced: Boolean(result.ok),
          artwork_ready: Boolean(result.ok),
          retail_price:
            Number(product.retail_price || 0) ||
            null,
          details: result,
          verified_at: now,
          updated_at: now
        }));

      if (linkRows.length) {
        const { error: linkError } =
          await supabase
            .from("printful_variant_links")
            .upsert(linkRows, {
              onConflict:
                "product_id,printful_sync_variant_id"
            });

        if (linkError) throw linkError;
      }

      await recordRun(
        supabase,
        product.id,
        "auto_configure_variants",
        failures.length ? "partial" : "success",
        configured,
        failures.length
          ? `${failures.length} variant(s) failed.`
          : null
      );

      await supabase.from("activity_logs").insert({
        action: "printful_sync",
        title: `Printful configured: ${product.title}`,
        detail: configured.verification.ready
          ? "All imported variants are connected to Comfort Colors 1717 and have artwork."
          : `${configured.verification.syncedVariants}/${configured.verification.totalVariants} variants are ready.`,
        status:
          configured.verification.ready
            ? "success"
            : "warning",
        metadata: {
          productId: product.id,
          printfulSyncProductId:
            configured.syncProduct?.id,
          blank: configured.blank,
          results: configured.results
        }
      });

      return NextResponse.json({
        ok: configured.verification.ready,
        message: configured.verification.ready
          ? "Printful fulfillment is fully configured."
          : `Printful configured ${configured.verification.syncedVariants}/${configured.verification.totalVariants} variants. ${failures[0]?.name || "A remaining variant"}: ${failures[0]?.error || "review required"}.`,
        product: saved,
        configured,
        inspection: configured.verification,
        dashboardUrl: printfulDashboardUrl()
      }, {
        status:
          configured.verification.ready
            ? 200
            : 409
      });
    }

    if (action === "verify") {
      const inspection =
        await inspectPrintfulProduct({
          shopifyProductId:
            product.shopify_product_id
        });

      const saved = await saveInspection(
        supabase,
        product,
        inspection
      );

      await recordRun(
        supabase,
        product.id,
        "verify_fulfillment",
        inspection.ready
          ? "success"
          : "incomplete",
        inspection
      );

      return NextResponse.json({
        ok: true,
        message: inspection.ready
          ? "Every Printful variant is synced and has artwork."
          : `${inspection.syncedVariants}/${inspection.totalVariants} variants are synced and ${inspection.artworkReadyVariants}/${inspection.totalVariants} have artwork.`,
        product: saved,
        inspection,
        dashboardUrl: printfulDashboardUrl()
      });
    }

    throw new Error(
      "Unknown Printful bridge action."
    );
  } catch (error) {
    if (product?.id) {
      await supabase
        .from("products")
        .update({
          printful_status: "error",
          printful_error:
            error instanceof Error
              ? error.message
              : String(error),
          updated_at: new Date().toISOString()
        })
        .eq("id", product.id);

      await recordRun(
        supabase,
        product.id,
        "bridge_error",
        "error",
        error?.payload || null,
        error instanceof Error
          ? error.message
          : String(error)
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        details: error?.payload || null,
        dashboardUrl: printfulDashboardUrl()
      },
      { status: error?.status || 400 }
    );
  }
}
