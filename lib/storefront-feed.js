import {
  createSupabaseAdminClient,
  tryCreateSupabaseAdminClient
} from "@/lib/supabase/admin";
import {
  absoluteShopUrl,
  DEFAULT_STOREFRONT_SETTINGS,
  storefrontPublicSettings,
  STOREFRONT_KEY
} from "@/lib/storefront";
import { buildBrandBrain } from "@/lib/brand-brain";
import {
  merchListingCopy,
  merchListingCopyForProduct,
  resolveMerchFieldOverride,
  productTypeFamily
} from "@/lib/product-types";
import {
  orderShopifyStorefrontProducts,
  readShopifyStorefrontProducts
} from "@/lib/shopify-catalog";

function cleanNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function merchPriorityScore(product) {
  const text = [
    product?.title,
    product?.originalTitle,
    product?.displayTitle,
    product?.product_title,
    product?.productType,
    product?.handle,
    product?.product_handle,
    product?.badge
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("pacheco")) return 1000;
  if (text.includes("featured")) return 900;
  if (product?.status === "live" || product?.status === "active") return 800;
  if (product?.onlineStorePublished) return 780;
  if (product?.printful_status === "configured") return 760;
  if (text.includes("founder")) return 720;
  if (text.includes("drop")) return 700;
  if ((product?.family || "").toLowerCase() === "apparel") return 650;
  if ((product?.family || "").toLowerCase() === "headwear") return 620;
  if ((product?.family || "").toLowerCase() === "sticker") return 580;
  return 500;
}

