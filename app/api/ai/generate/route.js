import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BRAND_RULES = `
Brand: The Brokie.
Mission: For the people still building.
Voice: confident, gritty, focused, loyal, self-aware; never corny or fake-luxury.
Visual language: premium streetwear, matte black, spray orange, crown yellow, distressed ink and restrained graffiti texture.
Approved ideas include: We Don't Need Money To Be Dangerous; Broke Today. Building Forever; Built Different; Backed By Loyalty.
Mascot: crowned spray-paint face with X eyes and a sad dripping mouth. Never make it happy and never add a nose.
Artwork must read clearly on apparel, avoid photorealistic garment mockups, and avoid tiny illegible text.
`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "collection_name",
    "concept_name",
    "headline",
    "product_title",
    "product_description",
    "seo_title",
    "meta_description",
    "tags",
    "retail_price",
    "art_direction",
    "front_art_direction",
    "back_art_direction",
    "front_image_prompt",
    "back_image_prompt"
  ],
  properties: {
    collection_name: { type: "string" },
    concept_name: { type: "string" },
    headline: { type: "string" },
    product_title: { type: "string" },
    product_description: { type: "string" },
    seo_title: { type: "string" },
    meta_description: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 10
    },
    retail_price: { type: "number", minimum: 20, maximum: 150 },
    art_direction: { type: "string" },
    front_art_direction: { type: "string" },
    back_art_direction: { type: "string" },
    front_image_prompt: { type: "string" },
    back_image_prompt: { type: "string" }
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

