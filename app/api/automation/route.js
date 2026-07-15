import { NextResponse } from "next/server";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";
import {
  buildApprovalPlan,
  buildBusinessAutopilot,
  runAutomationCycle
} from "@/lib/automation";

export async function GET() {
  try {
    const supabase = tryCreateSupabaseAdminClient();
    const feed = await loadStorefrontFeed(supabase);

    const [latestRunResult, activitiesResult] = supabase
      ? await Promise.all([
          supabase
            .from("analytics_sync_runs")
            .select("*")
            .eq("provider", "shopify")
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(8)
        ])
      : [{ data: null }, { data: [] }];
    const { data: latestRun } = latestRunResult;
    const { data: activities } = activitiesResult;

    return NextResponse.json({
      ok: true,
      approval: buildApprovalPlan({
        feed,
        launch: feed.launch,
        brain: feed.brain
      }),
      autopilot: buildBusinessAutopilot({
        feed,
        launch: feed.launch,
        brain: feed.brain
      }),
      automation: {
        lastSync: latestRun || null,
        readyCount: feed.launch?.ready || 0,
        blockedCount: feed.launch?.blocked || 0,
        liveCount: feed.launch?.live || 0
      },
      storefront: feed.storefront,
      products: feed.products,
      brain: feed.brain,
      launch: feed.launch,
      activities: activities || []
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Automation status unavailable." },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!body.approved) {
      const supabase = tryCreateSupabaseAdminClient();
      const feed = await loadStorefrontFeed(supabase);
      return NextResponse.json({
        ok: true,
        approved: false,
        approval: buildApprovalPlan({
          feed,
          launch: feed.launch,
          brain: feed.brain
        }),
        autopilot: buildBusinessAutopilot({
          feed,
          launch: feed.launch,
          brain: feed.brain
        }),
        message:
          "Review the major approvals and send the request again with approval enabled."
      });
    }
    const payload = await runAutomationCycle({
      full: Boolean(body.full)
    });

    return NextResponse.json(payload, {
      status: payload.ok ? 200 : 400
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || "Automation failed." },
      { status: 400 }
    );
  }
}
