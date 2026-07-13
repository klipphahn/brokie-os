import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ANGLES = [
  "discipline over excuses",
  "overtime and sacrifice",
  "trade pride and brotherhood",
  "power, voltage, and current",
  "built from nothing",
  "loyalty over luxury",
  "dangerous without money",
  "early mornings and late nights",
  "earned not given",
  "blue-collar fatherhood",
  "union strength",
  "jobsite humor",
  "quiet confidence",
  "relentless consistency",
  "work ethic as identity",
  "legacy for the next generation",
  "grit under pressure",
  "skill over status",
  "the people still building",
  "never clocked out mentally",
  "scarred hands and clean work",
  "broke today building forever",
  "high voltage attitude",
  "crew loyalty",
  "no shortcuts"
];

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server credentials are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

function slugify(value) {
  return String(value || "collection")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

function uniqueAngles(count, theme) {
  const themeAngle = String(theme || "").trim();
  return Array.from({ length: count }, (_, index) => {
    const angle = ANGLES[index % ANGLES.length];
    const cycle = Math.floor(index / ANGLES.length) + 1;
    return cycle === 1
      ? angle
      : `${angle}, alternate direction ${cycle}, explicitly avoid repeating previous compositions`;
  }).map((angle, index) =>
    index === 0 && themeAngle
      ? `${themeAngle} anchored in ${angle}`
      : angle
  );
}

async function hydrateRun(supabase, runId) {
  const { data: run, error } = await supabase
    .from("factory_runs")
    .select("*, collections(id,name,slug,status)")
    .eq("id", runId)
    .single();

  if (error) throw error;

  const { data: jobs, error: jobsError } = await supabase
    .from("factory_jobs")
    .select("*")
    .eq("run_id", runId)
    .order("sequence_number", { ascending: true });

  if (jobsError) throw jobsError;

  return { ...run, jobs: jobs || [] };
}

export async function GET(request) {
  try {
    const supabase = db();
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");

    if (runId) {
      return NextResponse.json({
        ok: true,
        run: await hydrateRun(supabase, runId)
      });
    }

    const { data, error } = await supabase
      .from("factory_runs")
      .select("*, collections(id,name,slug,status)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      runs: data || []
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  const supabase = db();

  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "create_run") {
      const count = Math.min(
        25,
        Math.max(1, Number(body.count || 5))
      );

      const name = String(
        body.name || `${body.theme || "Brokie"} Collection`
      ).trim();

      const slugBase = slugify(name);
      const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

      const { data: collection, error: collectionError } =
        await supabase
          .from("collections")
          .insert({
            name,
            slug,
            description: String(body.basePrompt || ""),
            status: "draft"
          })
          .select()
          .single();

      if (collectionError) throw collectionError;

      const runValues = {
        collection_id: collection.id,
        name,
        theme: String(body.theme || "Union electricians"),
        audience: String(body.audience || "Union electricians"),
        product_type: String(body.productType || "Heavyweight Tee"),
        visual_style: String(body.style || "Premium graffiti"),
        mood: String(body.mood || "Relentless"),
        placement: String(
          body.placement || "Small left chest + large back"
        ),
        palette: String(body.palette || "brokie-core"),
        colors: Array.isArray(body.colors)
          ? body.colors.slice(0, 6).map(String)
          : ["#080808", "#FF4F00", "#FFC107", "#FFFFFF"],
        base_prompt: String(body.basePrompt || "").trim(),
        requested_count: count,
        estimated_image_requests: count * 2,
        auto_publish: Boolean(body.autoPublish),
        status: "queued"
      };

      if (runValues.base_prompt.length < 10) {
        throw new Error(
          "Describe the collection in at least 10 characters."
        );
      }

      const { data: run, error: runError } = await supabase
        .from("factory_runs")
        .insert(runValues)
        .select()
        .single();

      if (runError) throw runError;

      const angles = uniqueAngles(count, runValues.theme);

      const jobs = angles.map((angle, index) => ({
        run_id: run.id,
        sequence_number: index + 1,
        creative_angle: angle,
        prompt: `${runValues.base_prompt}

Collection theme: ${runValues.theme}
Unique creative angle for this design: ${angle}
This design is number ${index + 1} of ${count}.
Make it visually and verbally distinct from all other designs in this collection.
Do not reuse the same headline, central symbol, layout, or slogan structure.`,
        status: "queued"
      }));

      const { error: jobsError } = await supabase
        .from("factory_jobs")
        .insert(jobs);

      if (jobsError) throw jobsError;

      await supabase.from("activity_logs").insert({
        action: "factory_created",
        title: `Created Design Factory run: ${name}`,
        detail: `${count} designs queued for ${runValues.audience}.`,
        status: "success",
        metadata: {
          runId: run.id,
          collectionId: collection.id,
          count
        }
      });

      return NextResponse.json({
        ok: true,
        message: `${count} designs queued.`,
        run: await hydrateRun(supabase, run.id)
      });
    }

    const runId = String(body.runId || "");
    if (!runId) throw new Error("Run id is required.");

    if (action === "claim_next") {
      const { data: run, error: runError } = await supabase
        .from("factory_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (runError) throw runError;

      if (["paused", "cancelled", "completed"].includes(run.status)) {
        return NextResponse.json({
          ok: true,
          job: null,
          run: await hydrateRun(supabase, runId)
        });
      }

      const { data: job, error: jobError } = await supabase
        .from("factory_jobs")
        .select("*")
        .eq("run_id", runId)
        .in("status", ["queued", "retry"])
        .order("sequence_number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (jobError) throw jobError;

      if (!job) {
        const { data: failedJobs } = await supabase
          .from("factory_jobs")
          .select("id")
          .eq("run_id", runId)
          .eq("status", "failed");

        const finalStatus =
          failedJobs?.length ? "needs_attention" : "completed";

        const now = new Date().toISOString();

        await supabase
          .from("factory_runs")
          .update({
            status: finalStatus,
            finished_at: now,
            updated_at: now
          })
          .eq("id", runId);

        return NextResponse.json({
          ok: true,
          job: null,
          run: await hydrateRun(supabase, runId)
        });
      }

      const now = new Date().toISOString();

      const { data: claimed, error: claimError } =
        await supabase
          .from("factory_jobs")
          .update({
            status: "generating",
            attempts: Number(job.attempts || 0) + 1,
            started_at: now,
            error_message: null,
            updated_at: now
          })
          .eq("id", job.id)
          .select()
          .single();

      if (claimError) throw claimError;

      await supabase
        .from("factory_runs")
        .update({
          status: "running",
          started_at: run.started_at || now,
          updated_at: now
        })
        .eq("id", runId);

      return NextResponse.json({
        ok: true,
        job: claimed,
        run
      });
    }

    if (action === "complete_job") {
      const jobId = String(body.jobId || "");
      if (!jobId) throw new Error("Job id is required.");

      const now = new Date().toISOString();

      const { data: job, error: jobError } = await supabase
        .from("factory_jobs")
        .update({
          status: "completed",
          design_id: body.designId || null,
          concept_name: body.conceptName || null,
          artwork_url: body.artworkUrl || null,
          finished_at: now,
          updated_at: now
        })
        .eq("id", jobId)
        .select()
        .single();

      if (jobError) throw jobError;

      if (body.designId) {
        await supabase
          .from("designs")
          .update({
            collection_id: body.collectionId || null,
            factory_run_id: runId,
            factory_job_id: jobId,
            updated_at: now
          })
          .eq("id", body.designId);
      }

      const { count: completedCount } = await supabase
        .from("factory_jobs")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("status", "completed");

      const { count: failedCount } = await supabase
        .from("factory_jobs")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("status", "failed");

      await supabase
        .from("factory_runs")
        .update({
          completed_count: completedCount || 0,
          failed_count: failedCount || 0,
          updated_at: now
        })
        .eq("id", runId);

      return NextResponse.json({
        ok: true,
        job,
        run: await hydrateRun(supabase, runId)
      });
    }

    if (action === "fail_job") {
      const jobId = String(body.jobId || "");
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("factory_jobs")
        .update({
          status: "failed",
          error_message: String(body.error || "Generation failed."),
          finished_at: now,
          updated_at: now
        })
        .eq("id", jobId);

      if (error) throw error;

      const { count: failedCount } = await supabase
        .from("factory_jobs")
        .select("*", { count: "exact", head: true })
        .eq("run_id", runId)
        .eq("status", "failed");

      await supabase
        .from("factory_runs")
        .update({
          failed_count: failedCount || 0,
          status: "needs_attention",
          updated_at: now
        })
        .eq("id", runId);

      return NextResponse.json({
        ok: true,
        run: await hydrateRun(supabase, runId)
      });
    }

    if (action === "pause" || action === "resume" || action === "cancel") {
      const status =
        action === "pause"
          ? "paused"
          : action === "resume"
            ? "queued"
            : "cancelled";

      const now = new Date().toISOString();

      const { error } = await supabase
        .from("factory_runs")
        .update({
          status,
          finished_at: action === "cancel" ? now : null,
          updated_at: now
        })
        .eq("id", runId);

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        run: await hydrateRun(supabase, runId)
      });
    }

    if (action === "retry_failed") {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("factory_jobs")
        .update({
          status: "retry",
          error_message: null,
          updated_at: now
        })
        .eq("run_id", runId)
        .eq("status", "failed");

      if (error) throw error;

      await supabase
        .from("factory_runs")
        .update({
          status: "queued",
          failed_count: 0,
          finished_at: null,
          updated_at: now
        })
        .eq("id", runId);

      return NextResponse.json({
        ok: true,
        run: await hydrateRun(supabase, runId)
      });
    }

    throw new Error("Unknown Design Factory action.");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }
}
