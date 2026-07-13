import { NextResponse } from "next/server";
import { shopifyAdminProductUrl, shopifyGraphQL } from "@/lib/shopify";

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
