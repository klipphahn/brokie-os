import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin-api-auth";
import {
  loadGuardrailOverview,
  loadProductGuardrail,
  refreshConfiguredProfitability,
  refreshProductProfitability
} from "@/lib/profit-guardrails-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  configureSyncVariant,
  extractSyncResult,
  getSyncProduct
} from "@/lib/printful";
import { shopifyGraphQL } from "@/lib/shopify";

const READ_VARIANT_IDS = `
query ReadGuardrailVariantIds($id: ID!) {
  product(id: $id) {
    id
    variants(first: 100) {
      nodes { id }
    }
  }
}`;

const UPDATE_VARIANT_PRICES = `
mutation UpdateGuardrailVariantPrices(
  $productId: ID!,
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId,
    variants: $variants
  ) {
    productVariants { id price }
    userErrors { field message }
  }
}`;

function apiError(error) {
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    },
    { status: error?.status || 400 }
  );
}

function ensureNoShopifyErrors(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((item) => item.message).join("; "));
  }
}

async function updateShopifyPrice(product, price) {
  if (!product.shopify_product_id) return [];

  const readData = await shopifyGraphQL(READ_VARIANT_IDS, {
    id: product.shopify_product_id
  });
  const variants = readData.product?.variants?.nodes || [];
  if (!variants.length) {
    throw new Error("Shopify returned no product variants to update.");
  }

  const updateData = await shopifyGraphQL(UPDATE_VARIANT_PRICES, {
    productId: product.shopify_product_id,
    variants: variants.map((variant) => ({
      id: variant.id,
      price: Number(price).toFixed(2)
    }))
  });
  ensureNoShopifyErrors(updateData, "productVariantsBulkUpdate");
  return updateData.productVariantsBulkUpdate?.productVariants || [];
}

async function updatePrintfulRetailPrices(supabase, product, price) {
  const { data: links, error } = await supabase
    .from("printful_variant_links")
    .select("id,printful_sync_variant_id")
    .eq("product_id", product.id)
    .eq("synced", true);

  if (error) throw error;

  let candidates = (links || []).map((link) => ({
    id: link.id,
    syncVariantId: link.printful_sync_variant_id
  }));

  if (!candidates.length && product.printful_sync_product_id) {
    const payload = await getSyncProduct(
      product.printful_sync_product_id
    );
    const { syncVariants } = extractSyncResult(payload);
    candidates = (syncVariants || [])
      .filter((variant) => variant?.id)
      .map((variant) => ({
        id: null,
        syncVariantId: String(variant.id)
      }));
  }

  if (!candidates.length) {
    throw new Error(
      "Printful returned no synced variants to update. Verify fulfillment before approving a price."
    );
  }

  const results = [];
  for (const candidate of candidates) {
    try {
      await configureSyncVariant(candidate.syncVariantId, {
        retail_price: Number(price).toFixed(2)
      });
      results.push({
        id: candidate.id,
        syncVariantId: candidate.syncVariantId,
        ok: true
      });
    } catch (printfulError) {
      results.push({
        id: candidate.id,
        syncVariantId: candidate.syncVariantId,
        ok: false,
        error: printfulError.message
      });
    }
  }

  const failures = results.filter((item) => !item.ok);
  if (failures.length) {
    const failure = new Error(
      `Printful updated ${results.length - failures.length}/${results.length} variants. The Shopify price was not changed; retry the approval to finish safely.`
    );
    failure.status = 502;
    failure.results = results;
    throw failure;
  }

  if ((links || []).length) {
    const { error: linkUpdateError } = await supabase
      .from("printful_variant_links")
      .update({
        retail_price: Number(price),
        updated_at: new Date().toISOString()
      })
      .eq("product_id", product.id);
    if (linkUpdateError) throw linkUpdateError;
  }

  return results;
}

