import { shopifyGraphQL } from "./shopify.js";

export const SHOPIFY_STOREFRONT_PRODUCTS_QUERY = `
query StorefrontProducts($first: Int!) {
  products(first: $first, sortKey: UPDATED_AT, reverse: true, query: "status:active") {
    nodes {
      id
      title
      handle
      status
      productType
      updatedAt
      onlineStoreUrl
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      featuredMedia {
        preview {
          image { url altText }
        }
      }
    }
  }
}`;

export function normalizeShopifyCatalogProduct(product) {
  const image = product?.featuredMedia?.preview?.image;
  const minPrice = product?.priceRangeV2?.minVariantPrice;
  const maxPrice = product?.priceRangeV2?.maxVariantPrice;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    productType: product.productType || null,
    updatedAt: product.updatedAt || null,
    onlineStoreUrl: product.onlineStoreUrl || null,
    image: image?.url || null,
    imageAlt: image?.altText || product.title,
    minPrice: minPrice?.amount ?? null,
    maxPrice: maxPrice?.amount ?? minPrice?.amount ?? null,
    currencyCode: minPrice?.currencyCode || "USD"
  };
}

export function orderShopifyStorefrontProducts(
  publishedProducts,
  featuredRows = [],
  limit = 8
) {
  const featuredIds = new Set(
    featuredRows.map((row) => String(row.shopify_product_id))
  );
  const publishedMap = new Map(
    publishedProducts.map((product) => [String(product.id), product])
  );
  const automaticProducts = publishedProducts.filter(
    (product) => !featuredIds.has(String(product.id))
  );
  const curatedProducts = featuredRows
    .map((row) => publishedMap.get(String(row.shopify_product_id)))
    .filter(Boolean);
  const safeLimit = Math.max(1, Number(limit) || 8);
  const automaticSlots = automaticProducts.length
    ? Math.max(1, safeLimit - curatedProducts.length)
    : 0;
  const selectedAutomatic = automaticProducts.slice(0, automaticSlots);
  const selectedCurated = curatedProducts.slice(
    0,
    safeLimit - selectedAutomatic.length
  );

  return [
    ...selectedAutomatic,
    ...selectedCurated
  ];
}

export async function readShopifyStorefrontProducts(first = 100) {
  const safeFirst = Math.min(100, Math.max(1, Number(first) || 100));
  const data = await shopifyGraphQL(SHOPIFY_STOREFRONT_PRODUCTS_QUERY, {
    first: safeFirst
  });

  return (data?.products?.nodes || []).map(normalizeShopifyCatalogProduct);
}
