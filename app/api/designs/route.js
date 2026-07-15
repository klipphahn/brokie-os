import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractDesignDna, searchableText } from "@/lib/design-dna";
import { getProductTypeTemplate } from "@/lib/product-types";

async function getSharp() {
  return (await import("sharp")).default;
}

function slugify(value) {
  return String(value || "brokie-design")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function normalizeProductType(productType) {
  const value = String(productType || "").toLowerCase();
  if (value.includes("zip hoodie") || value.includes("zip-up")) {
    return "hoodie";
  }
  if (value.includes("hoodie")) return "hoodie";
  if (value.includes("crewneck") || value.includes("sweatshirt")) {
    return "hoodie";
  }
  if (value.includes("hat") || value.includes("cap")) return "hat";
  if (value.includes("beanie")) return "hat";
  if (value.includes("sticker")) return "sticker";
  return "tee";
}

async function downloadImage(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to download artwork (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function createGarmentMockup(artwork, side, productType) {
  const sharp = await getSharp();
  const width = 1200;
  const height = 1400;
  const isFront = side === "front";
  const productKey = normalizeProductType(productType);
  const template = getProductTypeTemplate(productType);
  const silhouettes = {
    tee: `<path filter="url(#shadow)" fill="url(#shirt)" stroke="#343434" stroke-width="3"
        d="M395 205 L245 275 L78 470 L245 590 L335 485 L335 1240 Q600 1320 865 1240 L865 485 L955 590 L1122 470 L955 275 L805 205 Q745 250 600 250 Q455 250 395 205 Z"/>
       ${isFront
         ? '<path d="M500 215 Q600 330 700 215" fill="#111" stroke="#3a3a3a" stroke-width="12"/>'
         : '<path d="M505 220 Q600 285 695 220" fill="none" stroke="#3a3a3a" stroke-width="10"/>'}`,
    hoodie: `<path filter="url(#shadow)" fill="url(#shirt)" stroke="#343434" stroke-width="3"
        d="M410 245 Q455 110 600 95 Q745 110 790 245 L960 300 L1120 560 L930 670 L850 515 L850 1250 Q600 1325 350 1250 L350 515 L270 670 L80 560 L240 300 Z"/>
       <path d="M455 250 Q600 390 745 250 Q700 155 600 145 Q500 155 455 250" fill="#111" stroke="#3a3a3a" stroke-width="10"/>`,
    hat: `<path filter="url(#shadow)" fill="url(#shirt)" stroke="#343434" stroke-width="3"
        d="M300 510 Q355 280 600 250 Q845 280 900 510 Q910 620 825 670 L825 690 Q825 760 770 790 L430 790 Q375 760 375 690 L375 670 Q290 620 300 510 Z"/>
       <path d="M390 520 Q600 430 810 520 Q765 600 600 600 Q435 600 390 520 Z" fill="#111" stroke="#3a3a3a" stroke-width="10"/>`,
    sticker: `<rect x="245" y="320" width="710" height="760" rx="80" fill="url(#shirt)" stroke="#343434" stroke-width="3" stroke-dasharray="28 18"/>
       <rect x="305" y="380" width="590" height="640" rx="50" fill="none" stroke="#3a3a3a" stroke-width="8" stroke-dasharray="18 16"/>`
  };

  const silhouette = silhouettes[productKey] || silhouettes.tee;

  const garment = Buffer.from(`
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
      ${silhouette}
    </svg>`);

  const target =
    template.mockup?.[side] ||
    (productKey === "hat"
      ? isFront
        ? { width: 260, height: 180 }
        : { width: 300, height: 180 }
      : productKey === "sticker"
        ? { width: 360, height: 360 }
        : isFront
          ? { width: 210, height: 210 }
          : { width: 560, height: 650 });
  const art = await sharp(artwork)
    .ensureAlpha()
    .resize(target.width, target.height, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(art).metadata();
  const left =
    productKey === "hat" || productKey === "sticker"
      ? Math.round((width - (meta.width || target.width)) / 2)
      : isFront
        ? Math.round(690 - (meta.width || target.width) / 2)
        : Math.round((width - (meta.width || target.width)) / 2);
  const top =
    productKey === "hat"
      ? 470
      : productKey === "sticker"
        ? 360
        : productKey === "hoodie"
        ? isFront
          ? 470
          : 430
        : isFront
          ? 430
          : 380;

  return sharp(garment)
    .composite([{ input: art, left, top }])
    .png()
    .toBuffer();
}

async function repairLegacyDesigns(supabase) {
  const { data: designs, error } = await supabase
    .from("designs")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const template = (designs || []).find(
    (design) =>
      design.front_artwork_url &&
      design.back_artwork_url &&
      /phantom keep building/i.test(design.name || "")
  ) || (designs || []).find(
    (design) => design.front_artwork_url && design.back_artwork_url
  );

  if (!template?.front_artwork_url) {
    throw new Error("A paired design is required as the chest-logo template.");
  }

  const chestLogo = await downloadImage(template.front_artwork_url);
  const legacy = (designs || []).filter((design) => {
    const mockups = design.concept?.mockups || design.design_dna?.mockups || {};
    return !design.back_artwork_url || !mockups.front || !mockups.back;
  });

  const repaired = [];
  const failures = [];

  for (const design of legacy) {
    try {
      const originalArtwork =
        design.back_artwork_url ||
        design.front_artwork_url ||
        design.thumbnail_url;
      if (!originalArtwork) throw new Error("No original artwork was found.");

      const backArtwork = await downloadImage(originalArtwork);
      const [frontMockup, backMockup] = await Promise.all([
        createGarmentMockup(chestLogo, "front", design.product_type),
        createGarmentMockup(backArtwork, "back", design.product_type)
      ]);
      const stem = `repairs/${Date.now()}-${slugify(design.name)}`;

      async function upload(suffix, bytes) {
        const path = `${stem}-${suffix}.png`;
        const uploaded = await supabase.storage
          .from("artwork")
          .upload(path, bytes, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: false
          });
        if (uploaded.error) throw uploaded.error;
        return supabase.storage.from("artwork").getPublicUrl(path).data.publicUrl;
      }

      const [frontMockupUrl, backMockupUrl] = await Promise.all([
        upload("front-mockup", frontMockup),
        upload("back-mockup", backMockup)
      ]);
      const concept = {
        ...(design.concept || {}),
        mockups: { front: frontMockupUrl, back: backMockupUrl },
        legacyRepair: {
          repairedAt: new Date().toISOString(),
          chestLogoSource: template.id,
          originalArtwork
        }
      };
      const designDna = {
        ...(design.design_dna || {}),
        mockups: { front: frontMockupUrl, back: backMockupUrl }
      };
      const productType = ["Artwork", "Apparel", ""].includes(
        design.product_type || ""
      )
        ? "Heavyweight Tee"
        : design.product_type;

      const updated = await supabase
        .from("designs")
        .update({
          front_artwork_url: template.front_artwork_url,
          back_artwork_url: originalArtwork,
          thumbnail_url: backMockupUrl,
          product_type: productType,
          concept,
          design_dna: designDna,
          updated_at: new Date().toISOString()
        })
        .eq("id", design.id)
        .select("id,name")
        .single();
      if (updated.error) throw updated.error;
      repaired.push(updated.data);
    } catch (repairError) {
      failures.push({ id: design.id, name: design.name, error: repairError.message });
    }
  }

  await activity(
    supabase,
    "legacy_design_repair",
    `Repaired ${repaired.length} legacy designs`,
    "Added a shared chest logo plus paired front/back garment mockups.",
    failures.length ? "warning" : "success",
    { repaired, failures }
  );

  return { repaired, failures, template: template.name };
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

async function activity(
  supabase,
  action,
  title,
  detail,
  status = "success",
  metadata = {}
) {
  await supabase.from("activity_logs").insert({
    action,
    title,
    detail,
    status,
    metadata
  });
}

async function hydrateDesigns(supabase, designs) {
  if (!designs.length) return [];

  const ids = designs.map((design) => design.id);

  const [productsResult, metricsResult, versionsResult] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id,design_id,status,shopify_product_id,shopify_admin_url,online_store_url,online_store_published,printful_status,retail_price"
        )
        .in("design_id", ids),
      supabase
        .from("design_metrics")
        .select("*")
        .in("design_id", ids),
      supabase
        .from("design_versions")
        .select(
          "id,design_id,version_number,name,prompt,artwork_url,thumbnail_url,design_dna,change_note,created_at"
        )
        .in("design_id", ids)
        .order("version_number", { ascending: false })
    ]);

  if (productsResult.error) throw productsResult.error;
  if (metricsResult.error) throw metricsResult.error;
  if (versionsResult.error) throw versionsResult.error;

  const products = Object.fromEntries(
    (productsResult.data || []).map((product) => [
      product.design_id,
      product
    ])
  );

  const metrics = Object.fromEntries(
    (metricsResult.data || []).map((metric) => [
      metric.design_id,
      metric
    ])
  );

  const versions = {};
  for (const version of versionsResult.data || []) {
    versions[version.design_id] ||= [];
    versions[version.design_id].push(version);
  }

  return designs.map((design) => {
    const dna = extractDesignDna(design);

    return {
      ...design,
      resolved_dna: {
        ...dna,
        ...(design.design_dna || {})
      },
      product: products[design.id] || null,
      metrics: metrics[design.id] || {
        views: 0,
        clicks: 0,
        orders: 0,
        units_sold: 0,
        revenue: 0,
        profit: 0,
        returns: 0
      },
      versions: versions[design.id] || []
    };
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const search = (url.searchParams.get("q") || "")
      .trim()
      .toLowerCase();
    const favorite =
      url.searchParams.get("favorite") === "true";
    const archived =
      url.searchParams.get("archived") === "true";
    const status = url.searchParams.get("status") || "";
    const productType =
      url.searchParams.get("productType") || "";
    const audience =
      url.searchParams.get("audience") || "";
    const style = url.searchParams.get("style") || "";
    const theme = url.searchParams.get("theme") || "";

    const supabase = client();

    let query = supabase
      .from("designs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);

    if (favorite) query = query.eq("favorite", true);

    if (archived) {
      query = query.not("archived_at", "is", null);
    } else {
      query = query.is("archived_at", null);
    }

    if (status) query = query.eq("status", status);
    if (productType) {
      query = query.eq("product_type", productType);
    }
    if (audience) {
      query = query.eq("target_audience", audience);
    }
    if (style) query = query.eq("visual_style", style);
    if (theme) query = query.eq("theme", theme);

    const { data, error } = await query;
    if (error) throw error;

    let designs = await hydrateDesigns(
      supabase,
      data || []
    );

    if (search) {
      designs = designs.filter((design) =>
        searchableText(
          design,
          design.resolved_dna
        ).includes(search)
      );
    }

    const facets = {
      statuses: [
        ...new Set(
          designs
            .map((item) => item.status)
            .filter(Boolean)
        )
      ].sort(),
      productTypes: [
        ...new Set(
          designs
            .map(
              (item) =>
                item.product_type ||
                item.resolved_dna.productType
            )
            .filter(Boolean)
        )
      ].sort(),
      audiences: [
        ...new Set(
          designs
            .map(
              (item) =>
                item.target_audience ||
                item.resolved_dna.audience
            )
            .filter(Boolean)
        )
      ].sort(),
      styles: [
        ...new Set(
          designs
            .map(
              (item) =>
                item.visual_style ||
                item.resolved_dna.style
            )
            .filter(Boolean)
        )
      ].sort(),
      themes: [
        ...new Set(
          designs
            .map(
              (item) =>
                item.theme ||
                item.resolved_dna.theme
            )
            .filter(Boolean)
        )
      ].sort()
    };

    return NextResponse.json({
      ok: true,
      designs,
      facets
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = String(body.id || "");

    if (!id) throw new Error("Design id is required.");

    const supabase = client();
    const updates = {
      updated_at: new Date().toISOString()
    };

    const allowed = [
      "favorite",
      "status",
      "name",
      "prompt",
      "theme",
      "target_audience",
      "visual_style",
      "placement",
      "color_palette",
      "design_dna"
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    const { data, error } = await supabase
      .from("designs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await activity(
      supabase,
      "design_updated",
      `Updated ${data.name}`,
      "Design DNA or status was updated.",
      "success",
      { designId: id, updates: Object.keys(updates) }
    );

    return NextResponse.json({
      ok: true,
      design: data
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const id = String(body.id || "");
    const supabase = client();

    if (action === "repair_legacy_batch") {
      const result = await repairLegacyDesigns(supabase);
      return NextResponse.json({
        ok: true,
        message: `Repaired ${result.repaired.length} legacy designs.`,
        ...result
      });
    }

    if (!id) throw new Error("Design id is required.");

    const { data: original, error: originalError } =
      await supabase
        .from("designs")
        .select("*")
        .eq("id", id)
        .single();

    if (originalError) throw originalError;

    if (action === "duplicate") {
      const newName = `${original.name} Copy`;

      const duplicateValues = {
        name: newName,
        front_artwork_url:
          original.front_artwork_url,
        back_artwork_url:
          original.back_artwork_url,
        thumbnail_url: original.thumbnail_url,
        status: "generated",
        prompt: original.prompt,
        product_type: original.product_type,
        favorite: false,
        concept: original.concept,
        collection_id: original.collection_id,
        design_dna: original.design_dna || {},
        color_palette:
          original.color_palette || [],
        theme: original.theme,
        target_audience:
          original.target_audience,
        visual_style: original.visual_style,
        placement: original.placement,
        parent_design_id: original.id,
        current_version: 1
      };

      const { data: duplicate, error } =
        await supabase
          .from("designs")
          .insert(duplicateValues)
          .select()
          .single();

      if (error) throw error;

      await supabase.from("design_versions").insert({
        design_id: duplicate.id,
        version_number: 1,
        name: duplicate.name,
        prompt: duplicate.prompt,
        artwork_url:
          duplicate.front_artwork_url,
        thumbnail_url:
          duplicate.thumbnail_url,
        design_dna:
          duplicate.design_dna || {},
        change_note: `Duplicated from ${original.name}`
      });

      await supabase
        .from("design_metrics")
        .insert({ design_id: duplicate.id });

      await activity(
        supabase,
        "design_duplicated",
        `Duplicated ${original.name}`,
        `Created ${duplicate.name}.`,
        "success",
        {
          originalDesignId: original.id,
          duplicateDesignId: duplicate.id
        }
      );

      return NextResponse.json({
        ok: true,
        message: "Design duplicated.",
        design: duplicate
      });
    }

    if (action === "archive") {
      const archivedAt = new Date().toISOString();

      const { data, error } = await supabase
        .from("designs")
        .update({
          archived_at: archivedAt,
          status: "archived",
          updated_at: archivedAt
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await activity(
        supabase,
        "design_archived",
        `Archived ${data.name}`,
        "Design moved to the archive.",
        "success",
        { designId: id }
      );

      return NextResponse.json({
        ok: true,
        message: "Design archived.",
        design: data
      });
    }

    if (action === "restore") {
      const { data, error } = await supabase
        .from("designs")
        .update({
          archived_at: null,
          status: "generated",
          updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        message: "Design restored.",
        design: data
      });
    }

    if (action === "new_version") {
      const { data: latest } = await supabase
        .from("design_versions")
        .select("version_number")
        .eq("design_id", id)
        .order("version_number", {
          ascending: false
        })
        .limit(1)
        .maybeSingle();

      const nextVersion =
        Number(latest?.version_number || 0) + 1;

      const versionValues = {
        design_id: id,
        version_number: nextVersion,
        name:
          String(body.name || original.name).trim(),
        prompt:
          String(
            body.prompt ?? original.prompt ?? ""
          ),
        artwork_url:
          String(
            body.artworkUrl ||
              original.front_artwork_url ||
              ""
          ),
        thumbnail_url:
          String(
            body.thumbnailUrl ||
              original.thumbnail_url ||
              ""
          ),
        design_dna:
          body.designDna ||
          original.design_dna ||
          {},
        change_note:
          String(
            body.changeNote ||
              `Saved version ${nextVersion}`
          )
      };

      const { data: version, error } =
        await supabase
          .from("design_versions")
          .insert(versionValues)
          .select()
          .single();

      if (error) throw error;

      const { data: updated, error: updateError } =
        await supabase
          .from("designs")
          .update({
            name: version.name,
            prompt: version.prompt,
            front_artwork_url:
              version.artwork_url,
            thumbnail_url:
              version.thumbnail_url,
            design_dna:
              version.design_dna,
            current_version: nextVersion,
            updated_at: new Date().toISOString()
          })
          .eq("id", id)
          .select()
          .single();

      if (updateError) throw updateError;

      await activity(
        supabase,
        "design_version",
        `Versioned ${updated.name}`,
        `Saved design version ${nextVersion}.`,
        "success",
        { designId: id, versionId: version.id }
      );

      return NextResponse.json({
        ok: true,
        message: `Version ${nextVersion} saved.`,
        design: updated,
        version
      });
    }

    throw new Error("Unknown design action.");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get(
      "id"
    );

    if (!id) throw new Error("Design id is required.");

    const supabase = client();

    const { data: design } = await supabase
      .from("designs")
      .select("name,front_artwork_url")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("designs")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await activity(
      supabase,
      "design_deleted",
      `Deleted ${design?.name || "design"}`,
      "Design record was permanently deleted.",
      "success",
      { designId: id }
    );

    return NextResponse.json({
      ok: true,
      deleted: id,
      artworkUrl:
        design?.front_artwork_url || null
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}
