export const STOREFRONT_KEY = "primary";

export const DEFAULT_STOREFRONT_SETTINGS = {
  key: STOREFRONT_KEY,
  site_name: "the brokie",
  shop_domain: "shop.thebrokie.com",
  announcement_text: "FOUNDERS DROP 001 — BUILT FOR THE PEOPLE STILL BUILDING",
  hero_eyebrow: "THE BROKIE GOODS",
  hero_headline: "WE DON'T NEED MONEY TO BE DANGEROUS.",
  hero_subheadline:
    "Premium workwear and streetwear for builders, creators, and people earning what comes next.",
  primary_cta_label: "SHOP THE DROP",
  primary_cta_url: "/collections/the-brokie-featured",
  secondary_cta_label: "OUR STORY",
  secondary_cta_url: "https://thebrokie.com",
  manifesto_headline: "BROKE TODAY. BUILDING FOREVER.",
  manifesto_body:
    "We build. We sacrifice. We stay loyal. We keep showing up.",
  collection_title: "The Brokie Featured",
  collection_handle: "the-brokie-featured",
  collection_description:
    "The latest pieces selected by The Brokie. Built for the people still building.",
  palette: {
    background: "#080808",
    panel: "#151515",
    orange: "#ff4f00",
    gold: "#ffc107",
    text: "#ffffff",
    muted: "#9a9a9a"
  }
};

export function normalizeShopDomain(value) {
  return String(value || DEFAULT_STOREFRONT_SETTINGS.shop_domain)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function absoluteShopUrl(domain, path = "/") {
  const cleanDomain = normalizeShopDomain(domain);
  if (/^https?:\/\//i.test(String(path || ""))) return String(path);
  const cleanPath = String(path || "/").startsWith("/")
    ? String(path || "/")
    : `/${path}`;
  return `https://${cleanDomain}${cleanPath}`;
}

export function storefrontPublicSettings(row = {}) {
  const merged = { ...DEFAULT_STOREFRONT_SETTINGS, ...row };
  return {
    siteName: merged.site_name,
    shopDomain: normalizeShopDomain(merged.shop_domain),
    announcement: merged.announcement_text,
    hero: {
      eyebrow: merged.hero_eyebrow,
      headline: merged.hero_headline,
      subheadline: merged.hero_subheadline,
      primaryCta: {
        label: merged.primary_cta_label,
        url: absoluteShopUrl(merged.shop_domain, merged.primary_cta_url)
      },
      secondaryCta: {
        label: merged.secondary_cta_label,
        url: absoluteShopUrl(merged.shop_domain, merged.secondary_cta_url)
      }
    },
    manifesto: {
      headline: merged.manifesto_headline,
      body: merged.manifesto_body
    },
    collection: {
      title: merged.collection_title,
      handle: merged.collection_handle,
      description: merged.collection_description,
      url: absoluteShopUrl(
        merged.shop_domain,
        `/collections/${merged.collection_handle}`
      )
    },
    palette: merged.palette || DEFAULT_STOREFRONT_SETTINGS.palette,
    updatedAt: merged.updated_at || null
  };
}
