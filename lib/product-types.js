const PRODUCT_BLUEPRINTS = [
  {
    key: "tee",
    label: "Heavyweight Tee",
    family: "apparel",
    blank: "Comfort Colors 1717"
  },
  {
    key: "hoodie",
    label: "Premium Hoodie",
    family: "apparel",
    blank: "Independent Trading Co. IND4000"
  },
  {
    key: "oversized-tee",
    label: "Oversized Tee",
    family: "apparel",
    blank: "Comfort Colors 1717"
  },
  {
    key: "crop-top",
    label: "Crop Top",
    family: "apparel",
    blank: "Women's Micro-Rib Tank Top | Bella Canvas 1012",
    mockup: {
      front: {
        width: 195,
        height: 175,
        left: 700,
        top: 430
      },
      back: {
        width: 520,
        height: 560,
        left: 350,
        top: 385
      }
    }
  },
  {
    key: "long-sleeve",
    label: "Long Sleeve Tee",
    family: "apparel",
    blank: "Comfort Colors 6014"
  },
  {
    key: "crewneck",
    label: "Premium Crewneck",
    family: "apparel",
    blank: "Unisex Premium Crew Neck Sweatshirt | Lane Seven LS14004"
  },
  {
    key: "zip-hoodie",
    label: "Zip Hoodie",
    family: "apparel",
    blank: "Unisex Fleece Zip Up Hoodie | Independent Trading Co. SS4500Z"
  },
  {
    key: "hat",
    label: "Embroidered Hat",
    family: "headwear",
    blank: "Closed-Back Trucker Cap | Flexfit 6511",
    printfulFrontFileType: "embroidery_front",
    printfulSides: ["front"],
    mockup: {
      front: {
        width: 320,
        height: 220,
        left: 435,
        top: 470
      },
      back: {
        width: 320,
        height: 220,
        left: 435,
        top: 470
      }
    }
  },
  {
    key: "sticker",
    label: "Sticker",
    family: "sticker",
    blank: "Die-Cut Stickers",
    printfulFrontFileType: "front",
    printfulSides: ["front"],
    mockup: {
      front: {
        width: 440,
        height: 440,
        left: 380,
        top: 360
      },
      back: {
        width: 440,
        height: 440,
        left: 380,
        top: 360
      }
    }
  }
];

