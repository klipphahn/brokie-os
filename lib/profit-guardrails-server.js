import {
  extractCatalogResult,
  extractSyncResult,
  getCatalogProduct,
  getCatalogVariantPrices,
  getSyncProduct
} from "@/lib/printful";
import {
  getProductTypeTemplate,
  productTypeFamily
} from "@/lib/product-types";
import {
  calculateProfitability,
  normalizeProfitPolicy,
  roundMoney
} from "@/lib/profit-guardrails";

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function priceOf(value) {
  return numberValue(value?.discounted_price ?? value?.price, 0);
}

function chooseTechnique(productType, techniques = []) {
  const family = productTypeFamily(productType);
  const priorities =
    family === "headwear"
      ? ["embroidery"]
      : family === "sticker"
        ? ["digital", "kiss_cut", "cut", "dtfilm", "dtg"]
        : ["dtg", "dtfilm", "digital", "embroidery"];

  for (const key of priorities) {
    const match = techniques.find(
      (technique) => technique?.technique_key === key
    );
    if (match) return match;
  }

  return techniques[0] || null;
}

function placementCostForSide(
  placements,
  side,
  techniqueKey
) {
  const sameTechnique = placements.filter(
    (placement) =>
      !techniqueKey || placement?.technique_key === techniqueKey
  );
  const normalizedSide = String(side || "").toLowerCase();
  const exact = sameTechnique.find(
    (placement) =>
      String(placement?.id || "").toLowerCase() === normalizedSide
  );

  if (exact) return priceOf(exact);

  const partial = sameTechnique.find((placement) => {
    const id = String(placement?.id || "").toLowerCase();
    const title = String(placement?.title || "").toLowerCase();
    return id.includes(normalizedSide) || title.includes(normalizedSide);
  });

  if (partial) return priceOf(partial);

  return sameTechnique.reduce(
    (highest, placement) => Math.max(highest, priceOf(placement)),
    0
  );
}

export async function getProfitPolicy(supabase) {
  const { data, error } = await supabase
    .from("profit_guardrail_settings")
    .select("*")
    .eq("id", "primary")
    .maybeSingle();

  if (error) throw error;
  return normalizeProfitPolicy(data || {});
}

export async function estimatePrintfulProductionCost(
  supabase,
  product
) {
  const { data: links, error: linksError } = await supabase
    .from("printful_variant_links")
    .select(
      "catalog_variant_id,catalog_product_id,synced,artwork_ready"
    )
    .eq("product_id", product.id)
    .eq("synced", true)
    .eq("artwork_ready", true);

  if (linksError) throw linksError;

  let selectedVariantIds = [
    ...new Set(
      (links || [])
        .map((link) => Number(link.catalog_variant_id || 0))
        .filter(Boolean)
    )
  ];
  let catalogProductId = Number(
    product.printful_catalog_product_id ||
      links?.find((link) => link.catalog_product_id)?.catalog_product_id ||
      0
  );
  let costDiscoverySource = "stored_variant_links";
  let syncLookupError = null;

  if (
    !selectedVariantIds.length &&
    product.printful_sync_product_id
  ) {
    try {
      const syncPayload = await getSyncProduct(
        product.printful_sync_product_id
      );
      const { syncVariants } = extractSyncResult(syncPayload);
      selectedVariantIds = [
        ...new Set(
          (syncVariants || [])
            .map((variant) => Number(variant?.variant_id || 0))
            .filter(Boolean)
        )
      ];
      catalogProductId = Number(
        catalogProductId ||
          syncVariants?.find(
            (variant) => variant?.product?.id
          )?.product?.id ||
          0
      );
      costDiscoverySource = "printful_sync_api";
    } catch (error) {
      syncLookupError = error.message;
    }
  }

  if (!catalogProductId || !selectedVariantIds.length) {
    return {
      baseProductionCost: null,
      extraPlacementCost: 0,
      costSource: "missing_printful_catalog_cost",
      details: {
        catalogProductId: catalogProductId || null,
        selectedVariantCount: selectedVariantIds.length,
        syncLookupError
      }
    };
  }

  const catalogPayload = await getCatalogProduct(catalogProductId);
  const { variants } = extractCatalogResult(catalogPayload);
  const selectedVariants = (variants || []).filter((variant) =>
    selectedVariantIds.includes(Number(variant?.id || 0))
  );

  if (!selectedVariants.length) {
    return {
      baseProductionCost: null,
      extraPlacementCost: 0,
      costSource: "missing_selected_variant_cost",
      details: {
        catalogProductId,
        selectedVariantIds,
        costDiscoverySource
      }
    };
  }

  const highestVariant = selectedVariants.reduce((highest, variant) =>
    priceOf(variant) > priceOf(highest) ? variant : highest
  );
  const pricingPayload = await getCatalogVariantPrices(highestVariant.id);
  const pricing = pricingPayload?.data || {};
  const technique = chooseTechnique(
    product.product_type,
    pricing?.variant?.techniques || []
  );
  const baseProductionCost = Math.max(
    priceOf(highestVariant),
    priceOf(technique)
  );
  const template = getProductTypeTemplate(product.product_type);
  const requiredSides = template.printfulSides || ["front"];
  const placements = pricing?.product?.placements || [];
  const extraPlacementCost = requiredSides
    .slice(1)
    .reduce(
      (total, side) =>
        total +
        placementCostForSide(
          placements,
          side,
          technique?.technique_key
        ),
      0
    );

  return {
    baseProductionCost: roundMoney(baseProductionCost),
    extraPlacementCost: roundMoney(extraPlacementCost),
    costSource: "printful_catalog_v2",
    details: {
      catalogProductId,
      catalogVariantId: Number(highestVariant.id),
      selectedVariantCount: selectedVariantIds.length,
      techniqueKey: technique?.technique_key || null,
      requiredPlacements: requiredSides,
      costDiscoverySource,
      baseVariantPrice: roundMoney(priceOf(highestVariant)),
      techniquePrice: roundMoney(priceOf(technique))
    }
  };
}

