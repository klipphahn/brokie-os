import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  shopifyAdminProductUrl,
  shopifyGraphQL
} from "@/lib/shopify";
import {
  publishProductToOnlineStore,
  readShopifyProductState
} from "@/lib/shopify-publications";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }
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
    seoTitle:
      concept.seo_title || concept.product_title || design.name,
    metaDescription:
      concept.meta_description ||
      concept.product_description ||
      "",
    collectionName: concept.collection_name || "Foundry",
    artworkUrl:
      design.front_artwork_url || design.thumbnail_url,
    mockups: {
      front: raw.mockups?.front || null,
      back: raw.mockups?.back || design.thumbnail_url || null
    }
  };
}

async function logActivity(
  supabase,
  action,
  title,
  detail,
  status,
  metadata = {}
) {
  await supabase.from("activity_logs").insert({
    action,
    title,
    detail,
    status,
    metadata
  });
}

async function recordRun(
  supabase,
  productId,
  provider,
  step,
  status,
  response = null,
  errorMessage = null
) {
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
mutation CreateBrokieProduct(
  $product: ProductCreateInput!,
  $media: [CreateMediaInput!]
) {
  productCreate(product: $product, media: $media) {
    product {
      id
      title
      handle
      status
      onlineStoreUrl
      variants(first: 10) { nodes { id price } }
    }
    userErrors { field message }
  }
}`;

const UPDATE_PRODUCT = `
mutation UpdateBrokieProduct($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product {
      id
      title
      handle
      status
      onlineStoreUrl
    }
    userErrors { field message }
  }
}`;

const UPDATE_VARIANTS = `
mutation UpdateBrokieVariants(
  $productId: ID!,
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId,
    variants: $variants
  ) {
    productVariants { id price }
    userErrors { field message }
  }
}`;

const SET_APPAREL_VARIANTS = `
mutation SetBrokieApparelVariants(
  $identifier: ProductSetIdentifiers!,
  $input: ProductSetInput!
) {
  productSet(
    identifier: $identifier,
    input: $input,
    synchronous: true
  ) {
    product {
      id
      options(first: 5) {
        name
        position
        optionValues { name }
      }
      variants(first: 100) {
        nodes {
          id
          title
          price
          selectedOptions {
            name
            optionValue { name }
          }
        }
      }
    }
    userErrors { field message code }
  }
}`;

const DEFAULT_APPAREL_SIZES = [
  "S",
  "M",
  "L",
  "XL",
  "2XL",
  "3XL"
];

function ensureNoErrors(payload, key) {
  const errors = payload?.[key]?.userErrors || [];
  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join("; "));
  }
}

async function upsertProduct(supabase, design, review) {
  const existing = await supabase
    .from("products")
    .select("*")
    .eq("design_id", design.id)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const values = {
    design_id: design.id,
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

  if (!existing.data) {
    const inserted = await supabase
      .from("products")
      .insert({ ...values, status: "review" })
      .select()
      .single();
    if (inserted.error) throw inserted.error;
    return inserted.data;
  }

  const updated = await supabase
    .from("products")
    .update(values)
    .eq("id", existing.data.id)
    .select()
    .single();

  if (updated.error) throw updated.error;
  return updated.data;
}

async function createOrUpdateShopifyDraft(
  supabase,
  productRecord,
  review
) {
  if (productRecord.shopify_product_id) {
    const updateData = await shopifyGraphQL(UPDATE_PRODUCT, {
      product: {
        id: productRecord.shopify_product_id,
        title: review.title,
        descriptionHtml: review.description,
        productType: review.productType,
        tags: review.tags,
        status: "DRAFT",
        seo: {
          title: review.seoTitle,
          description: review.metaDescription
        }
      }
    });

    ensureNoErrors(updateData, "productUpdate");

    const saved = await supabase
      .from("products")
      .update({
        status: "shopify_draft",
        publish_error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", productRecord.id)
      .select()
      .single();

    if (saved.error) throw saved.error;

    await recordRun(
      supabase,
      productRecord.id,
      "shopify",
      "update_draft",
      "success",
      updateData
    );

    return saved.data;
  }

  const media = review.artworkUrl
    ? [
        {
          originalSource: review.artworkUrl,
          mediaContentType: "IMAGE",
          alt: review.title
        }
      ]
    : [];

  const createData = await shopifyGraphQL(CREATE_PRODUCT, {
    product: {
      title: review.title,
      descriptionHtml: review.description,
      productType: review.productType,
      vendor: "thebrokie",
      tags: review.tags,
      status: "DRAFT",
      seo: {
        title: review.seoTitle,
        description: review.metaDescription
      }
    },
    media
  });

  ensureNoErrors(createData, "productCreate");

  const shopifyProduct = createData.productCreate.product;
  const firstVariant = shopifyProduct.variants.nodes[0];

  if (firstVariant) {
    const variantData = await shopifyGraphQL(UPDATE_VARIANTS, {
      productId: shopifyProduct.id,
      variants: [
        {
          id: firstVariant.id,
          price: review.price.toFixed(2)
        }
      ]
    });
    ensureNoErrors(variantData, "productVariantsBulkUpdate");
  }

  const saved = await supabase
    .from("products")
    .update({
      shopify_product_id: shopifyProduct.id,
      shopify_handle: shopifyProduct.handle,
      shopify_admin_url: shopifyAdminProductUrl(shopifyProduct.id),
      status: "shopify_draft",
      publish_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", productRecord.id)
    .select()
    .single();

  if (saved.error) throw saved.error;

  await recordRun(
    supabase,
    productRecord.id,
    "shopify",
    "create_draft",
    "success",
    createData
  );

  return saved.data;
}

async function setShopifyApparelVariants(
  supabase,
  productRecord,
  review
) {
  if (!productRecord.shopify_product_id) {
    throw new Error("Create the Shopify draft first.");
  }

  const price = review.price.toFixed(2);
  const result = await shopifyGraphQL(SET_APPAREL_VARIANTS, {
    identifier: { id: productRecord.shopify_product_id },
    input: {
      productOptions: [
        {
          name: "Color",
          position: 1,
          values: [{ name: "Black" }]
        },
        {
          name: "Size",
          position: 2,
          values: DEFAULT_APPAREL_SIZES.map((size) => ({
            name: size
          }))
        }
      ],
      variants: DEFAULT_APPAREL_SIZES.map((size, index) => ({
        position: index + 1,
        price,
        optionValues: [
          { optionName: "Color", name: "Black" },
          { optionName: "Size", name: size }
        ]
      }))
    }
  });

  ensureNoErrors(result, "productSet");

  const variants = result.productSet?.product?.variants?.nodes || [];
  if (variants.length !== DEFAULT_APPAREL_SIZES.length) {
    throw new Error(
      `Shopify returned ${variants.length} variants; expected ${DEFAULT_APPAREL_SIZES.length}.`
    );
  }

  const updated = await supabase
    .from("products")
    .update({
      printful_status: "not_configured",
      printful_variant_count: 0,
      printful_synced_variant_count: 0,
      printful_verified_at: null,
      publish_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", productRecord.id)
    .select()
    .single();

  if (updated.error) throw updated.error;

  const staleLinks = await supabase
    .from("printful_variant_links")
    .delete()
    .eq("product_id", productRecord.id);

  if (staleLinks.error) throw staleLinks.error;

  await recordRun(
    supabase,
    productRecord.id,
    "shopify",
    "set_apparel_variants",
    "success",
    result
  );

  await logActivity(
    supabase,
    "shopify_variants",
    `Added sizes to ${review.title}`,
    `Black · ${DEFAULT_APPAREL_SIZES.join(", ")} · $${price}`,
    "success",
    {
      productId: productRecord.id,
      shopifyProductId: productRecord.shopify_product_id,
      sizes: DEFAULT_APPAREL_SIZES,
      color: "Black",
      price
    }
  );

  return {
    product: updated.data,
    variants
  };
}

async function launchProduct(supabase, productRecord, review) {
  if (!productRecord.shopify_product_id) {
    throw new Error("Create the Shopify draft first.");
  }

  if (
    productRecord.printful_status !== "configured" ||
    Number(productRecord.printful_variant_count || 0) < 1 ||
    Number(productRecord.printful_synced_variant_count || 0) !==
      Number(productRecord.printful_variant_count || 0)
  ) {
    throw new Error(
      "Printful fulfillment has not passed API verification. Open the Printful panel, configure the imported product, and verify every variant before launching."
    );
  }

  const activateData = await shopifyGraphQL(UPDATE_PRODUCT, {
    product: {
      id: productRecord.shopify_product_id,
      status: "ACTIVE"
    }
  });

  ensureNoErrors(activateData, "productUpdate");

  await recordRun(
    supabase,
    productRecord.id,
    "shopify",
    "activate",
    "success",
    activateData
  );

  const publicationResult = await publishProductToOnlineStore(
    productRecord.shopify_product_id
  );

  await recordRun(
    supabase,
    productRecord.id,
    "shopify",
    "publish_online_store",
    "success",
    publicationResult
  );

  const state = await readShopifyProductState(
    productRecord.shopify_product_id
  );

  const launchedAt = new Date().toISOString();

  const updated = await supabase
    .from("products")
    .update({
      status: "live",
      online_store_publication_id:
        publicationResult.publication.id,
      online_store_published:
        state.onlineStorePublished || Boolean(state.onlineStoreUrl),
      online_store_url: state.onlineStoreUrl || null,
      launched_at: launchedAt,
      publish_error: null,
      updated_at: launchedAt
    })
    .eq("id", productRecord.id)
    .select()
    .single();

  if (updated.error) throw updated.error;

  await supabase
    .from("designs")
    .update({
      status: "published",
      updated_at: launchedAt
    })
    .eq("id", productRecord.design_id);

  await logActivity(
    supabase,
    "store_launch",
    `Launched ${review.title}`,
    state.onlineStoreUrl
      ? `Published to the Online Store: ${state.onlineStoreUrl}`
      : "Published to the Online Store sales channel.",
    "success",
    {
      productId: productRecord.id,
      designId: productRecord.design_id,
      shopifyProductId: productRecord.shopify_product_id,
      publicationId: publicationResult.publication.id,
      onlineStoreUrl: state.onlineStoreUrl
    }
  );

  return updated.data;
}

export async function GET() {
  try {
    const supabase = db();

    const { data: designs, error } = await supabase
      .from("designs")
      .select("*")
      .in("status", [
        "generated",
        "approved",
        "ready",
        "published"
      ])
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const designIds = (designs || []).map((design) => design.id);
    let products = [];

    if (designIds.length) {
      const result = await supabase
        .from("products")
        .select("*")
        .in("design_id", designIds);

      if (result.error) throw result.error;
      products = result.data || [];
    }

    const productMap = Object.fromEntries(
      products.map((product) => [
        product.design_id,
        product
      ])
    );

    return NextResponse.json({
      ok: true,
      items: (designs || []).map((design) => ({
        design,
        concept: conceptFromDesign(design),
        product: productMap[design.id] || null
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
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
      .from("designs")
      .select("*")
      .eq("id", designId)
      .single();

    if (designError) throw designError;

    const defaults = conceptFromDesign(design);

    const review = {
      title: String(body.title || defaults.title).trim(),
      description: String(
        body.description ?? defaults.description
      ),
      productType: String(
        body.productType || defaults.productType
      ).trim(),
      price: Number(body.price || defaults.price),
      tags: Array.isArray(body.tags)
        ? body.tags.map(String)
        : defaults.tags,
      seoTitle: String(
        body.seoTitle || defaults.seoTitle
      ).trim(),
      metaDescription: String(
        body.metaDescription || defaults.metaDescription
      ).trim(),
      artworkUrl: defaults.artworkUrl
    };

    if (!review.title) throw new Error("Product title is required.");

    if (!Number.isFinite(review.price) || review.price <= 0) {
      throw new Error("A valid price is required.");
    }

    productRecord = await upsertProduct(
      supabase,
      design,
      review
    );

    if (action === "save_review") {
      await supabase
        .from("designs")
        .update({
          status: "approved",
          updated_at: new Date().toISOString()
        })
        .eq("id", designId);

      await logActivity(
        supabase,
        "publisher_review",
        `Approved ${review.title}`,
        "Product metadata approved for publishing.",
        "success",
        {
          designId,
          productId: productRecord.id
        }
      );

      return NextResponse.json({
        ok: true,
        message: "Review saved.",
        product: productRecord
      });
    }

    if (action === "create_shopify_draft") {
      productRecord = await createOrUpdateShopifyDraft(
        supabase,
        productRecord,
        review
      );

      await supabase
        .from("designs")
        .update({
          status: "ready",
          updated_at: new Date().toISOString()
        })
        .eq("id", designId);

      await logActivity(
        supabase,
        "shopify_draft",
        `Created Shopify draft: ${review.title}`,
        "Draft created. Printful fulfillment still needs configuration.",
        "success",
        {
          designId,
          productId: productRecord.id,
          shopifyProductId:
            productRecord.shopify_product_id
        }
      );

      return NextResponse.json({
        ok: true,
        message:
          "Shopify draft created without duplicating the product.",
        product: productRecord
      });
    }

    if (action === "mark_printful_configured") {
      throw new Error(
        "Manual Printful confirmation has been retired. Use the Printful Fulfillment Bridge to detect, configure, and verify the product."
      );
    }

    if (action === "set_apparel_variants") {
      const configured = await setShopifyApparelVariants(
        supabase,
        productRecord,
        review
      );

      return NextResponse.json({
        ok: true,
        message:
          "Added Black sizes S–3XL in Shopify. Printful must now import and configure all six variants.",
        product: configured.product,
        variants: configured.variants
      });
    }

    if (action === "launch_store") {
      productRecord = await launchProduct(
        supabase,
        productRecord,
        review
      );

      return NextResponse.json({
        ok: true,
        message: productRecord.online_store_url
          ? "Product is live on the Online Store."
          : "Product was published to the Online Store. Shopify may take a moment to return its storefront URL.",
        product: productRecord
      });
    }

    if (action === "refresh_store_state") {
      if (!productRecord.shopify_product_id) {
        throw new Error("Create the Shopify product first.");
      }

      const state = await readShopifyProductState(
        productRecord.shopify_product_id
      );

      const updated = await supabase
        .from("products")
        .update({
          online_store_published:
            state.onlineStorePublished ||
            Boolean(state.onlineStoreUrl),
          online_store_url: state.onlineStoreUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", productRecord.id)
        .select()
        .single();

      if (updated.error) throw updated.error;

      return NextResponse.json({
        ok: true,
        message: state.onlineStoreUrl
          ? "Storefront status refreshed."
          : "Shopify has not returned a storefront URL yet.",
        product: updated.data,
        state
      });
    }

    throw new Error("Unknown publisher action.");
  } catch (error) {
    if (productRecord?.id) {
      await supabase
        .from("products")
        .update({
          publish_error: error.message,
          updated_at: new Date().toISOString()
        })
        .eq("id", productRecord.id);

      await recordRun(
        supabase,
        productRecord.id,
        "publisher",
        "failed",
        "error",
        null,
        error.message
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : String(error)
      },
      { status: 400 }
    );
  }
}
