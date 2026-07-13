export function extractDesignDna(design) {
  const raw = design?.concept || {};
  const concept = raw.concept || raw;

  const colors =
    design?.color_palette?.length
      ? design.color_palette
      : Array.isArray(raw.colors)
        ? raw.colors
        : [];

  return {
    collection:
      concept.collection_name ||
      raw.collectionName ||
      "Unassigned",
    headline: concept.headline || "",
    productTitle:
      concept.product_title || design?.name || "",
    description:
      concept.product_description || "",
    seoTitle: concept.seo_title || "",
    metaDescription:
      concept.meta_description || "",
    tags: Array.isArray(concept.tags)
      ? concept.tags
      : [],
    retailPrice:
      Number(concept.retail_price || 0) || null,
    artDirection: concept.art_direction || "",
    imagePrompt:
      concept.back_image_prompt ||
      concept.image_prompt ||
      "",
    frontImagePrompt: concept.front_image_prompt || "",
    backImagePrompt: concept.back_image_prompt || "",
    audience:
      design?.target_audience ||
      raw.audience ||
      "Unspecified",
    style:
      design?.visual_style ||
      raw.style ||
      "Unspecified",
    mood: raw.mood || "Unspecified",
    placement:
      design?.placement ||
      raw.placement ||
      "Unspecified",
    palette: raw.palette || "custom",
    colors,
    theme:
      design?.theme ||
      raw.theme ||
      concept.collection_name ||
      "General",
    productType:
      design?.product_type ||
      raw.productType ||
      "Artwork"
  };
}

export function searchableText(design, dna) {
  return [
    design?.name,
    design?.prompt,
    design?.status,
    dna.collection,
    dna.headline,
    dna.productTitle,
    dna.description,
    dna.audience,
    dna.style,
    dna.mood,
    dna.placement,
    dna.theme,
    dna.productType,
    ...(dna.tags || []),
    ...(dna.colors || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
