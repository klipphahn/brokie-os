import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  absoluteShopUrl,
  DEFAULT_STOREFRONT_SETTINGS,
  storefrontPublicSettings,
  STOREFRONT_KEY
} from "@/lib/storefront";

function cleanNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeFeaturedRow(rawSettings, row) {
  return {
    id: row.shopify_product_id,
    title: row.display_title || row.product_title,
    originalTitle: row.product_title,
    subtitle: row.display_subtitle,
    badge: row.badge,
    handle: row.product_handle,
    url:
      row.product_url ||
      absoluteShopUrl(
        rawSettings.shop_domain,
        `/products/${row.product_handle}`
      ),
    image: row.image_url,
    imageAlt: row.image_alt || row.product_title,
    price: row.min_price === null ? null : Number(row.min_price),
    maxPrice: row.max_price === null ? null : Number(row.max_price),
    currencyCode: row.currency_code,
    position: row.position
  };
}

function normalizeLiveProduct(rawSettings, product, position = 0) {
  const design = Array.isArray(product.designs)
    ? product.designs[0] || {}
    : product.designs || {};

  return {
    id: product.shopify_product_id,
    title: product.title,
    originalTitle: product.title,
    subtitle:
      product.product_type ||
      design.name ||
      "Live Brokie drop",
    badge: "LIVE",
    handle: product.shopify_handle,
    url:
      product.online_store_url ||
      absoluteShopUrl(
        rawSettings.shop_domain,
        `/products/${product.shopify_handle}`
      ),
    image:
      design.thumbnail_url ||
      design.front_artwork_url ||
      null,
    imageAlt: design.name || product.title,
    price: cleanNumber(product.retail_price),
    maxPrice: cleanNumber(product.retail_price),
    currencyCode: "USD",
    position
  };
}

export async function loadStorefrontFeed(
  supabase = createSupabaseAdminClient()
) {
  const [
    { data: settings, error: settingsError },
    { data: featured, error: featuredError }
  ] = await Promise.all([
    supabase
      .from("storefront_settings")
      .select("*")
      .eq("key", STOREFRONT_KEY)
      .maybeSingle(),
    supabase
      .from("storefront_featured_products")
      .select("*")
      .eq("active", true)
      .order("position")
  ]);

  if (settingsError) throw settingsError;
  if (featuredError) throw featuredError;

  const rawSettings = settings || DEFAULT_STOREFRONT_SETTINGS;
  const storefront = storefrontPublicSettings(rawSettings);

  if (featured?.length) {
    return {
      storefront,
      products: featured.map((row) =>
        normalizeFeaturedRow(rawSettings, row)
      )
    };
  }

  const { data: products, error: liveError } = await supabase
    .from("products")
    .select(
      "id, title, product_type, retail_price, shopify_handle, online_store_url, online_store_published, launched_at, shopify_product_id, designs(id,name,front_artwork_url,thumbnail_url)"
    )
    .eq("status", "live")
    .order("launched_at", { ascending: false })
    .limit(8);

  if (liveError) throw liveError;

  return {
    storefront,
    products: (products || []).map((product, index) =>
      normalizeLiveProduct(rawSettings, product, index)
    )
  };
}

export async function promoteStorefrontProduct(
  productRecord,
  overrides = {},
  supabase = createSupabaseAdminClient()
) {
  if (!productRecord?.shopify_product_id) {
    throw new Error("A Shopify product ID is required.");
  }

  const { data: current, error: currentError } = await supabase
    .from("storefront_featured_products")
    .select("*")
    .eq("active", true)
    .order("position");

  if (currentError) throw currentError;

  const nextRow = {
    shopify_product_id: productRecord.shopify_product_id,
    position: 0,
    badge: overrides.badge || "NEW",
    display_title:
      overrides.display_title ||
      productRecord.title ||
      productRecord.product_title ||
      "",
    display_subtitle:
      overrides.display_subtitle ||
      productRecord.product_type ||
      "",
    product_title:
      productRecord.title || productRecord.product_title || "",
    product_handle:
      productRecord.shopify_handle ||
      productRecord.handle ||
      "",
    product_url:
      overrides.product_url ||
      productRecord.online_store_url ||
      null,
    image_url:
      overrides.image_url ||
      productRecord.image_url ||
      productRecord.image ||
      null,
    image_alt:
      overrides.image_alt ||
      productRecord.title ||
      productRecord.product_title ||
      "",
    min_price:
      overrides.min_price ?? cleanNumber(productRecord.retail_price),
    max_price:
      overrides.max_price ?? cleanNumber(productRecord.retail_price),
    currency_code: overrides.currency_code || "USD",
    shopify_status: productRecord.status || "ACTIVE",
    active: true,
    updated_at: new Date().toISOString()
  };

  const remainder = (current || [])
    .filter(
      (row) =>
        String(row.shopify_product_id) !==
        String(productRecord.shopify_product_id)
    )
    .slice(0, 7)
    .map((row, index) => ({
      shopify_product_id: row.shopify_product_id,
      position: index + 1,
      badge: row.badge || "",
      display_title: row.display_title || "",
      display_subtitle: row.display_subtitle || "",
      product_title: row.product_title,
      product_handle: row.product_handle,
      product_url: row.product_url || null,
      image_url: row.image_url || null,
      image_alt: row.image_alt || row.product_title,
      min_price: row.min_price,
      max_price: row.max_price,
      currency_code: row.currency_code || "USD",
      shopify_status: row.shopify_status || "ACTIVE",
      active: true,
      updated_at: new Date().toISOString()
    }));

  const { error: deleteError } = await supabase
    .from("storefront_featured_products")
    .delete()
    .not("id", "is", null);
  if (deleteError) throw deleteError;

  const rows = [nextRow, ...remainder];
  const { error: insertError } = await supabase
    .from("storefront_featured_products")
    .insert(rows);
  if (insertError) throw insertError;

  return rows;
}
