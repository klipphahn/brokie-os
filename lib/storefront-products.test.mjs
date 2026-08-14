import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  merchListingCopyForProduct,
  resolveMerchFieldOverride
} from "./product-types.js";
import {
  normalizeShopifyCatalogProduct,
  orderShopifyStorefrontProducts
} from "./shopify-catalog.js";

describe("merchListingCopyForProduct", () => {
  it("recognizes a Printful embroidery product as a hat from its Shopify title", () => {
    const copy = merchListingCopyForProduct({
      productType: "EMBROIDERY",
      title: "Brokie Signature Embroidered Snapback",
      handle: "brokie-signature-embroidered-snapback"
    });

    assert.equal(copy.family, "headwear");
    assert.equal(copy.title, "Embroidered Hat");
    assert.equal(copy.badge, "HEADWEAR");
  });

  it("keeps the Together We Win product in the tee family", () => {
    const copy = merchListingCopyForProduct({
      productType: "T-SHIRT",
      title: "The Brokie Together We Win Tee"
    });

    assert.equal(copy.family, "apparel");
    assert.equal(copy.title, "Heavyweight Tee");
  });
});

describe("resolveMerchFieldOverride", () => {
  const liveHat = {
    productType: "EMBROIDERY",
    title: "Brokie Signature Embroidered Snapback",
    handle: "brokie-signature-embroidered-snapback"
  };

  it("drops the stale tee title generated for an embroidery product", () => {
    assert.equal(resolveMerchFieldOverride({
      value: "Heavyweight Tee",
      field: "title",
      storedProductType: "EMBROIDERY",
      liveProduct: liveHat
    }), null);
  });

  it("preserves a genuinely custom merchandising title", () => {
    assert.equal(resolveMerchFieldOverride({
      value: "Brokie Snapback",
      field: "title",
      storedProductType: "EMBROIDERY",
      liveProduct: liveHat
    }), "Brokie Snapback");
  });
});

describe("normalizeShopifyCatalogProduct", () => {
  it("keeps Shopify as the source of truth for customer-facing fields", () => {
    const result = normalizeShopifyCatalogProduct({
      id: "gid://shopify/Product/1",
      title: "The Brokie Together We Win Tee",
      handle: "together-we-win",
      status: "ACTIVE",
      productType: "T-SHIRT",
      updatedAt: "2026-08-03T12:00:00Z",
      onlineStoreUrl: "https://shop.thebrokie.com/products/together-we-win",
      priceRangeV2: {
        minVariantPrice: { amount: "34.00", currencyCode: "USD" },
        maxVariantPrice: { amount: "39.00", currencyCode: "USD" }
      },
      featuredMedia: {
        preview: { image: { url: "https://cdn.example/tee.jpg", altText: null } }
      }
    });

    assert.equal(result.title, "The Brokie Together We Win Tee");
    assert.equal(result.minPrice, "34.00");
    assert.equal(result.maxPrice, "39.00");
    assert.equal(result.imageAlt, "The Brokie Together We Win Tee");
  });
});

describe("orderShopifyStorefrontProducts", () => {
  it("adds new Shopify products first and preserves saved order for curated products", () => {
    const products = [
      { id: "new-hat", title: "New Hat" },
      { id: "saved-shirt", title: "Saved Shirt" },
      { id: "saved-hoodie", title: "Saved Hoodie" }
    ];
    const featured = [
      { shopify_product_id: "saved-hoodie" },
      { shopify_product_id: "saved-shirt" }
    ];

    assert.deepEqual(
      orderShopifyStorefrontProducts(products, featured).map((product) => product.id),
      ["new-hat", "saved-hoodie", "saved-shirt"]
    );
  });

  it("caps the automatic storefront feed", () => {
    const products = Array.from({ length: 10 }, (_, index) => ({
      id: `product-${index}`
    }));

    assert.equal(orderShopifyStorefrontProducts(products, [], 8).length, 8);
  });
});
