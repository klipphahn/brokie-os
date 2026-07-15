import { brandDna } from "@/lib/brand-dna";
import { merchListingCopy, productTypeFamily } from "@/lib/product-types";

const FAMILY_PRIORITY = ["apparel", "headwear", "sticker"];

const FAMILY_FOCUS = {
  apparel: {
    phrase: "Broke Today. Building Forever.",
    action: "Keep the heavyweight apparel lane moving first."
  },
  headwear: {
    phrase: "Built Different.",
    action: "Use the next hat or cap as the clean everyday accent."
  },
  sticker: {
    phrase: "Built To Last.",
    action: "Use stickers to spread the Brokie mark across daily gear."
  }
};

function cleanText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function familyLabelFor(key) {
  if (key === "headwear") return "Headwear";
  if (key === "sticker") return "Small-format merch";
  return "Core apparel";
}

function productTypeForFamily(family, products = []) {
  const match = (Array.isArray(products) ? products : []).find(
    (product) => productTypeFamily(product.productType || product.product_type) === family
  );
  return match?.productType || match?.product_type || null;
}

export function summarizeLaunchQueue(items = []) {
  const queue = Array.isArray(items) ? items : [];
  const ready = [];
  const blocked = [];
  const live = [];

  for (const item of queue) {
    const product = item?.product || {};
    const state = String(product.status || item?.design?.status || "").toLowerCase();
    const configured = Boolean(
      product.shopify_product_id && product.printful_status === "configured"
    );
    const isLive = state === "live" || state === "active";

    if (isLive) {
      live.push(item);
    } else if (configured) {
      ready.push(item);
    } else {
      blocked.push(item);
    }
  }

  return {
    total: queue.length,
    ready: ready.length,
    blocked: blocked.length,
    live: live.length,
    nextBlocked: blocked[0] || null
  };
}

export function buildBrandBrain({
  storefront = {},
  products = [],
  launchQueue = [],
  settings = {}
} = {}) {
  const queue = summarizeLaunchQueue(launchQueue);
  const familyCounts = new Map();
  const familyProducts = new Map();

  for (const item of Array.isArray(products) ? products : []) {
    const family = productTypeFamily(item.productType || item.product_type);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    if (!familyProducts.has(family)) {
      familyProducts.set(family, []);
    }
    familyProducts.get(family).push(item);
  }

  const orderedFamilies = [...familyCounts.entries()]
    .sort((left, right) => {
      const leftIndex = FAMILY_PRIORITY.indexOf(left[0]);
      const rightIndex = FAMILY_PRIORITY.indexOf(right[0]);
      if (leftIndex !== rightIndex) {
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      }
      return right[1] - left[1];
    })
    .map(([family]) => family);

  const primaryFamily = orderedFamilies[0] || FAMILY_PRIORITY[0];
  const nextFamily = queue.nextBlocked
    ? productTypeFamily(
        queue.nextBlocked.product?.productType || queue.nextBlocked.product?.product_type
      )
    : primaryFamily;
  const focusFamily = nextFamily || primaryFamily;
  const focusProductType = queue.nextBlocked?.product?.productType
    || queue.nextBlocked?.product?.product_type
    || productTypeForFamily(focusFamily, products)
    || "tee";
  const focusCopy = merchListingCopy(focusProductType);
  const familyFocus = FAMILY_FOCUS[focusFamily] || FAMILY_FOCUS.apparel;
  const productCount = Array.isArray(products) ? products.length : 0;
  const shopName = cleanText(
    storefront.siteName || settings.site_name || brandDna.name,
    "The Brokie"
  );

  const headline = queue.blocked > 0
    ? "Build the next ready piece first."
    : queue.ready > 0
      ? "Push the next ready drop live."
      : "Keep the brand moving forward.";

  const summary = queue.blocked > 0
    ? `${queue.blocked} launch item${queue.blocked === 1 ? "" : "s"} still need setup. ${familyFocus.action}`
    : queue.ready > 0
      ? `${queue.ready} item${queue.ready === 1 ? "" : "s"} are ready to ship. Keep the next ${focusCopy.familyLabel.toLowerCase()} lane warm.`
      : `The merch system is live with ${productCount} product${productCount === 1 ? "" : "s"}. ${brandDna.mission}`;

  const nextAction = queue.nextBlocked
    ? `Finish ${cleanText(queue.nextBlocked.product?.title || queue.nextBlocked.design?.name || focusCopy.title)} so it can move to Printful.`
    : queue.ready > 0
      ? `Publish the next ${focusCopy.familyLabel.toLowerCase()} item and keep the launch rolling.`
      : `Create the next ${focusCopy.familyLabel.toLowerCase()} drop and keep the queue full.`;

  const brandRule = queue.blocked > 0
    ? `${shopName} should surface the blocked item, the reason, and the next fix first.`
    : `Lead with the strongest ${focusCopy.familyLabel.toLowerCase()} piece, then keep the rest of the drop tight and consistent.`;

  return {
    headline,
    summary,
    northStar: brandDna.manifesto,
    shopName,
    focusFamily: {
      key: focusFamily,
      label: familyLabelFor(focusFamily),
      count: familyCounts.get(focusFamily) || 0
    },
    focusProductType,
    focusLabel: focusCopy.title,
    strongestPhrase: familyFocus.phrase,
    nextAction,
    brandRule,
    familyOrder: orderedFamilies.length ? orderedFamilies : FAMILY_PRIORITY,
    signals: {
      totalProducts: productCount,
      familyCounts: Object.fromEntries(familyCounts.entries())
    },
    launch: queue
  };
}
