import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { shopifyGraphQL } from "@/lib/shopify";
import { publishResourceToOnlineStore } from "@/lib/shopify-publications";
import { STOREFRONT_KEY } from "@/lib/storefront";

const CREATE_COLLECTION = `mutation CreateFeaturedCollection($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id title handle }
    userErrors { field message }
  }
}`;

const UPDATE_COLLECTION = `mutation UpdateFeaturedCollection($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection { id title handle }
    userErrors { field message }
  }
}`;

const READ_COLLECTION = `query ReadFeaturedCollection($id: ID!) {
  collection(id: $id) { id title handle products(first: 250) { nodes { id } } }
}`;

const ADD_PRODUCTS = `mutation AddFeaturedProducts($id: ID!, $productIds: [ID!]!) {
  collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } }
}`;

const REMOVE_PRODUCTS = `mutation RemoveFeaturedProducts($id: ID!, $productIds: [ID!]!) {
  collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { field message } }
}`;

function errors(payload, key) {
  return (payload?.[key]?.userErrors || []).map((item) => item.message).join("; ");
}

async function syncMembers(collectionId, desiredIds) {
  const state = await shopifyGraphQL(READ_COLLECTION, { id: collectionId });
  if (!state.collection) throw new Error("The saved Shopify collection no longer exists.");
  const current = new Set((state.collection.products?.nodes || []).map((item) => item.id));
  const desired = new Set(desiredIds);
  const add = desiredIds.filter((id) => !current.has(id));
  const remove = [...current].filter((id) => !desired.has(id));
  if (add.length) {
    const result = await shopifyGraphQL(ADD_PRODUCTS, { id: collectionId, productIds: add });
    const message = errors(result, "collectionAddProducts");
    if (message) throw new Error(message);
  }
  if (remove.length) {
    const result = await shopifyGraphQL(REMOVE_PRODUCTS, { id: collectionId, productIds: remove });
    const message = errors(result, "collectionRemoveProducts");
    if (message) throw new Error(message);
  }
  return { added: add.length, removed: remove.length };
}

export async function POST() {
  try {
    const supabase = createSupabaseAdminClient();
    const [{ data: settings, error: settingsError }, { data: featured, error: featuredError }] =
      await Promise.all([
        supabase.from("storefront_settings").select("*").eq("key", STOREFRONT_KEY).single(),
        supabase.from("storefront_featured_products").select("shopify_product_id").eq("active", true).order("position")
      ]);
    if (settingsError) throw settingsError;
    if (featuredError) throw featuredError;
    let productIds = (featured || []).map((item) => item.shopify_product_id).filter(Boolean);
    if (!productIds.length) {
      const { data: liveProducts, error: liveProductsError } = await supabase
        .from("products")
        .select("shopify_product_id")
        .eq("status", "live")
        .order("launched_at", { ascending: false })
        .limit(8);
      if (liveProductsError) throw liveProductsError;
      productIds = (liveProducts || []).map((item) => item.shopify_product_id).filter(Boolean);
    }
    if (!productIds.length) throw new Error("Publish at least one Brokie product before syncing the collection.");

    let collection;
    let changes = { added: productIds.length, removed: 0 };
    if (!settings.shopify_collection_id) {
      const result = await shopifyGraphQL(CREATE_COLLECTION, {
        input: {
          title: settings.collection_title,
          handle: settings.collection_handle,
          descriptionHtml: `<p>${String(settings.collection_description || "").replace(/[<>]/g, "")}</p>`,
          products: productIds
        }
      });
      const message = errors(result, "collectionCreate");
      if (message) throw new Error(message);
      collection = result.collectionCreate.collection;
    } else {
      const result = await shopifyGraphQL(UPDATE_COLLECTION, {
        input: {
          id: settings.shopify_collection_id,
          title: settings.collection_title,
          handle: settings.collection_handle,
          descriptionHtml: `<p>${String(settings.collection_description || "").replace(/[<>]/g, "")}</p>`
        }
      });
      const message = errors(result, "collectionUpdate");
      if (message) throw new Error(message);
      collection = result.collectionUpdate.collection;
      changes = await syncMembers(collection.id, productIds);
    }

    await publishResourceToOnlineStore(collection.id);
    const { error: saveError } = await supabase
      .from("storefront_settings")
      .update({ shopify_collection_id: collection.id, updated_at: new Date().toISOString() })
      .eq("key", STOREFRONT_KEY);
    if (saveError) throw saveError;

    return NextResponse.json({
      ok: true,
      collection,
      changes,
      storefrontUrl: `https://${settings.shop_domain}/collections/${collection.handle}`
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
