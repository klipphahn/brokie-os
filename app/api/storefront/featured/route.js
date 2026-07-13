import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  absoluteShopUrl,
  DEFAULT_STOREFRONT_SETTINGS,
  storefrontPublicSettings,
  STOREFRONT_KEY
} from "@/lib/storefront";

const PUBLIC_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
  "X-Content-Type-Options": "nosniff"
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: settings, error: settingsError }, { data: rows, error: productsError }] =
      await Promise.all([
        supabase.from("storefront_settings").select("*").eq("key", STOREFRONT_KEY).maybeSingle(),
        supabase.from("storefront_featured_products").select("*").eq("active", true).order("position")
      ]);
    if (settingsError) throw settingsError;
    if (productsError) throw productsError;

    const rawSettings = settings || DEFAULT_STOREFRONT_SETTINGS;
    const storefront = storefrontPublicSettings(rawSettings);
    const products = (rows || []).map((row) => ({
      id: row.shopify_product_id,
      title: row.display_title || row.product_title,
      originalTitle: row.product_title,
      subtitle: row.display_subtitle,
      badge: row.badge,
      handle: row.product_handle,
      url: row.product_url || absoluteShopUrl(rawSettings.shop_domain, `/products/${row.product_handle}`),
      image: row.image_url,
      imageAlt: row.image_alt || row.product_title,
      price: row.min_price === null ? null : Number(row.min_price),
      maxPrice: row.max_price === null ? null : Number(row.max_price),
      currencyCode: row.currency_code,
      position: row.position
    }));

    return NextResponse.json(
      { ok: true, schemaVersion: "1.0", storefront, products },
      { headers: PUBLIC_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Storefront feed is temporarily unavailable." },
      { status: 503, headers: PUBLIC_HEADERS }
    );
  }
}
