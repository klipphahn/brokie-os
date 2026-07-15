import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";
import { runAutomationCycle } from "@/lib/automation";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const [feed, { data: latestRun }, { data: activities }] = await Promise.all([
      loadStorefrontFeed(supabase),
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
    ]);

    return NextResponse.json({
      ok: true,
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
