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
    key: "long-sleeve",
    label: "Long Sleeve Tee",
    family: "apparel",
    blank: "Comfort Colors 6014"
  },
  {
    key: "crewneck",
    label: "Premium Crewneck",
    family: "apparel",
    blank: "Independent Trading Co. IND4000"
  },
  {
    key: "zip-hoodie",
    label: "Zip Hoodie",
    family: "apparel",
    blank: "Independent Trading Co. IND4000"
  },
  {
    key: "hat",
    label: "Embroidered Hat",
    family: "headwear",
    blank: "Closed-Back Trucker Cap | Flexfit 6511",
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
    blank: "Sticker",
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
