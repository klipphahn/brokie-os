import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { shopifyAdminProductUrl, shopifyGraphQL } from "@/lib/shopify";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are missing.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function conceptFromDesign(design) {
  const raw = design.concept || {};
  const concept = raw.concept || raw;
  return {
    title: concept.product_title || design.name,
    description: concept.product_description || "",
    productType: raw.productType || design.product_type || "Apparel",
    price: Number(concept.retail_price || 39.99),
    tags: Array.isArray(concept.tags) ? concept.tags : ["The Brokie"],
    seoTitle: concept.seo_title || concept.product_title || design.name,
    metaDescription: concept.meta_description || concept.product_description || "",
    collectionName: concept.collection_name || "Foundry",
    artworkUrl: design.front_artwork_url || design.thumbnail_url
  };
}

async function logActivity(supabase, action, title, detail, status, metadata={}) {
  await supabase.from("activity_logs").insert({ action, title, detail, status, metadata });
}

async function recordRun(supabase, productId, provider, step, status, response=null, errorMessage=null) {
  await supabase.from("publish_runs").insert({
    product_id: productId,
    provider,
    step,
    status,
    response,
    error_message: errorMessage,
    updated_at: new Date().toISOString()
  });
}

const CREATE_PRODUCT = `
mutation CreateBrokieProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
  productCreate(product: $product, media: $media) {
    product {
      id title handle status
      variants(first: 10) { nodes { id price } }
    }
    userErrors { field message }
  }
}`;

const UPDATE_PRODUCT = `
mutation UpdateBrokieProduct($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title handle status }
    userErrors { field message }
  }
}`;

const UPDATE_VARIANTS = `
mutation UpdateBrokieVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price }
    userErrors { field message }
  }
}`;

function ensureNoErrors(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
}

