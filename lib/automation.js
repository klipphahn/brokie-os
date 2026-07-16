import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";
import { POST as syncAnalyticsRoute } from "@/app/api/analytics/route";
import { POST as syncCollectionRoute } from "@/app/api/storefront/collection/route";
import {
  loadGuardrailOverview,
  refreshConfiguredProfitability
} from "@/lib/profit-guardrails-server";

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

export function buildApprovalPlan({
  feed,
  launch,
  brain,
  guardrails
} = {}) {
  const products = Array.isArray(feed?.products) ? feed.products : [];
  const queue = launch || feed?.launch || {};
  const currentDrop = products[0] || null;
  const blockedTitle =
    queue?.nextBlocked?.product?.title ||
    currentDrop?.title ||
    "the current drop";

  const actions = [];

  if ((guardrails?.pendingApprovalCount || 0) > 0) {
    actions.push({
      id: "price_approvals",
      label: `Approve ${guardrails.pendingApprovalCount} price change${guardrails.pendingApprovalCount === 1 ? "" : "s"}`,
      status: "needs_attention",
      detail:
        "These products need a major pricing decision before Brokie OS changes Shopify or Printful."
    });
  }

  if ((guardrails?.blockedCount || 0) > 0) {
    actions.push({
      id: "margin_blocked",
      label: `${guardrails.blockedCount} launch${guardrails.blockedCount === 1 ? " is" : "es are"} below the margin floor`,
      status: "needs_attention",
      detail:
        "Brokie OS will keep these products out of the store until cost or pricing is fixed."
    });
  }

  if (queue?.blocked > 0) {
    actions.unshift({
      id: "weekly_pass",
      label: "Approve the weekly pass",
      status: "needs_attention",
      detail: `The next pass will refresh analytics, merch, and the storefront after you clear ${blockedTitle}.`
    });
  } else if (queue?.ready > 0) {
    actions.unshift({
      id: "launch_ready",
      label: "Approve the next launch",
      status: "ready",
      detail: `One or more items are ready to move live once you approve the launch.`
    });
  } else {
    actions.unshift({
      id: "build_queue",
      label: "Approve the next merch direction",
      status: "ready",
      detail:
        brain?.nextAction ||
        "Create or approve the next product lane so the queue keeps moving."
    });
  }

  actions.push({
    id: "featured_merch",
    label: "Approve the featured merch set",
    status: products.length ? "ready" : "needs_attention",
    detail: products.length
      ? `The storefront currently has ${products.length} featured item${products.length === 1 ? "" : "s"}; approve this lineup to keep it live.`
      : "Choose at least one featured Shopify product so the merch page can stay live."
  });

  actions.push({
    id: "weekly_refresh",
    label: "Approve the weekly refresh",
    status: "ready",
    detail: "When you approve, Brokie OS will run sales sync, merch sync, and feed refresh together."
  });

  const readyCount = actions.filter((item) => item.status === "ready").length;
  const attentionCount = actions.length - readyCount;

  return {
    title: "Approval queue",
    summary:
      attentionCount > 0
        ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need your eye before the next automatic pass.`
        : `Everything is lined up for the next automatic pass. `,
    actions,
    readyCount,
    attentionCount,
    approveLabel: "Approve & run"
  };
}

export function buildBusinessAutopilot({
  feed,
  launch,
  brain,
  guardrails
} = {}) {
  const products = Array.isArray(feed?.products) ? feed.products : [];
  const queue = launch || feed?.launch || {};
  const currentDrop = products[0] || null;
  const nextMove =
    queue?.nextBlocked?.product?.title ||
    currentDrop?.title ||
    brain?.nextAction ||
    "Create the next drop and keep the queue moving.";

  return {
    title: "Business autopilot",
    summary:
      "Brokie OS can handle the background loops automatically and only stop for major approvals.",
    nextMove: {
      label: "Next move",
      detail: nextMove
    },
    alwaysOn: [
      {
        label: "Profit guardrails",
        detail: `Keep every launch above the ${Number(
          guardrails?.policy?.minimumMarginPercent || 30
        ).toFixed(0)}% hard margin floor.`
      },
      {
        label: "Sales sync",
        detail: "Pull Shopify orders into analytics so performance stays current."
      },
      {
        label: "Merch sync",
        detail: "Keep the storefront feed and featured items aligned."
      },
      {
        label: "Feed refresh",
        detail: "Refresh the public merch view so the site always reflects the latest lineup."
      }
    ],
    approvalLane: [
      {
        label: "Approve major price changes",
        detail:
          (guardrails?.pendingApprovalCount || 0) > 0
            ? `${guardrails.pendingApprovalCount} recommended price change${guardrails.pendingApprovalCount === 1 ? " is" : "s are"} waiting for you.`
            : "No price changes are waiting for approval."
      },
      {
        label: "Approve the next launch",
        detail: queue?.ready > 0 ? "There is at least one ready item waiting to go live." : "No ready launch yet; the queue still needs a setup pass."
      },
      {
        label: "Approve the featured merch set",
        detail:
          products.length > 0
            ? `The store has ${products.length} featured item${products.length === 1 ? "" : "s"} ready to keep visible.`
            : "Pick at least one featured item so the merch page stays stocked."
      }
    ],
    cadence: [
      {
        label: "Daily",
        detail: "Sales sync, alerts, and merch feed refresh."
      },
      {
        label: "Weekly",
        detail: "Review the approval queue and run the full pass."
      },
      {
        label: "When ready",
        detail: "Push the next launch live after your approval."
      }
    ]
  };
}

export async function runAutomationCycle({ full = false } = {}) {
  const supabase = tryCreateSupabaseAdminClient();
  const steps = [];
  let weeklyReport = null;
  let guardrails = null;

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
    const checks = await refreshConfiguredProfitability(supabase);
    const failedChecks = checks.filter((item) => !item.ok);
    guardrails = await loadGuardrailOverview(supabase);
    steps.push(
      stepResult(
        "profit_guardrails",
        failedChecks.length ? "error" : "success",
        failedChecks.length
          ? `${checks.length - failedChecks.length}/${checks.length} product profit checks completed.`
          : `Profit guardrails checked ${checks.length} configured product${checks.length === 1 ? "" : "s"}.`,
        { checks }
      )
    );
  } catch (error) {
    steps.push(stepResult("profit_guardrails", "error", error.message));
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
    launch: feed?.launch || null,
    guardrails
  };
}
