import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  STOREFRONT_KEY
} from "@/lib/storefront";
import { productTypeFamily } from "@/lib/product-types";

const EDITABLE_FIELDS = [
  "site_name", "shop_domain", "announcement_text", "hero_eyebrow",
  "hero_headline", "hero_subheadline", "primary_cta_label",
  "primary_cta_url", "secondary_cta_label", "secondary_cta_url",
  "manifesto_headline", "manifesto_body", "collection_title",
  "collection_handle", "collection_description", "palette",
  "shipping_policy_title", "shipping_policy_body",
  "returns_policy_title", "returns_policy_body",
  "fulfillment_note"
];

function cleanText(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanSettings(input = {}) {
  const output = { key: STOREFRONT_KEY, updated_at: new Date().toISOString() };
  for (const field of EDITABLE_FIELDS) {
    if (!(field in input)) continue;
    output[field] = field === "palette" ? input[field] : cleanText(input[field]);
  }
  output.collection_handle = cleanText(
    output.collection_handle || input.collection_handle || "the-brokie-featured",
    100
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return output;
}

function cleanProduct(product, position) {
  if (!product?.id || !product?.title || !product?.handle) {
    throw new Error("Every featured item needs a Shopify product ID, title, and handle.");
  }
  const productType = cleanText(product.productType, 120) || "tee";

  return {
    shopify_product_id: cleanText(product.id, 200),
    position,
    badge: cleanText(product.badge, 60),
    display_title: cleanText(product.displayTitle, 160),
    display_subtitle: cleanText(product.displaySubtitle, 240),
    product_type: productType,
    family: productTypeFamily(productType),
    product_title: cleanText(product.title, 255),
    product_handle: cleanText(product.handle, 255),
    product_url: cleanText(product.onlineStoreUrl, 1000) || null,
    image_url: cleanText(product.image, 2000) || null,
    image_alt: cleanText(product.imageAlt || product.title, 255),
    min_price: product.minPrice === null ? null : Number(product.minPrice),
    max_price: product.maxPrice === null ? null : Number(product.maxPrice),
    currency_code: cleanText(product.currencyCode || "USD", 8),
    shopify_status: cleanText(product.status || "ACTIVE", 30),
    active: true,
    updated_at: new Date().toISOString()
  };
}

async function readState(supabase) {
  const [{ data: settings, error: settingsError }, { data: featured, error: featuredError }] =
    await Promise.all([
      supabase.from("storefront_settings").select("*").eq("key", STOREFRONT_KEY).maybeSingle(),
      supabase.from("storefront_featured_products").select("*").eq("active", true).order("position")
    ]);
  if (settingsError) throw settingsError;
  if (featuredError) throw featuredError;
  return { settings: settings || DEFAULT_STOREFRONT_SETTINGS, featured: featured || [] };
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await readState(createSupabaseAdminClient())) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const products = Array.isArray(body.products) ? body.products.slice(0, 8) : [];
    const unique = new Set(products.map((product) => product.id));
    if (unique.size !== products.length) throw new Error("Featured products must be unique.");

    const supabase = createSupabaseAdminClient();
    const { error: settingsError } = await supabase
      .from("storefront_settings")
      .upsert(cleanSettings(body.settings), { onConflict: "key" });
    if (settingsError) throw settingsError;

    const { error: deleteError } = await supabase
      .from("storefront_featured_products")
      .delete()
      .not("id", "is", null);
    if (deleteError) throw deleteError;

    if (products.length) {
      const rows = products.map(cleanProduct);
      const { error: insertError } = await supabase
        .from("storefront_featured_products")
        .insert(rows);
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true, ...(await readState(supabase)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