export async function GET() {
  try {
    const supabase = db();
    const { data: designs, error } = await supabase
      .from("designs")
      .select("*")
      .in("status", ["generated", "approved", "ready", "published"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const designIds = (designs || []).map((d) => d.id);
    let products = [];
    if (designIds.length) {
      const result = await supabase.from("products").select("*").in("design_id", designIds);
      if (result.error) throw result.error;
      products = result.data || [];
    }
    const productMap = Object.fromEntries(products.map((p) => [p.design_id, p]));

    return NextResponse.json({
      ok: true,
      items: (designs || []).map((design) => ({
        design,
        concept: conceptFromDesign(design),
        product: productMap[design.id] || null
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request) {
  const supabase = db();
  let productRecord = null;
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const designId = String(body.designId || "");
    if (!designId) throw new Error("Design id is required.");

    const { data: design, error: designError } = await supabase
      .from("designs").select("*").eq("id", designId).single();
    if (designError) throw designError;

    const defaults = conceptFromDesign(design);
    const review = {
      title: String(body.title || defaults.title).trim(),
      description: String(body.description ?? defaults.description),
      productType: String(body.productType || defaults.productType).trim(),
      price: Number(body.price || defaults.price),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : defaults.tags,
      seoTitle: String(body.seoTitle || defaults.seoTitle).trim(),
      metaDescription: String(body.metaDescription || defaults.metaDescription).trim(),
      artworkUrl: defaults.artworkUrl
    };
    if (!review.title) throw new Error("Product title is required.");
    if (!Number.isFinite(review.price) || review.price <= 0) throw new Error("A valid price is required.");

    const existingResult = await supabase.from("products").select("*").eq("design_id", designId).maybeSingle();
    if (existingResult.error) throw existingResult.error;
    productRecord = existingResult.data;

    const productValues = {
      design_id: designId,
      collection_id: design.collection_id || null,
      title: review.title,
      description: review.description,
      product_type: review.productType,
      retail_price: review.price,
      seo_title: review.seoTitle,
      meta_description: review.metaDescription,
      tags: review.tags,
      updated_at: new Date().toISOString()
    };

    if (!productRecord) {
      const inserted = await supabase.from("products").insert({ ...productValues, status: "review" }).select().single();
      if (inserted.error) throw inserted.error;
      productRecord = inserted.data;
    } else {
      const updated = await supabase.from("products").update(productValues).eq("id", productRecord.id).select().single();
      if (updated.error) throw updated.error;
      productRecord = updated.data;
    }

    if (action === "save_review") {
      await supabase.from("designs").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", designId);
      await logActivity(supabase, "publisher_review", `Approved ${review.title}`, "Product metadata approved for publishing.", "success", { designId, productId: productRecord.id });
      return NextResponse.json({ ok: true, message: "Review saved.", product: productRecord });
    }

    if (action === "create_shopify_draft") {
      if (productRecord.shopify_product_id) {
        const updateData = await shopifyGraphQL(UPDATE_PRODUCT, {
          product: {
            id: productRecord.shopify_product_id,
            title: review.title,
            descriptionHtml: review.description,
            productType: review.productType,
            tags: review.tags,
            status: "DRAFT",
            seo: { title: review.seoTitle, description: review.metaDescription }
          }
        });
        ensureNoErrors(updateData, "productUpdate");
        await recordRun(supabase, productRecord.id, "shopify", "update_draft", "success", updateData);
      } else {
        const media = review.artworkUrl ? [{ originalSource: review.artworkUrl, mediaContentType: "IMAGE", alt: review.title }] : [];
        const createData = await shopifyGraphQL(CREATE_PRODUCT, {
          product: {
            title: review.title,
            descriptionHtml: review.description,
            productType: review.productType,
            tags: review.tags,
            status: "DRAFT",
            seo: { title: review.seoTitle, description: review.metaDescription }
          },
          media
        });
        ensureNoErrors(createData, "productCreate");
        const shopifyProduct = createData.productCreate.product;
        const firstVariant = shopifyProduct.variants.nodes[0];
        if (firstVariant) {
          const variantData = await shopifyGraphQL(UPDATE_VARIANTS, {
            productId: shopifyProduct.id,
            variants: [{ id: firstVariant.id, price: review.price.toFixed(2) }]
          });
          ensureNoErrors(variantData, "productVariantsBulkUpdate");
        }
        const adminUrl = shopifyAdminProductUrl(shopifyProduct.id);
        const saved = await supabase.from("products").update({
          shopify_product_id: shopifyProduct.id,
          shopify_handle: shopifyProduct.handle,
          shopify_admin_url: adminUrl,
          status: "shopify_draft",
          publish_error: null,
          updated_at: new Date().toISOString()
        }).eq("id", productRecord.id).select().single();
        if (saved.error) throw saved.error;
        productRecord = saved.data;
        await recordRun(supabase, productRecord.id, "shopify", "create_draft", "success", createData);
      }

      await supabase.from("designs").update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", designId);
      await logActivity(supabase, "shopify_draft", `Created Shopify draft: ${review.title}`, "Draft created. Printful fulfillment still needs configuration.", "success", { designId, productId: productRecord.id, shopifyProductId: productRecord.shopify_product_id });
      return NextResponse.json({ ok: true, message: "Shopify draft created without duplicating the product.", product: productRecord });
    }

    if (action === "activate_shopify") {
      if (!productRecord.shopify_product_id) throw new Error("Create the Shopify draft first.");
      const updateData = await shopifyGraphQL(UPDATE_PRODUCT, { product: { id: productRecord.shopify_product_id, status: "ACTIVE" } });
      ensureNoErrors(updateData, "productUpdate");
      const updated = await supabase.from("products").update({ status: "active", publish_error: null, updated_at: new Date().toISOString() }).eq("id", productRecord.id).select().single();
      if (updated.error) throw updated.error;
      productRecord = updated.data;
      await supabase.from("designs").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", designId);
      await recordRun(supabase, productRecord.id, "shopify", "activate", "success", updateData);
      await logActivity(supabase, "shopify_publish", `Activated ${review.title}`, "Product status changed to ACTIVE in Shopify.", "success", { designId, productId: productRecord.id });
      return NextResponse.json({ ok: true, message: "Product activated in Shopify. Confirm sales-channel publication and Printful fulfillment before taking orders.", product: productRecord });
    }

    throw new Error("Unknown publisher action.");
  } catch (error) {
    if (productRecord?.id) {
      await supabase.from("products").update({ publish_error: error.message, updated_at: new Date().toISOString() }).eq("id", productRecord.id);
      await recordRun(supabase, productRecord.id, "publisher", "failed", "error", null, error.message);
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
