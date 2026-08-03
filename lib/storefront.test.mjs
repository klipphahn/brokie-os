import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storefrontPublicSettings } from "./storefront.js";

describe("storefrontPublicSettings", () => {
  it("sends customer-facing shop links to Shopify's automatically updated catalog", () => {
    const settings = storefrontPublicSettings({
      shop_domain: "shop.thebrokie.com",
      collection_handle: "the-brokie-featured",
      primary_cta_url: "/collections/the-brokie-featured"
    });

    assert.equal(
      settings.hero.primaryCta.url,
      "https://shop.thebrokie.com/collections/all"
    );
    assert.equal(
      settings.collection.url,
      "https://shop.thebrokie.com/collections/all"
    );
    assert.equal(
      settings.collection.managedUrl,
      "https://shop.thebrokie.com/collections/the-brokie-featured"
    );
  });

  it("preserves an explicitly customized primary call-to-action", () => {
    const settings = storefrontPublicSettings({
      shop_domain: "shop.thebrokie.com",
      primary_cta_url: "/pages/story"
    });

    assert.equal(
      settings.hero.primaryCta.url,
      "https://shop.thebrokie.com/pages/story"
    );
  });
});