export async function GET(request) {
  try {
    await requireAdminApiUser(request);
    const supabase = createSupabaseAdminClient();
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (productId) {
      const guardrail = await loadProductGuardrail(
        supabase,
        productId
      );
      return NextResponse.json({ ok: true, ...guardrail });
    }

    const overview = await loadGuardrailOverview(supabase);
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request) {
  try {
    const user = await requireAdminApiUser(request);
    const supabase = createSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "refresh_product") {
      const productId = String(body.productId || "");
      if (!productId) throw new Error("Product id is required.");
      const guardrail = await refreshProductProfitability(
        supabase,
        productId
      );
      return NextResponse.json({
        ok: true,
        message: "Profit guardrail refreshed from Printful pricing.",
        ...guardrail
      });
    }

    if (action === "refresh_all") {
      const results = await refreshConfiguredProfitability(supabase);
      return NextResponse.json({
        ok: results.some((item) => item.ok),
        message: `Checked ${results.length} configured product${results.length === 1 ? "" : "s"}.`,
        results
      });
    }

    if (action === "approve_price") {
      const approvalId = String(body.approvalId || "");
      if (!approvalId) throw new Error("Approval id is required.");

      const { data: approval, error: approvalError } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("id", approvalId)
        .eq("request_type", "price_change")
        .eq("status", "pending")
        .single();
      if (approvalError) throw approvalError;

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", approval.product_id)
        .single();
      if (productError) throw productError;

      const proposedPrice = Number(approval.proposed_price || 0);
      if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
        throw new Error("The approved price is invalid.");
      }

      const refreshed = await refreshProductProfitability(
        supabase,
        product.id
      );
      const currentApproval = refreshed.approval;
      const approvalIsCurrent =
        currentApproval?.id === approval.id &&
        Math.abs(
          Number(currentApproval.current_price || 0) -
            Number(approval.current_price || 0)
        ) < 0.001 &&
        Math.abs(
          Number(currentApproval.proposed_price || 0) -
            proposedPrice
        ) < 0.001;

      if (!approvalIsCurrent) {
        const staleError = new Error(
          "Costs or pricing changed after this approval was created. Brokie OS refreshed the recommendation; review the updated approval before applying it."
        );
        staleError.status = 409;
        throw staleError;
      }

      const printfulResults = await updatePrintfulRetailPrices(
        supabase,
        product,
        proposedPrice
      );
      const shopifyVariants = await updateShopifyPrice(
        product,
        proposedPrice
      );
      const now = new Date().toISOString();
      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          retail_price: proposedPrice,
          publish_error: null,
          updated_at: now
        })
        .eq("id", product.id);
      if (productUpdateError) throw productUpdateError;

      await supabase
        .from("product_variants")
        .update({ retail_price: proposedPrice })
        .eq("product_id", product.id);

      const { error: approvalUpdateError } = await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          decided_at: now,
          decided_by: user.email,
          updated_at: now,
          details: {
            ...(approval.details || {}),
            appliedPrice: proposedPrice,
            shopifyVariantCount: shopifyVariants.length,
            printfulVariantCount: printfulResults.length,
            printfulUpdateFailures: printfulResults.filter(
              (item) => !item.ok
            ).length
          }
        })
        .eq("id", approval.id);
      if (approvalUpdateError) throw approvalUpdateError;

      await supabase.from("activity_logs").insert({
        action: "price_approval",
        title: `Approved price: ${product.title}`,
        detail: `Retail price changed from $${Number(
          approval.current_price
        ).toFixed(2)} to $${proposedPrice.toFixed(2)}.`,
        status: "success",
        metadata: {
          productId: product.id,
          approvalId: approval.id,
          previousPrice: Number(approval.current_price),
          approvedPrice: proposedPrice
        }
      });

      const guardrail = await refreshProductProfitability(
        supabase,
        product.id
      );
      return NextResponse.json({
        ok: true,
        message: `Approved and applied $${proposedPrice.toFixed(2)} across Shopify and Printful.`,
        ...guardrail
      });
    }

    if (action === "reject_price") {
      const approvalId = String(body.approvalId || "");
      if (!approvalId) throw new Error("Approval id is required.");
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("approval_requests")
        .update({
          status: "rejected",
          decided_at: now,
          decided_by: user.email,
          updated_at: now
        })
        .eq("id", approvalId)
        .eq("status", "pending")
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        message: "Price change rejected. The current product remains blocked if it is below the margin floor.",
        approval: data
      });
    }

    if (action === "update_policy") {
      const minimum = Number(body.minimumMarginPercent);
      const target = Number(body.targetMarginPercent);
      if (
        !Number.isFinite(minimum) ||
        !Number.isFinite(target) ||
        minimum < 0 ||
        target < minimum ||
        target >= 90
      ) {
        throw new Error("Use a valid target margin at or above the minimum.");
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("profit_guardrail_settings")
        .update({
          minimum_margin_percent: minimum,
          target_margin_percent: target,
          updated_at: now
        })
        .eq("id", "primary")
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        message: "Profit policy updated.",
        policy: data
      });
    }

    throw new Error("Unknown guardrail action.");
  } catch (error) {
    return apiError(error);
  }
}
