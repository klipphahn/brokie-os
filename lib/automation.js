import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";
import { POST as syncAnalyticsRoute } from "@/app/api/analytics/route";
import { POST as syncCollectionRoute } from "@/app/api/storefront/collection/route";

function makeJsonRequest(pathname, body = {}) {
  return new Request(`https://brokie.local${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function readResponsePayload(response, fallbackError) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || fallbackError);
  }
  return payload;
}

function stepResult(step, status, detail, extra = {}) {
  return {
    step,
    status,
    detail,
    ...extra
  };
}

function buildWeeklyReport({ feed, steps }) {
  const products = Array.isArray(feed?.products) ? feed.products : [];
  const brain = feed?.brain || {};
  const launch = feed?.launch || {};
  const currentDrop = products[0] || null;
  const successCount = steps.filter((step) => step.status === "success").length;
  const failureCount = steps.filter((step) => step.status === "error").length;

  const highlights = [
    currentDrop?.title ? `Current drop: ${currentDrop.title}` : null,
    brain?.summary ? brain.summary : null,
    launch?.ready !== undefined ? `${launch.ready || 0} ready / ${launch.blocked || 0} blocked` : null
  ].filter(Boolean);

  const nextActions = [];
  if (launch?.nextBlocked?.product?.title) {
    nextActions.push(`Unblock ${launch.nextBlocked.product.title} next.`);
  }
  if ((launch?.ready || 0) > 0) {
    nextActions.push("Push the next ready item live when review is complete.");
  } else {
    nextActions.push("Generate or configure the next product lane.");
  }
  if ((products || []).length < 3) {
    nextActions.push("Seed more merch so the storefront has a stronger assortment.");
  }

  return {
    title: "Weekly Brokie OS report",
    status: failureCount ? "warning" : "success",
    summary: `Weekly pass completed with ${successCount} successful step${successCount === 1 ? "" : "s"} and ${failureCount} issue${failureCount === 1 ? "" : "s"}.`,
    highlights,
    nextActions,
    currentDrop: currentDrop
      ? {
          id: currentDrop.id || null,
          title: currentDrop.title || null,
          status: currentDrop.status || null,
          printfulStatus: currentDrop.printful_status || null
        }
      : null,
    launch: {
      total: launch.total || 0,
      ready: launch.ready || 0,
      blocked: launch.blocked || 0,
      live: launch.live || 0
    }
  };
}

export async function runAutomationCycle({ full = false } = {}) {
  const supabase = tryCreateSupabaseAdminClient();
  const steps = [];
  let weeklyReport = null;

  try {
    const analyticsResponse = await syncAnalyticsRoute(
      makeJsonRequest("/api/analytics", { full })
    );
    const analytics = await readResponsePayload(
      analyticsResponse,
      "Sales sync failed."
    );

    steps.push(
      stepResult(
        "analytics",
        "success",
        analytics.message || "Sales sync completed."
      )
    );
  } catch (error) {
    steps.push(stepResult("analytics", "error", error.message));
  }

  try {
    const merchResponse = await syncCollectionRoute();
    const merch = await readResponsePayload(
      merchResponse,
      "Merch sync failed."
    );

    steps.push(
      stepResult(
        "merch",
        "success",
        `Collection synced: ${merch.changes?.added || 0} added, ${merch.changes?.removed || 0} removed.`,
        {
          changes: merch.changes || null,
          storefrontUrl: merch.storefrontUrl || null
        }
      )
    );
  } catch (error) {
    steps.push(stepResult("merch", "error", error.message));
  }

  let feed = null;

  try {
    feed = await loadStorefrontFeed(supabase);
    steps.push(
      stepResult(
        "feed",
        "success",
        `Storefront feed refreshed with ${feed.products.length} merch item${feed.products.length === 1 ? "" : "s"}.`
      )
    );
  } catch (error) {
    steps.push(stepResult("feed", "error", error.message));
  }

  const failures = steps.filter((step) => step.status === "error");
  const successes = steps.filter((step) => step.status === "success");
  const message = failures.length
    ? `Automation completed with ${successes.length} success${successes.length === 1 ? "" : "es"} and ${failures.length} issue${failures.length === 1 ? "" : "s"}.`
    : `Automation completed: ${successes.length} step${successes.length === 1 ? "" : "s"} finished.`;

  if (supabase) {
    try {
      await supabase.from("activity_logs").insert({
        action: "automation_cycle",
        title: failures.length ? "Automation cycle finished with issues" : "Automation cycle completed",
        detail: message,
        status: failures.length ? "warning" : "success",
        metadata: {
          full,
          steps
        }
      });
    } catch {
      // Activity logs are helpful, but they should never block automation.
    }
  }

  if (full) {
    weeklyReport = buildWeeklyReport({ feed, steps });
    if (supabase) {
      try {
        await supabase.from("activity_logs").insert({
          action: "weekly_automation_report",
          title: weeklyReport.title,
          detail: weeklyReport.summary,
          status: weeklyReport.status,
          metadata: weeklyReport
        });
      } catch {
        // Weekly reporting should not block the automation cycle.
      }
    }
  }

  return {
    ok: successes.length > 0,
    message,
    steps,
    warnings: failures.map((step) => step.detail),
    report: weeklyReport,
    storefront: feed?.storefront || null,
    products: feed?.products || [],
    brain: feed?.brain || null,
    launch: feed?.launch || null
  };
}
