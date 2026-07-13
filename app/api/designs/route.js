import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractDesignDna, searchableText } from "@/lib/design-dna";

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

    if (!id) throw new Error("Design id is required.");

    const supabase = client();

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
