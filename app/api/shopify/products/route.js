import { NextResponse } from "next/server";
import { shopifyAdminProductUrl, shopifyGraphQL } from "@/lib/shopify";
import { numericShopifyId, printfulRequest } from "@/lib/printful";
import { requireAdminApiUser } from "@/lib/admin-api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const QUERY = `
query Products($first: Int!) {
  products(first: $first, sortKey: UPDATED_AT, reverse: true) {
    nodes {
      id
      title
      handle
      description
      status
      productType
      tags
      onlineStoreUrl
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      featuredMedia {
        preview {
          image {
            url
            altText
          }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
  }
}`;

const UPDATE_STATUS = `
mutation UpdateProductStatus($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id status }
    userErrors { field message }
  }
}`;

const DELETE_PRODUCT = `
mutation DeleteProduct($input: ProductDeleteInput!) {
  productDelete(input: $input) {
    deletedProductId
    userErrors { field message }
  }
}`;

function ensureNoUserErrors(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }
}

async function removeFromFeatured(supabase, productId) {
  const { error } = await supabase
    .from("storefront_featured_products")
    .delete()
    .eq("shopify_product_id", productId);
  if (error) throw error;
}

async function logActivity(supabase, action, title, detail, metadata = {}) {
  const { error } = await supabase.from("activity_logs").insert({
    action,
    title,
    detail,
    status: "success",
    metadata
  });
  if (error) throw error;
}

export async function GET(request) {
  try {
    const first = Math.min(
      100,
      Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 50))
    );

    const data = await shopifyGraphQL(QUERY, { first });

    const products = data.products.nodes.map((product) => {
      const variants = product.variants.nodes || [];
      const prices = variants
        .map((variant) => Number(variant.price))
        .filter(Number.isFinite);

      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        description: product.description,
        status: product.status,
        productType: product.productType,
        tags: product.tags,
        image: product.featuredMedia?.preview?.image?.url || null,
        imageAlt: product.featuredMedia?.preview?.image?.altText || product.title,
        minPrice: product.priceRangeV2?.minVariantPrice?.amount ||
          (prices.length ? Math.min(...prices).toFixed(2) : null),
        maxPrice: product.priceRangeV2?.maxVariantPrice?.amount ||
          (prices.length ? Math.max(...prices).toFixed(2) : null),
        currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode || "USD",
        onlineStoreUrl: product.onlineStoreUrl,
        inventory: variants.reduce(
          (sum, variant) => sum + Number(variant.inventoryQuantity || 0),
          0
        ),
        variantCount: variants.length,
        adminUrl: shopifyAdminProductUrl(product.id)
      };
    });

    return NextResponse.json({ ok: true, products });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function PATCH(request) {
  try {
    await requireAdminApiUser(request);
    const body = await request.json();
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim();
    if (!id) throw new Error("Shopify product id is required.");
    if (!["archive", "restore"].includes(action)) {
      throw new Error("Choose archive or restore.");
    }

    const status = action === "archive" ? "ARCHIVED" : "DRAFT";
    const result = await shopifyGraphQL(UPDATE_STATUS, {
      product: { id, status }
    });
    ensureNoUserErrors(result, "productUpdate");

    const supabase = createSupabaseAdminClient();
    if (action === "archive") await removeFromFeatured(supabase, id);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        status: action === "archive" ? "archived" : "shopify_draft",
        online_store_published: false,
        updated_at: new Date().toISOString()
      })
      .eq("shopify_product_id", id);
    if (updateError) throw updateError;

    await logActivity(
      supabase,
      `shopify_product_${action}d`,
      `${action === "archive" ? "Archived" : "Restored"} Shopify product`,
      action === "archive"
        ? "Product was archived and removed from the featured storefront."
        : "Product was restored to Shopify as a draft.",
      { shopifyProductId: id }
    );

    return NextResponse.json({
      ok: true,
      product: result.productUpdate.product,
      message: action === "archive"
        ? "Product archived and removed from featured."
        : "Product restored as a Shopify draft."
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(request) {
  try {
    await requireAdminApiUser(request);
    const body = await request.json();
    const id = String(body.id || "").trim();
    const confirmation = String(body.confirmation || "").trim();
    if (!id) throw new Error("Shopify product id is required.");
    if (confirmation !== "DELETE") {
      throw new Error('Type "DELETE" to confirm permanent deletion.');
    }

    const supabase = createSupabaseAdminClient();
    const { data: internalProduct, error: productError } = await supabase
      .from("products")
      .select("id,title,printful_sync_product_id")
      .eq("shopify_product_id", id)
      .maybeSingle();
    if (productError) throw productError;

    const archived = await shopifyGraphQL(UPDATE_STATUS, {
      product: { id, status: "ARCHIVED" }
    });
    ensureNoUserErrors(archived, "productUpdate");
    await removeFromFeatured(supabase, id);

    let printfulRemoved = false;
    const printfulId = internalProduct?.printful_sync_product_id ||
      `@${numericShopifyId(id)}`;
    try {
      await printfulRequest(
        `/sync/products/${encodeURIComponent(printfulId)}`,
        { method: "DELETE" }
      );
      printfulRemoved = true;
    } catch (printfulError) {
      if (printfulError.status !== 404) throw printfulError;
    }

    const result = await shopifyGraphQL(DELETE_PRODUCT, { input: { id } });
    ensureNoUserErrors(result, "productDelete");

    if (internalProduct?.id) {
      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", internalProduct.id);
      if (deleteError) throw deleteError;
    }

    await logActivity(
      supabase,
      "product_deleted_everywhere",
      `Deleted ${internalProduct?.title || "product"}`,
      "Product was permanently removed from Printful, Shopify, the featured storefront, and Brokie OS.",
      { shopifyProductId: id, printfulRemoved }
    );

    return NextResponse.json({
      ok: true,
      deleted: result.productDelete.deletedProductId,
      printfulRemoved,
      message: "Product deleted everywhere."
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status || 400 }
    );
  }
}
