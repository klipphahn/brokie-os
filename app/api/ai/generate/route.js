import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BRAND_RULES = `
Brand: The Brokie.
Mission: For the people still building.
Voice: confident, gritty, focused, loyal, self-aware; never corny or fake-luxury.
Visual language: premium streetwear, matte black, spray orange, crown yellow, distressed ink and restrained graffiti texture.
Approved ideas include: We Don't Need Money To Be Dangerous; Broke Today. Building Forever; Built Different; Backed By Loyalty.
Mascot: crowned spray-paint face with X eyes and a sad dripping mouth. Do not turn it into a happy face and do not add a nose.
Artwork must read clearly on apparel, avoid photorealistic garment mockups, and avoid tiny illegible text.
`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "collection_name", "concept_name", "headline", "product_title",
    "product_description", "seo_title", "meta_description", "tags",
    "retail_price", "art_direction", "image_prompt"
  ],
  properties: {
    collection_name: { type: "string" },
    concept_name: { type: "string" },
    headline: { type: "string" },
    product_title: { type: "string" },
    product_description: { type: "string" },
    seo_title: { type: "string" },
    meta_description: { type: "string" },
    tags: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 10 },
    retail_price: { type: "number", minimum: 20, maximum: 150 },
    art_direction: { type: "string" },
    image_prompt: { type: "string" }
  }
};

function extractOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const parts = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function slugify(value) {
  return String(value || "brokie-design")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function createConcept(apiKey, prompt, productType) {
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: `${BRAND_RULES}\nReturn one commercially usable merch concept.` }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: `Product type: ${productType}. User direction: ${prompt}` }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "brokie_merch_concept",
          strict: true,
          schema
        }
      }
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI concept generation failed.");
  const text = extractOutputText(payload);
  if (!text) throw new Error("OpenAI returned no concept text.");
  return JSON.parse(text);
}

async function requestImage(apiKey, model, prompt, nativeTransparency) {
  const body = {
    model,
    prompt,
    size: "1024x1024",
    quality: "medium",
    output_format: "png"
  };

  if (nativeTransparency) body.background = "transparent";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = await response.json();
  return { response, payload };
}

async function removeBlackBackground(base64) {
  const input = Buffer.from(base64, "base64");
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const brightest = Math.max(red, green, blue);

    // Pure and near-black pixels become transparent. The soft transition
    // keeps distressed spray edges from developing a visible black halo.
    if (brightest <= 24) {
      data[index + 3] = 0;
    } else if (brightest < 72) {
      data[index + 3] = Math.round(((brightest - 24) / 48) * data[index + 3]);
    }
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .png()
    .toBuffer();
}

async function createArtwork(apiKey, concept) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const commonPrompt = `${BRAND_RULES}\n
Create print-ready apparel artwork only—not a shirt mockup and not a brand guideline sheet.
Concept headline: ${concept.headline}
Art direction: ${concept.art_direction}
Detailed request: ${concept.image_prompt}
Center the art with generous clear space. Keep wording exact and minimal. High contrast and screen-print friendly.`;

  // Prefer true alpha output when the selected model supports it.
  const nativePrompt = `${commonPrompt}\nThe canvas outside the artwork must be transparent.`;
  let { response, payload } = await requestImage(apiKey, model, nativePrompt, true);

  if (response.ok) {
    const base64 = payload?.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI returned no image data.");
    return { base64, transparencyMode: "native" };
  }

  const firstError = payload?.error?.message || "OpenAI artwork generation failed.";
  const transparencyUnsupported = /transparent|background.*not supported|not supported.*background/i.test(firstError);

  if (!transparencyUnsupported) throw new Error(firstError);

  // Fallback for models without native transparency: generate against exact
  // black, then turn black pixels into alpha locally before storage/preview.
  const fallbackPrompt = `${commonPrompt}\nUse a perfectly uniform solid #000000 black background with no texture, lighting, shadow, vignette, gradient, border, or objects outside the artwork. Do not use black inside the foreground artwork.`;
  ({ response, payload } = await requestImage(apiKey, model, fallbackPrompt, false));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI fallback artwork generation failed.");
  }

  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no fallback image data.");

  const transparentPng = await removeBlackBackground(base64);
  return {
    base64: transparentPng.toString("base64"),
    transparencyMode: "black-key fallback"
  };
}

async function saveArtwork(base64, concept, originalPrompt) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { publicUrl: null, saved: false };

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const filename = `ai/${Date.now()}-${slugify(concept.concept_name)}.png`;
  const bytes = Buffer.from(base64, "base64");

  const { error: uploadError } = await supabase.storage
    .from("artwork")
    .upload(filename, bytes, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("artwork").getPublicUrl(filename);
  const publicUrl = data.publicUrl;

  const { error: insertError } = await supabase.from("designs").insert({
    name: concept.concept_name,
    front_artwork_url: publicUrl,
    thumbnail_url: publicUrl,
    status: "generated"
  });

  if (insertError) {
    console.warn("Artwork uploaded but design record was not inserted:", insertError.message);
  }

  return { publicUrl, saved: true, path: filename, prompt: originalPrompt };
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY is missing from the server environment." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const productType = String(body.productType || "Heavyweight Tee").trim();

    if (prompt.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Describe the idea in at least 10 characters." },
        { status: 400 }
      );
    }

    const concept = await createConcept(apiKey, prompt, productType);
    const artwork = await createArtwork(apiKey, concept);
    const saved = await saveArtwork(artwork.base64, concept, prompt);

    return NextResponse.json({
      ok: true,
      concept,
      image: {
        dataUrl: `data:image/png;base64,${artwork.base64}`,
        publicUrl: saved.publicUrl,
        savedToSupabase: saved.saved,
        transparencyMode: artwork.transparencyMode
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