const PRODUCT_TYPE_SYNONYMS = [
  ["women s crop tank", "crop-top"],
  ["womens crop tank", "crop-top"],
  ["crop tank", "crop-top"],
  ["crop top", "crop-top"],
  ["crop-top", "crop-top"],
  ["baby tee", "crop-top"],
  ["zip hoodie", "zip-hoodie"],
  ["zip-up hoodie", "zip-hoodie"],
  ["crew neck", "crewneck"],
  ["crewneck", "crewneck"],
  ["long sleeve", "long-sleeve"],
  ["long sleeve tee", "long-sleeve"],
  ["long-sleeve", "long-sleeve"],
  ["sweatshirt", "crewneck"],
  ["pullover hoodie", "hoodie"],
  ["hoodie", "hoodie"],
  ["beanie", "hat"],
  ["dad hat", "hat"],
  ["snapback", "hat"],
  ["trucker", "hat"],
  ["cap", "hat"],
  ["hat", "hat"],
  ["sticker", "sticker"],
  ["oversized tee", "oversized-tee"],
  ["oversized", "oversized-tee"],
  ["apparel", "tee"],
  ["shirt", "tee"],
  ["tee", "tee"]
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function blueprintForKey(key) {
  return PRODUCT_BLUEPRINTS.find((item) => item.key === key);
}

export function normalizeProductTypeKey(productType) {
  const normalized = normalizeText(productType);
  if (!normalized) return "tee";

  for (const [needle, key] of PRODUCT_TYPE_SYNONYMS) {
    if (normalized.includes(needle)) {
      return key;
    }
  }

  return "tee";
}

export function productTypeFamily(productType) {
  const key = normalizeProductTypeKey(productType);
  return blueprintForKey(key)?.family || "apparel";
}

export function defaultProductTypeLabel(productType) {
  const key = normalizeProductTypeKey(productType);
  return blueprintForKey(key)?.label || "Heavyweight Tee";
}

export function defaultPrintfulBlankForProductType(productType) {
  const key = normalizeProductTypeKey(productType);
  return blueprintForKey(key)?.blank || "Comfort Colors 1717";
}

export function getProductTypeBlueprint(productType) {
  const key = normalizeProductTypeKey(productType);
  return blueprintForKey(key) || blueprintForKey("tee");
}

export function getProductTypeTemplate(productType) {
  const blueprint = getProductTypeBlueprint(productType);
  const family = blueprint?.family || "apparel";

  return {
    ...blueprint,
    family,
    printfulSides: blueprint?.printfulSides || (
      family === "apparel" ? ["front", "back"] : ["front"]
    ),
    mockup: blueprint?.mockup || {
      front: {
        width: 210,
        height: 210,
        left: 690,
        top: 430
      },
      back: {
        width: 560,
        height: 650,
        left: 320,
        top: 380
      }
    }
  };
}

export function merchListingCopy(productType) {
  const key = normalizeProductTypeKey(productType);
  const family = productTypeFamily(productType);

  if (key === "hoodie") {
    return {
      family,
      title: "Premium Hoodie",
      subtitle: "Heavyweight fleece for cold mornings, late nights, and people still moving.",
      badge: "PREMIUM",
      previewLabel: "Hoodie preview",
      cardLabel: "The Brokie hoodie",
      familyLabel: "Cold weather layer",
      fitNote: "Built for extra warmth and all-day comfort.",
      story: "A premium layer for people who keep moving when it gets cold."
    };
  }

  if (key === "hat") {
    return {
      family,
      title: "Embroidered Hat",
      subtitle: "Structured cap with a clean front mark built for everyday wear.",
      badge: "HEADWEAR",
      previewLabel: "Hat preview",
      cardLabel: "The Brokie hat",
      familyLabel: "Everyday headwear",
      fitNote: "Simple, structured, and easy to wear on repeat.",
      story: "A clean cap for everyday fits, errands, and wherever the day goes."
    };
  }

  if (key === "sticker") {
    return {
      family,
      title: "Sticker",
      subtitle: "Die-cut sticker for laptops, phone cases, notebooks, and water bottles.",
      badge: "STICKER",
      previewLabel: "Sticker preview",
      cardLabel: "The Brokie sticker",
      familyLabel: "Small-format merch",
      fitNote: "Built to go wherever the brand needs to stick.",
      story: "A little piece of the brand that rides on your everyday gear."
    };
  }

  if (key === "long-sleeve") {
    return {
      family,
      title: "Long Sleeve Tee",
      subtitle: "Layer-ready tee with room for both front and back graphics.",
      badge: "APPAREL",
      previewLabel: "Long sleeve preview",
      cardLabel: "The Brokie long sleeve",
      familyLabel: "Layering piece",
      fitNote: "Works on its own or under a hoodie.",
      story: "A versatile staple for in-between weather and layered fits."
    };
  }

  if (key === "crewneck") {
    return {
      family,
      title: "Premium Crewneck",
      subtitle: "Soft fleece crewneck with room for bold back graphics.",
      badge: "PREMIUM",
      previewLabel: "Crewneck preview",
      cardLabel: "The Brokie crewneck",
      familyLabel: "Midweight fleece",
      fitNote: "Soft, structured, and ready for back graphics.",
      story: "A clean fleece layer with enough room for a loud back hit."
    };
  }

  if (key === "zip-hoodie") {
    return {
      family,
      title: "Zip Hoodie",
      subtitle: "Full-zip layer with clean front placement and strong back print.",
      badge: "PREMIUM",
      previewLabel: "Zip hoodie preview",
      cardLabel: "The Brokie zip hoodie",
      familyLabel: "Layering essential",
      fitNote: "Easy to throw on, easy to take off, easy to wear daily.",
      story: "A full-zip layer built for movement, utility, and repeat wear."
    };
  }

  if (key === "oversized-tee") {
    return {
      family,
      title: "Oversized Tee",
      subtitle: "Relaxed cut with a roomier fit and heavier streetwear feel.",
      badge: "OVERSIZED",
      previewLabel: "Oversized tee preview",
      cardLabel: "The Brokie oversized tee",
      familyLabel: "Relaxed streetwear",
      fitNote: "Roomy fit with a more fashion-forward drape.",
      story: "A bigger silhouette for people who want their gear to feel laid back."
    };
  }

  if (key === "crop-top") {
    return {
      family,
      title: "Crop Top",
      subtitle: "A shorter silhouette with a clean fit and bold back print.",
      badge: "CROP",
      previewLabel: "Crop top preview",
      cardLabel: "The Brokie crop top",
      familyLabel: "Streetwear cut",
      fitNote: "Shorter length with a fitted, fashion-forward feel.",
      story: "A sharper silhouette made for summer drops and layered fits."
    };
  }

  return {
    family,
    title: "Heavyweight Tee",
    subtitle: "Premium heavyweight tee with front chest and large back print.",
    badge: family === "apparel" ? "APPAREL" : "LIVE",
    previewLabel: "Tee preview",
    cardLabel: "The Brokie tee",
    familyLabel: "Core apparel",
    fitNote: "The everyday Brokie staple.",
    story: "A heavyweight base layer for the whole Brokie community."
  };
}

export function buildListingDefaults({
  productType,
  customTitle = "",
  collectionName = "The Brokie",
  theme = "Together we win."
} = {}) {
  const copy = merchListingCopy(productType);
  const title = String(customTitle || "").trim() || copy.title;
  const family = productTypeFamily(productType);
  const familyCopyMap = {
    apparel: {
      opener: "This is the kind of piece that makes an everyday fit feel unmistakably Brokie.",
      body: "Made for people betting on themselves, backing their circle, and defining success on their own terms.",
      tags: ["streetwear", "independent", "community", "the brokie"]
    },
    headwear: {
      opener: "A clean everyday cap with a low-key Brokie mark up front.",
      body: "Easy to throw on with everyday fits, weekend errands, and everything in between.",
      tags: ["hat", "cap", "headwear", "the brokie"]
    },
    sticker: {
      opener: "A small Brokie hit that goes wherever you do.",
      body: "Stick it on laptops, phone cases, notebooks, water bottles, and anywhere you want the brand to live.",
      tags: ["sticker", "decal", "collectible", "the brokie"]
    }
  };

  const familyCopy = familyCopyMap[family] || familyCopyMap.apparel;
  const tags = [
    ...new Set([
      ...(familyCopy.tags || []),
      "together we win",
      "brokie"
    ])
  ];

  return {
    title,
    description: `${familyCopy.opener} ${copy.subtitle} ${familyCopy.body} ${theme}`.trim(),
    seoTitle: `${title} | The Brokie`,
    metaDescription: `${title} from ${collectionName}. ${copy.subtitle} ${familyCopy.body}`.trim(),
    tags,
    badge: copy.badge,
    subtitle: copy.subtitle,
    cardLabel: copy.cardLabel,
    familyLabel: copy.familyLabel,
    fitNote: copy.fitNote,
    story: copy.story
  };
}

export function buildShopifyVariantPlan(
  productType,
  {
    colors = [],
    sizes = [],
    price = 39.99,
    defaultLabel = "Standard"
  } = {}
) {
  const family = productTypeFamily(productType);
  const priceText = Number(price || 0).toFixed(2);

  if (family === "headwear") {
    const selectedColors = [
      ...new Set(
        (Array.isArray(colors) ? colors : [])
          .map((value) => String(value).trim())
          .filter(Boolean)
      )
    ];
    const safeColors = selectedColors.length
      ? selectedColors
      : ["Black"];

    return {
      family,
      productOptions: [
        {
          name: "Color",
          position: 1,
          values: safeColors.map((name) => ({ name }))
        }
      ],
      variants: safeColors.map((color, index) => ({
        position: index + 1,
        price: priceText,
        inventoryPolicy: "CONTINUE",
        inventoryItem: { tracked: true },
        optionValues: [{ optionName: "Color", name: color }]
      }))
    };
  }

  if (family === "sticker") {
    return {
      family,
      productOptions: [
        {
          name: "Style",
          position: 1,
          values: [{ name: defaultLabel }]
        }
      ],
      variants: [
        {
          position: 1,
          price: priceText,
          inventoryPolicy: "CONTINUE",
          inventoryItem: { tracked: true },
          optionValues: [
            { optionName: "Style", name: defaultLabel }
          ]
        }
      ]
    };
  }

  const selectedColors = [
    ...new Set(
      (Array.isArray(colors) ? colors : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  ];
  const selectedSizes = [
    ...new Set(
      (Array.isArray(sizes) ? sizes : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  ];

  const safeColors = selectedColors.length
    ? selectedColors
    : ["Black"];
  const safeSizes = selectedSizes.length
    ? selectedSizes
    : ["M"];
  const combinations = safeColors.flatMap((color) =>
    safeSizes.map((size) => ({ color, size }))
  );

  return {
    family,
    productOptions: [
      {
        name: "Color",
        position: 1,
        values: safeColors.map((name) => ({ name }))
      },
      {
        name: "Size",
        position: 2,
        values: safeSizes.map((name) => ({ name }))
      }
    ],
    variants: combinations.map(({ color, size }, index) => ({
      position: index + 1,
      price: priceText,
      inventoryPolicy: "CONTINUE",
      inventoryItem: { tracked: true },
      optionValues: [
        { optionName: "Color", name: color },
        { optionName: "Size", name: size }
      ]
    }))
  };
}

export const productTypes = PRODUCT_BLUEPRINTS.map(
  (item) => item.label
);