async function createConcept(apiKey, direction, variationIndex, priorNames) {
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.4-mini";
  const uniqueness = priorNames.length
    ? `Do not repeat these previous concepts: ${priorNames.join(", ")}.`
    : "";

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
          content: [
            {
              type: "input_text",
              text: `${BRAND_RULES}
Create one commercially usable merch concept.
Design it as a coordinated two-sided garment. The front must be a restrained
left-chest mark. The back must be the primary graphic and may use the exact
headline. The two sides must share symbols, texture, palette, and visual DNA.
This is variation ${variationIndex + 1}. It must feel meaningfully different from the other variations.
${uniqueness}`
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Product type: ${direction.productType}
Audience: ${direction.audience}
Visual style: ${direction.style}
Mood: ${direction.mood}
Print placement: ${direction.placement}
Approved colors: ${direction.colors.join(", ")}
Creative direction: ${direction.prompt}
`
            }
          ]
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

  if (!response.ok) {
    throw new Error(
      payload?.error?.message || "OpenAI concept generation failed."
    );
  }

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

  const response = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

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
    const brightest = Math.max(
      data[index],
      data[index + 1],
      data[index + 2]
    );

    if (brightest <= 24) {
      data[index + 3] = 0;
    } else if (brightest < 72) {
      data[index + 3] = Math.round(
        ((brightest - 24) / 48) * data[index + 3]
      );
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

async function createArtwork(apiKey, concept, direction, side) {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const isFront = side === "front";
  const sideDirection = isFront
    ? concept.front_art_direction
    : concept.back_art_direction;
  const sidePrompt = isFront
    ? concept.front_image_prompt
    : concept.back_image_prompt;
  const commonPrompt = `${BRAND_RULES}
Create print-ready apparel artwork only—not a shirt mockup or presentation sheet.
Product: ${direction.productType}
Audience: ${direction.audience}
Visual style: ${direction.style}
Mood: ${direction.mood}
Placement intent: ${direction.placement}
Approved palette: ${direction.colors.join(", ")}
Garment side: ${isFront ? "FRONT LEFT-CHEST PRINT" : "BACK LARGE PRINT"}
Concept headline: ${concept.headline}
Overall art direction: ${concept.art_direction}
Side-specific direction: ${sideDirection}
Detailed request: ${sidePrompt}
${isFront
  ? "Create a compact emblem suitable for a 3.5 inch left-chest print. Do not create the large back composition on this side."
  : "Create the main large back graphic. Use the headline exactly if text is requested. Do not add a garment, model, room, or product mockup."}
Center the isolated artwork with generous clear space. Keep wording exact and minimal. High contrast and screen-print friendly.`;

  let { response, payload } = await requestImage(
    apiKey,
    model,
    `${commonPrompt}\nThe canvas outside the artwork must be transparent.`,
    true
  );

  if (response.ok) {
    const base64 = payload?.data?.[0]?.b64_json;
    if (!base64) throw new Error("OpenAI returned no image data.");
    return { base64, transparencyMode: "native" };
  }

  const firstError =
    payload?.error?.message || "OpenAI artwork generation failed.";

  const transparencyUnsupported =
    /transparent|background.*not supported|not supported.*background/i.test(
      firstError
    );

  if (!transparencyUnsupported) throw new Error(firstError);

  ({ response, payload } = await requestImage(
    apiKey,
    model,
    `${commonPrompt}
Use a perfectly uniform solid #000000 background with no texture, lighting,
shadow, vignette, gradient, border, or objects outside the artwork.
Do not use black inside the foreground artwork.`,
    false
  ));

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        "OpenAI fallback artwork generation failed."
    );
  }

  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) throw new Error("OpenAI returned no fallback image data.");

  const transparentPng = await removeBlackBackground(base64);

  return {
    base64: transparentPng.toString("base64"),
    transparencyMode: "black-key fallback"
  };
}

async function createShirtMockup(artworkBase64, side) {
  const width = 1200;
  const height = 1400;
  const isFront = side === "front";
  const shirt = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#242424"/>
          <stop offset="0.5" stop-color="#080808"/>
          <stop offset="1" stop-color="#191919"/>
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="30" stdDeviation="28" flood-color="#000" flood-opacity=".55"/>
        </filter>
      </defs>
      <rect width="1200" height="1400" fill="#111111"/>
      <path filter="url(#shadow)" fill="url(#shirt)" stroke="#343434" stroke-width="3"
        d="M395 205 L245 275 L78 470 L245 590 L335 485 L335 1240 Q600 1320 865 1240 L865 485 L955 590 L1122 470 L955 275 L805 205 Q745 250 600 250 Q455 250 395 205 Z"/>
      ${isFront
        ? '<path d="M500 215 Q600 330 700 215" fill="#111" stroke="#3a3a3a" stroke-width="12"/>'
        : '<path d="M505 220 Q600 285 695 220" fill="none" stroke="#3a3a3a" stroke-width="10"/>'}
    </svg>`);

  const artSize = isFront
    ? { width: 210, height: 210 }
    : { width: 560, height: 650 };
  const art = await sharp(Buffer.from(artworkBase64, "base64"))
    .resize(artSize.width, artSize.height, {
      fit: "inside",
      withoutEnlargement: false
    })
    .png()
    .toBuffer();
  const meta = await sharp(art).metadata();
  const left = isFront
    ? Math.round(690 - (meta.width || artSize.width) / 2)
    : Math.round((width - (meta.width || artSize.width)) / 2);
  const top = isFront ? 430 : 380;

  return sharp(shirt)
    .composite([{ input: art, left, top }])
    .png()
    .toBuffer();
}

async function saveArtwork(assets, concept, direction, variationIndex) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return { saved: false, urls: {} };

  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  });

  const stem = `ai/${Date.now()}-${variationIndex + 1}-${slugify(
    concept.concept_name
  )}`;

  async function upload(name, bytes) {
    const path = `${stem}-${name}.png`;
    const { error } = await supabase.storage
      .from("artwork")
      .upload(path, bytes, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });
    if (error) throw error;
    const { data } = supabase.storage.from("artwork").getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  }

  const [frontArtwork, backArtwork, frontMockup, backMockup] =
    await Promise.all([
      upload("front-print", Buffer.from(assets.front.base64, "base64")),
      upload("back-print", Buffer.from(assets.back.base64, "base64")),
      upload("front-mockup", assets.frontMockup),
      upload("back-mockup", assets.backMockup)
    ]);

  const urls = {
    frontArtwork: frontArtwork.publicUrl,
    backArtwork: backArtwork.publicUrl,
    frontMockup: frontMockup.publicUrl,
    backMockup: backMockup.publicUrl
  };

  const metadata = {
    ...direction,
    variationIndex,
    concept,
    mockups: {
      front: urls.frontMockup,
      back: urls.backMockup
    }
  };

  const { data: insertedDesign, error: insertError } =
    await supabase
      .from("designs")
      .insert({
        name: concept.concept_name,
        front_artwork_url: urls.frontArtwork,
        back_artwork_url: urls.backArtwork,
        thumbnail_url: urls.backMockup,
        status: "generated",
        prompt: direction.prompt,
        product_type: direction.productType,
        concept: metadata,
        design_dna: metadata,
        color_palette: direction.colors || [],
        theme: concept.collection_name || direction.mood,
        target_audience: direction.audience,
        visual_style: direction.style,
        placement: direction.placement,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .single();

  if (insertError) {
    console.warn(
      "Artwork uploaded but design record was not inserted:",
      insertError.message
    );
  }

  await supabase.from("activity_logs").insert({
    action: "ai_generation",
    title: `Generated ${concept.concept_name}`,
    detail: `${direction.productType} · ${direction.audience} · variation ${
      variationIndex + 1
    }`,
    status: "success",
    metadata: { ...urls, ...metadata }
  });

  return {
    saved: true,
    urls,
    paths: {
      frontArtwork: frontArtwork.path,
      backArtwork: backArtwork.path,
      frontMockup: frontMockup.path,
      backMockup: backMockup.path
    },
    designId: insertedDesign?.id || null
  };
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "OPENAI_API_KEY is missing from the server environment."
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const direction = {
      prompt: String(body.prompt || "").trim(),
      productType: String(body.productType || "Heavyweight Tee").trim(),
      audience: String(body.audience || "Blue-collar builders").trim(),
      style: String(body.style || "Premium graffiti").trim(),
      mood: String(body.mood || "Relentless").trim(),
      placement: String(
        body.placement || "Small left chest + large back"
      ).trim(),
      palette: String(body.palette || "brokie-core").trim(),
      colors: Array.isArray(body.colors)
        ? body.colors.slice(0, 6).map(String)
        : ["#080808", "#FF4F00", "#FFC107", "#FFFFFF"]
    };

    const variations = Math.min(
      4,
      Math.max(1, Number(body.variations || 1))
    );

    if (direction.prompt.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          error: "Describe the idea in at least 10 characters."
        },
        { status: 400 }
      );
    }

    const results = [];
    const priorNames = [];

    for (let index = 0; index < variations; index += 1) {
      const concept = await createConcept(
        apiKey,
        direction,
        index,
        priorNames
      );

      priorNames.push(concept.concept_name);

      const [front, back] = await Promise.all([
        createArtwork(apiKey, concept, direction, "front"),
        createArtwork(apiKey, concept, direction, "back")
      ]);
      const [frontMockup, backMockup] = await Promise.all([
        createShirtMockup(front.base64, "front"),
        createShirtMockup(back.base64, "back")
      ]);
      const saved = await saveArtwork(
        { front, back, frontMockup, backMockup },
        concept,
        direction,
        index
      );

      const frontMockupDataUrl = `data:image/png;base64,${frontMockup.toString("base64")}`;
      const backMockupDataUrl = `data:image/png;base64,${backMockup.toString("base64")}`;

      results.push({
        concept,
        artwork: {
          front: {
            dataUrl: `data:image/png;base64,${front.base64}`,
            publicUrl: saved.urls?.frontArtwork || null,
            transparencyMode: front.transparencyMode
          },
          back: {
            dataUrl: `data:image/png;base64,${back.base64}`,
            publicUrl: saved.urls?.backArtwork || null,
            transparencyMode: back.transparencyMode
          }
        },
        mockups: {
          front: {
            dataUrl: frontMockupDataUrl,
            publicUrl: saved.urls?.frontMockup || null
          },
          back: {
            dataUrl: backMockupDataUrl,
            publicUrl: saved.urls?.backMockup || null
          }
        },
        // Backwards-compatible primary image for older Factory clients.
        image: {
          dataUrl: backMockupDataUrl,
          publicUrl: saved.urls?.backArtwork || null,
          savedToSupabase: saved.saved,
          designId: saved.designId,
          transparencyMode: back.transparencyMode
        }
      });
    }

    return NextResponse.json({
      ok: true,
      direction,
      variationCount: results.length,
      results
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