function sortMerchProducts(products) {
  return [...(Array.isArray(products) ? products : [])].sort((left, right) => {
    const leftScore = merchPriorityScore(left);
    const rightScore = merchPriorityScore(right);
    if (leftScore !== rightScore) return rightScore - leftScore;

    const leftPosition = Number.isFinite(Number(left.position))
      ? Number(left.position)
      : 999;
    const rightPosition = Number.isFinite(Number(right.position))
      ? Number(right.position)
      : 999;
    if (leftPosition !== rightPosition) return leftPosition - rightPosition;

    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

function normalizeFeaturedRow(
  rawSettings,
  row,
  productRecord = null,
  shopifyProduct = null,
  position = row.position
) {
  const liveProduct = shopifyProduct || {
    productType: productRecord?.product_type || row.product_type,
    title: productRecord?.title || row.product_title,
    handle: productRecord?.shopify_handle || row.product_handle
  };
  const copy = merchListingCopyForProduct(liveProduct);
  const displayTitle = resolveMerchFieldOverride({
    value: row.display_title,
    field: "title",
    storedProductType: row.product_type,
    liveProduct
  });
  const displaySubtitle = resolveMerchFieldOverride({
    value: row.display_subtitle,
    field: "subtitle",
    storedProductType: row.product_type,
    liveProduct
  });
  const badge = resolveMerchFieldOverride({
    value: row.badge,
    field: "badge",
    storedProductType: row.product_type,
    liveProduct
  });
  const title = displayTitle || liveProduct.title || row.product_title;
  const handle = shopifyProduct?.handle || productRecord?.shopify_handle || row.product_handle;
  const productType = shopifyProduct?.productType || productRecord?.product_type || row.product_type || null;
  return {
    id: row.shopify_product_id,
    title,
    originalTitle: liveProduct.title || row.product_title,
    subtitle: displaySubtitle || copy.subtitle,
    badge: badge || copy.badge,
    productType,
    family: copy.family || null,
    familyLabel: copy.familyLabel || null,
    fitNote: copy.fitNote || null,
    story: copy.story || null,
    cardLabel: copy.cardLabel || null,
    handle,
    url:
      shopifyProduct?.onlineStoreUrl ||
      row.product_url ||
      productRecord?.online_store_url ||
      absoluteShopUrl(
        rawSettings.shop_domain,
        `/products/${handle}`
      ),
    image: shopifyProduct?.image || row.image_url,
    imageAlt: shopifyProduct?.imageAlt || row.image_alt || title,
    price: shopifyProduct
      ? cleanNumber(shopifyProduct.minPrice)
      : row.min_price === null ? null : Number(row.min_price),
    maxPrice: shopifyProduct
      ? cleanNumber(shopifyProduct.maxPrice)
      : row.max_price === null ? null : Number(row.max_price),
    currencyCode: shopifyProduct?.currencyCode || row.currency_code,
    position,
    status: shopifyProduct?.status || productRecord?.status || row.shopify_status || null,
    onlineStorePublished: shopifyProduct
      ? Boolean(shopifyProduct.onlineStoreUrl)
      : Boolean(productRecord?.online_store_published),
    printful_status: productRecord?.printful_status || null,
    priorityScore: merchPriorityScore({
      ...row,
      ...productRecord,
      ...shopifyProduct,
      title,
      originalTitle: liveProduct.title || row.product_title,
      productType,
      family: copy.family
    })
  };
}

function normalizeAutomaticShopifyProduct(
  rawSettings,
  shopifyProduct,
  featuredRow = null,
  productRecord = null,
  position = 0
) {
  if (featuredRow) {
    return normalizeFeaturedRow(
      rawSettings,
      featuredRow,
      productRecord,
      shopifyProduct,
      position
    );
  }

  const copy = merchListingCopyForProduct(shopifyProduct);
  return {
    id: shopifyProduct.id,
    title: shopifyProduct.title,
    originalTitle: shopifyProduct.title,
    subtitle: copy.subtitle,
    badge: copy.badge,
    productType: shopifyProduct.productType,
    family: copy.family,
    familyLabel: copy.familyLabel,
    fitNote: copy.fitNote,
    story: copy.story,
    cardLabel: copy.cardLabel,
    handle: shopifyProduct.handle,
    url:
      shopifyProduct.onlineStoreUrl ||
      absoluteShopUrl(rawSettings.shop_domain, `/products/${shopifyProduct.handle}`),
    image: shopifyProduct.image,
    imageAlt: shopifyProduct.imageAlt || shopifyProduct.title,
    price: cleanNumber(shopifyProduct.minPrice),
    maxPrice: cleanNumber(shopifyProduct.maxPrice),
    currencyCode: shopifyProduct.currencyCode,
    position,
    status: shopifyProduct.status,
    onlineStorePublished: Boolean(shopifyProduct.onlineStoreUrl),
    printful_status: productRecord?.printful_status || null,
    priorityScore: merchPriorityScore({
      ...shopifyProduct,
      originalTitle: shopifyProduct.title,
      family: copy.family
    })
  };
}

function normalizeLiveProduct(rawSettings, product, position = 0) {
  const design = Array.isArray(product.designs)
    ? product.designs[0] || {}
    : product.designs || {};
  const copy = merchListingCopyForProduct(product);

  return {
    id: product.shopify_product_id,
    title: product.title,
    originalTitle: product.title,
    subtitle:
      copy.subtitle ||
      product.product_type ||
      design.name ||
      "Live Brokie drop",
    badge: "LIVE",
    productType: product.product_type || null,
    family: copy.family || null,
    familyLabel: copy.familyLabel || null,
    fitNote: copy.fitNote || null,
    story: copy.story || null,
    cardLabel: copy.cardLabel || null,
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
    position,
    status: product.status || null,
    onlineStorePublished: Boolean(product.online_store_published),
    printful_status: product.printful_status || null,
    priorityScore: merchPriorityScore({
      ...product,
      title: product.title,
      originalTitle: product.title,
      productType: product.product_type,
      family: copy.family
    })
  };
}

function fallbackMerchProducts(storefront) {
  const merchFamilies = [
    { id: "fallback-tee", productType: "Heavyweight Tee" },
    { id: "fallback-hoodie", productType: "Premium Hoodie" },
    { id: "fallback-hat", productType: "Embroidered Hat" },
    { id: "fallback-sticker", productType: "Sticker" }
  ];

  return merchFamilies.map(({ id, productType }, position) => {
    const copy = merchListingCopy(productType);
    return {
      id,
      title: copy.title,
      originalTitle: copy.title,
      subtitle: copy.subtitle,
      badge: copy.badge,
      productType,
      family: copy.family,
      familyLabel: copy.familyLabel,
      fitNote: copy.fitNote,
      story: copy.story,
      cardLabel: copy.cardLabel,
      handle: `${String(productType).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fallback`,
      url: storefront.collection.url,
      image: null,
      imageAlt: copy.title,
      price: null,
      maxPrice: null,
      currencyCode: "USD",
      position,
      status: "draft",
      onlineStorePublished: false,
      printful_status: "pending",
      priorityScore: 100 - position
    };
  });
}

function fallbackFeed(storefront, activity = [], reason = "") {
  const recommendations = fallbackMerchProducts(storefront);
  const brain = buildBrandBrain({
    storefront,
    products: recommendations,
    launchQueue: recommendations.map((product) => ({
      product: {
        shopify_product_id: product.id,
        title: product.title,
        productType: product.productType,
        status: "blocked",
        printful_status: "unknown"
      }
    })),
    settings: DEFAULT_STOREFRONT_SETTINGS
  });

  return {
    storefront,
    // Placeholder families are useful to the brand brain, but never expose
    // them as buyable cards. Consumers can otherwise render null as $0.00.
    products: [],
    brain: {
      ...brain,
      headline: reason ? `Fallback merch feed active${reason ? ` — ${reason}` : ""}` : brain.headline,
      summary:
        reason ||
        "The storefront is using safe fallback merch while the live feed reconnects."
    },
    launch: brain.launch,
    activity: Array.isArray(activity) ? activity : []
  };
}

export async function loadStorefrontFeed(supabase = null) {
  const client = supabase || tryCreateSupabaseAdminClient();
  try {
    const [
      { data: settings, error: settingsError },
      { data: featured, error: featuredError },
      { data: activity, error: activityError }
    ] = await Promise.all([
      client
        .from("storefront_settings")
        .select("*")
        .eq("key", STOREFRONT_KEY)
        .maybeSingle(),
      client
        .from("storefront_featured_products")
        .select("*")
        .eq("active", true)
        .order("position"),
      client
        .from("activity_logs")
        .select("id,title,detail,status,created_at,action")
        .order("created_at", { ascending: false })
        .limit(6)
    ]);

    if (settingsError || featuredError || activityError) {
      console.error("Storefront feed read failed", {
        settings: settingsError
          ? { code: settingsError.code, message: settingsError.message }
          : null,
        featured: featuredError
          ? { code: featuredError.code, message: featuredError.message }
          : null,
        activity: activityError
          ? { code: activityError.code, message: activityError.message }
          : null
      });
      return fallbackFeed(
        storefrontPublicSettings(DEFAULT_STOREFRONT_SETTINGS),
        [],
        "Store data is still reconnecting."
      );
    }

    const rawSettings = settings || DEFAULT_STOREFRONT_SETTINGS;
    const storefront = storefrontPublicSettings(rawSettings);

    try {
      const shopifyProducts = await readShopifyStorefrontProducts(100);
      const publishedProducts = shopifyProducts.filter(
        (product) =>
          product.status === "ACTIVE" &&
          Boolean(product.onlineStoreUrl)
      );

      if (publishedProducts.length) {
        const featuredMap = new Map(
          (featured || []).map((row) => [String(row.shopify_product_id), row])
        );
        const storefrontProducts = orderShopifyStorefrontProducts(
          publishedProducts,
          featured || [],
          8
        );
        const publishedIds = storefrontProducts.map((product) => product.id);
        const { data: localProducts, error: localProductsError } = await client
          .from("products")
          .select(
            "id, title, product_type, retail_price, shopify_handle, online_store_url, online_store_published, launched_at, shopify_product_id, status, printful_status, designs(id,name,front_artwork_url,thumbnail_url)"
          )
          .in("shopify_product_id", publishedIds)
          .limit(publishedIds.length);

        if (localProductsError) {
          console.error("Local Shopify product metadata could not be loaded", {
            code: localProductsError.code,
            message: localProductsError.message
          });
        }

        const localMap = new Map(
          (localProducts || []).map((item) => [String(item.shopify_product_id), item])
        );
        const products = storefrontProducts.map((product, index) =>
          normalizeAutomaticShopifyProduct(
            rawSettings,
            product,
            featuredMap.get(String(product.id)) || null,
            localMap.get(String(product.id)) || null,
            index
          )
        );
        const brain = buildBrandBrain({
          storefront,
          products,
          launchQueue: (localProducts || []).map((product) => ({ product })),
          settings: rawSettings
        });

        return {
          storefront,
          products,
          brain,
          launch: brain.launch,
          activity: activity || []
        };
      }
    } catch (error) {
      console.error("Live Shopify catalog refresh failed; using saved feed", {
        message: error?.message || "Unknown Shopify error"
      });
    }

    if (featured?.length) {
      const featuredIds = featured.map((row) => row.shopify_product_id);
      const { data: liveFeatured, error: liveFeaturedError } = await client
        .from("products")
        .select(
          "id, title, product_type, retail_price, shopify_handle, online_store_url, online_store_published, launched_at, shopify_product_id, status, printful_status, designs(id,name,front_artwork_url,thumbnail_url)"
        )
        .in("shopify_product_id", featuredIds)
        .limit(featuredIds.length || 1);

      if (liveFeaturedError) {
        return fallbackFeed(storefront, activity || [], "Featured products could not be loaded.");
      }

      const liveMap = new Map(
        (liveFeatured || []).map((item) => [item.shopify_product_id, item])
      );
      const products = sortMerchProducts(
        featured.map((row) =>
          normalizeFeaturedRow(
            rawSettings,
            row,
            liveMap.get(row.shopify_product_id) || null
          )
        )
      );
      const brain = buildBrandBrain({
        storefront,
        products,
        launchQueue: (liveFeatured || []).map((product) => ({
          product
        })),
        settings: rawSettings
      });

      return {
        storefront,
        products,
        brain,
        launch: brain.launch,
        activity: activity || []
      };
    }

    const { data: products, error: liveError } = await client
      .from("products")
      .select(
        "id, title, product_type, retail_price, shopify_handle, online_store_url, online_store_published, launched_at, shopify_product_id, status, printful_status, designs(id,name,front_artwork_url,thumbnail_url)"
      )
      .eq("status", "live")
      .order("launched_at", { ascending: false })
      .limit(8);

    if (liveError) {
      return fallbackFeed(storefront, activity || [], "Live products could not be loaded.");
    }

    const productsList = sortMerchProducts(
      (products || []).map((product, index) =>
        normalizeLiveProduct(rawSettings, product, index)
      )
    );

    if (!productsList.length) {
      return fallbackFeed(storefront, activity || [], "No live products are published yet.");
    }

    const brain = buildBrandBrain({
      storefront,
      products: productsList,
      launchQueue: (products || []).map((product) => ({
        product
      })),
      settings: rawSettings
    });

    return {
      storefront,
      products: productsList,
      brain,
      launch: brain.launch,
      activity: activity || []
    };
  } catch (error) {
    const storefront = storefrontPublicSettings(DEFAULT_STOREFRONT_SETTINGS);
    return fallbackFeed(storefront, [], error?.message || "Storefront feed error.");
  }
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

  const copy = merchListingCopyForProduct(productRecord);

  const nextRow = {
    shopify_product_id: productRecord.shopify_product_id,
    position: 0,
    badge: overrides.badge || copy.badge || "NEW",
    product_type: productRecord.product_type || null,
    display_title:
      overrides.display_title ||
      productRecord.title ||
      productRecord.product_title ||
      copy.title ||
      "",
    display_subtitle:
      overrides.display_subtitle ||
      copy.subtitle ||
      productRecord.product_type ||
      "",
    family: copy.family || null,
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
      product_type: row.product_type || "tee",
      family:
        row.family ||
        productTypeFamily(row.product_type || "tee"),
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