async function ensurePriceApproval(
  supabase,
  product,
  profitability
) {
  const shouldRequest =
    ["blocked", "warning"].includes(profitability.status) &&
    profitability.recommendedRetailPrice > profitability.retailPrice;
  const [pendingResult, rejectedResult] = await Promise.all([
    supabase
      .from("approval_requests")
      .select("*")
      .eq("product_id", product.id)
      .eq("request_type", "price_change")
      .eq("status", "pending")
      .maybeSingle(),
    supabase
      .from("approval_requests")
      .select("*")
      .eq("product_id", product.id)
      .eq("request_type", "price_change")
      .eq("status", "rejected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (pendingResult.error) throw pendingResult.error;
  if (rejectedResult.error) throw rejectedResult.error;
  const existing = pendingResult.data;
  const rejected = rejectedResult.data;

  if (!shouldRequest) {
    if (existing) {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "superseded",
          summary: "The product now meets the target margin.",
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);
      if (error) throw error;
    }
    return null;
  }

  const sameRejectedRecommendation =
    !existing &&
    rejected &&
    Math.abs(
      Number(rejected.current_price || 0) -
        profitability.retailPrice
    ) < 0.001 &&
    Math.abs(
      Number(rejected.proposed_price || 0) -
        profitability.recommendedRetailPrice
    ) < 0.001 &&
    Math.abs(
      Number(rejected.details?.estimatedTotalCost || 0) -
        profitability.estimatedTotalCost
    ) < 0.001;

  if (sameRejectedRecommendation) return null;

  const values = {
    request_type: "price_change",
    status: "pending",
    product_id: product.id,
    title: `Approve price for ${product.title}`,
    summary:
      profitability.status === "blocked"
        ? `Current margin is ${profitability.marginPercent.toFixed(1)}%, below the hard floor.`
        : `Current margin is ${profitability.marginPercent.toFixed(1)}%, below the target.`,
    current_price: profitability.retailPrice,
    proposed_price: profitability.recommendedRetailPrice,
    current_margin_percent: profitability.marginPercent,
    target_margin_percent:
      profitability.policy.targetMarginPercent,
    details: {
      minimumRetailPrice: profitability.minimumRetailPrice,
      estimatedProductionCost: profitability.estimatedProductionCost,
      estimatedTotalCost: profitability.estimatedTotalCost,
      estimatedProfit: profitability.estimatedProfit
    },
    updated_at: new Date().toISOString()
  };

  if (existing) {
    const { data, error } = await supabase
      .from("approval_requests")
      .update(values)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("approval_requests")
    .insert(values)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function refreshProductProfitability(
  supabase,
  productId
) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (productError) throw productError;

  const policy = await getProfitPolicy(supabase);
  const estimate = await estimatePrintfulProductionCost(
    supabase,
    product
  );
  const profitability = calculateProfitability({
    retailPrice: product.retail_price,
    baseProductionCost: estimate.baseProductionCost,
    extraPlacementCost: estimate.extraPlacementCost,
    policy
  });
  const now = new Date().toISOString();
  const values = {
    product_id: product.id,
    retail_price: profitability.retailPrice,
    customer_shipping_charge:
      profitability.customerShippingCharge,
    base_production_cost: profitability.baseProductionCost,
    extra_placement_cost: profitability.extraPlacementCost,
    estimated_production_cost:
      profitability.estimatedProductionCost,
    estimated_shipping_cost: profitability.estimatedShippingCost,
    estimated_tax: profitability.estimatedTax,
    estimated_payment_fee: profitability.estimatedPaymentFee,
    estimated_total_cost: profitability.estimatedTotalCost,
    estimated_revenue: profitability.estimatedRevenue,
    estimated_profit: profitability.estimatedProfit,
    margin_percent: profitability.marginPercent,
    minimum_retail_price: profitability.minimumRetailPrice,
    recommended_retail_price:
      profitability.recommendedRetailPrice,
    status: profitability.status,
    cost_source: estimate.costSource,
    details: {
      ...estimate.details,
      minimumMarginPercent:
        profitability.policy.minimumMarginPercent,
      targetMarginPercent:
        profitability.policy.targetMarginPercent
    },
    checked_at: now,
    updated_at: now
  };
  const { data: saved, error: saveError } = await supabase
    .from("product_profitability")
    .upsert(values, { onConflict: "product_id" })
    .select()
    .single();

  if (saveError) throw saveError;
  const approval = await ensurePriceApproval(
    supabase,
    product,
    profitability
  );

  return {
    policy,
    profitability: saved,
    approval,
    readyToLaunch: ["ready", "warning"].includes(saved.status),
    hardBlocked: ["blocked", "needs_cost"].includes(saved.status)
  };
}

export async function loadProductGuardrail(supabase, productId) {
  const [policy, profitabilityResult, approvalResult] =
    await Promise.all([
      getProfitPolicy(supabase),
      supabase
        .from("product_profitability")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle(),
      supabase
        .from("approval_requests")
        .select("*")
        .eq("product_id", productId)
        .eq("request_type", "price_change")
        .eq("status", "pending")
        .maybeSingle()
    ]);

  if (profitabilityResult.error) throw profitabilityResult.error;
  if (approvalResult.error) throw approvalResult.error;

  const profitability = profitabilityResult.data || null;
  return {
    policy,
    profitability,
    approval: approvalResult.data || null,
    readyToLaunch: ["ready", "warning"].includes(
      profitability?.status
    ),
    hardBlocked:
      !profitability ||
      ["blocked", "needs_cost"].includes(profitability.status)
  };
}

export async function loadGuardrailOverview(supabase) {
  const [policy, profitabilityResult, approvalsResult, productsResult] =
    await Promise.all([
      getProfitPolicy(supabase),
      supabase
        .from("product_profitability")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("approval_requests")
        .select("*")
        .eq("request_type", "price_change")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("products")
        .select(
          "id,title,status,retail_price,shopify_product_id,online_store_url,printful_status"
        )
    ]);

  if (profitabilityResult.error) throw profitabilityResult.error;
  if (approvalsResult.error) throw approvalsResult.error;
  if (productsResult.error) throw productsResult.error;

  const productsById = Object.fromEntries(
    (productsResult.data || []).map((product) => [product.id, product])
  );
  const items = (profitabilityResult.data || []).map((row) => ({
    ...row,
    product: productsById[row.product_id] || null
  }));
  const configuredCount = (productsResult.data || []).filter(
    (product) => product.printful_status === "configured"
  ).length;
  const checkedIds = new Set(items.map((item) => item.product_id));

  return {
    policy,
    items,
    approvals: approvalsResult.data || [],
    readyCount: items.filter((item) => item.status === "ready").length,
    warningCount: items.filter((item) => item.status === "warning").length,
    blockedCount: items.filter((item) =>
      ["blocked", "needs_cost"].includes(item.status)
    ).length,
    pendingApprovalCount: (approvalsResult.data || []).length,
    uncheckedCount: (productsResult.data || []).filter(
      (product) =>
        product.printful_status === "configured" &&
        !checkedIds.has(product.id)
    ).length,
    configuredCount
  };
}

export async function refreshConfiguredProfitability(supabase) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,title")
    .eq("printful_status", "configured")
    .limit(100);

  if (error) throw error;

  const results = [];
  for (const product of products || []) {
    try {
      const result = await refreshProductProfitability(
        supabase,
        product.id
      );
      results.push({
        ok: true,
        productId: product.id,
        title: product.title,
        status: result.profitability.status,
        marginPercent: result.profitability.margin_percent
      });
    } catch (refreshError) {
      results.push({
        ok: false,
        productId: product.id,
        title: product.title,
        error: refreshError.message
      });
    }
  }

  return results;
}
