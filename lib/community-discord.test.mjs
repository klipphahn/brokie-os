import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  announcementNeedsNewId,
  buildCommunityDiscordFeed,
  CommunityDiscordFeedSchema,
  CommunityDiscordInputSchema,
  communityInputToRow,
  deriveCommunityDrops,
  normalizePublicUrl,
  safeCommunityDiscordFeed
} from "./community-discord.js";

function validInput() {
  return {
    live: {
      verified: true,
      isLive: false,
      title: "  Friday stream\u0000  ",
      url: "https://thebrokie.com/live"
    },
    info: {
      roadmap: { text: "Next drop", url: null },
      events: { text: null, url: null },
      giveaway: { text: null, url: null },
      truck: { text: null, url: null },
      gear: { text: null, url: null }
    },
    links: { Shop: "https://shop.thebrokie.com/" },
    socials: { Discord: "https://discord.com/invite/example" },
    announcement: {
      enabled: true,
      text: "New community night",
      url: "https://thebrokie.com/community"
    }
  };
}

describe("community Discord validation", () => {
  it("normalizes bounded text and public URLs", () => {
    const result = CommunityDiscordInputSchema.parse(validInput());
    assert.equal(result.live.title, "Friday stream");
    assert.equal(result.live.url, "https://thebrokie.com/live");
    assert.equal(result.links.Shop, "https://shop.thebrokie.com/");
  });

  it("rejects credentials, local/private URLs, and unknown keys", () => {
    assert.equal(normalizePublicUrl("https://user:pass@example.com/path"), null);
    assert.equal(normalizePublicUrl("http://127.0.0.1/admin"), null);
    assert.equal(normalizePublicUrl("https://service.internal/status"), null);
    assert.equal(
      CommunityDiscordInputSchema.safeParse({
        ...validInput(),
        unexpected: true
      }).success,
      false
    );
  });

  it("rejects unverified active live state and unknown nested keys", () => {
    const input = validInput();
    input.live = {
      ...input.live,
      verified: false,
      isLive: true,
      extra: "not allowed"
    };
    assert.equal(CommunityDiscordInputSchema.safeParse(input).success, false);
  });
});
describe("community Discord fallback and derivation", () => {
  it("returns the exact safe fallback contract", () => {
    const fallback = safeCommunityDiscordFeed();
    assert.equal(CommunityDiscordFeedSchema.safeParse(fallback).success, true);
    assert.equal(fallback.sourceAvailable, false);
    assert.deepEqual(fallback.drops, []);
    assert.deepEqual(fallback.stats, { verified: false });
    assert.deepEqual(fallback.announcement, {
      enabled: false,
      id: null,
      text: null,
      url: null
    });
    assert.equal(fallback.live.isLive, false);
    assert.equal(fallback.info.events.verified, false);
  });

  it("derives only actually published products with primitive values", () => {
    const products = [
      {
        id: "drop-1",
        title: "Together We Win Tee",
        url: "https://shop.thebrokie.com/products/together-we-win",
        price: "34.00",
        image: "https://cdn.example.com/tee.png",
        onlineStorePublished: true
      },
      {
        id: "draft-1",
        title: "Draft",
        url: "https://shop.thebrokie.com/products/draft",
        price: 20,
        onlineStorePublished: false
      },
      {
        id: "unsafe",
        title: "Unsafe",
        url: "http://127.0.0.1/product",
        onlineStorePublished: true
      }
    ];
    assert.deepEqual(deriveCommunityDrops(products), [
      {
        id: "drop-1",
        title: "Together We Win Tee",
        url: "https://shop.thebrokie.com/products/together-we-win",
        price: 34,
        image: "https://cdn.example.com/tee.png"
      }
    ]);
  });

  it("builds verified sections and truthful merch stats from injected data", () => {
    const row = {
      singleton: true,
      updated_at: "2026-08-05T03:00:00.000Z",
      live_verified: false,
      live_is_live: false,
      roadmap_text: "Fall roadmap",
      official_links: {},
      official_socials: {},
      announcement_enabled: false,
      announcement_id: "",
      announcement_text: ""
    };
    const feed = buildCommunityDiscordFeed({
      row,
      storefrontAvailable: true,
      products: [
        {
          id: "one",
          title: "One",
          url: "https://shop.thebrokie.com/products/one",
          price: 25,
          image: null,
          onlineStorePublished: true
        }
      ]
    });
    assert.equal(feed.sourceAvailable, true);
    assert.equal(feed.info.roadmap.verified, true);
    assert.deepEqual(feed.stats, {
      verified: true,
      merchProducts: 1,
      activeDrops: 1
    });
  });
});

describe("community announcement identity", () => {
  const current = {
    announcement_enabled: true,
    announcement_id: "11111111-1111-4111-8111-111111111111",
    announcement_text: "New community night",
    announcement_url: "https://thebrokie.com/community"
  };

  it("retains the ID for an unchanged enabled announcement", () => {
    assert.equal(announcementNeedsNewId(validInput(), current), false);
    assert.equal(
      communityInputToRow(validInput(), { currentRow: current }).announcement_id,
      current.announcement_id
    );
  });

  it("requires a new server-provided ID only for changed enabled content", () => {
    const changed = validInput();
    changed.announcement.text = "Changed announcement";
    assert.equal(announcementNeedsNewId(changed, current), true);
    assert.equal(
      communityInputToRow(changed, {
        currentRow: current,
        announcementId: "22222222-2222-4222-8222-222222222222"
      }).announcement_id,
      "22222222-2222-4222-8222-222222222222"
    );
  });

  it("does not generate or publish an ID for disabled saves", () => {
    const disabled = validInput();
    disabled.announcement.enabled = false;
    assert.equal(announcementNeedsNewId(disabled, current), false);
    assert.equal(
      communityInputToRow(disabled, { currentRow: current }).announcement_id,
      ""
    );
  });
});

