import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";
import {
  buildApprovalPlan,
  buildBusinessAutopilot
} from "@/lib/automation";
import { loadGuardrailOverview } from "@/lib/profit-guardrails-server";
import { daysAgo, roundMoney } from "@/lib/analytics";
import { requireAdminApiUser } from "@/lib/admin-api-auth";
import { POST as analyticsPost } from "@/app/api/analytics/route";
import { POST as storefrontCollectionPost } from "@/app/api/storefront/collection/route";
import { POST as automationPost } from "@/app/api/automation/route";
import { POST as designFactoryPost } from "@/app/api/design-factory/route";
import { POST as guardrailsPost } from "@/app/api/guardrails/route";

function readBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function makeForwardRequest(pathname, body, token) {
  return new Request(`https://brokie.local${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body || {})
  });
}

async function readPayload(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function normalizeProduct(product, position = 0) {
  return {
    id: product.id || `product-${position}`,
    title: product.title || "Brokie product",
    subtitle: product.subtitle || product.productType || product.familyLabel || "",
    productType: product.productType || product.product_type || null,
    status: product.status || "draft",
    badge: product.badge || null,
    family: product.family || null,
    price: Number(product.price || product.retail_price || 0),
    currencyCode: product.currencyCode || "USD",
    image:
      product.image ||
      product.thumbnail_url ||
      product.thumbnail?.thumbnail_url ||
      null,
    onlineStorePublished: Boolean(product.onlineStorePublished),
    printfulStatus: product.printful_status || product.printfulStatus || null,
    url: product.url || product.online_store_url || null
  };
}

function normalizeOrder(order) {
  return {
    id: order.shopify_order_id || order.id,
    name: order.order_name || order.name || "Order",
    processedAt: order.processed_at || order.processedAt,
    total: Number(order.total || 0),
    units: Number(order.item_quantity || order.units || 0),
    financialStatus: order.financial_status || order.financialStatus || null,
    fulfillmentStatus:
      order.fulfillment_status || order.fulfillmentStatus || null,
    currencyCode: order.currency_code || "USD"
  };
}

function normalizeActivity(item, position = 0) {
  return {
    id: item.id || `activity-${position}`,
    title: item.title || "Activity",
    detail: item.detail || "",
    status: item.status || "info",
    createdAt: item.created_at || new Date().toISOString(),
    action: item.action || null
  };
}

function summarizeOrders(orders) {
  return orders.reduce(
    (summary, order) => {
      if (order.test) return summary;
      summary.revenue += Number(order.total || 0);
      summary.orders += 1;
      summary.units += Number(order.item_quantity || 0);
      return summary;
    },
    { revenue: 0, orders: 0, units: 0 }
  );
}

async function loadMobilePayload() {
  const supabase = createSupabaseAdminClient();
  const feed = await loadStorefrontFeed(supabase);
  const guardrails = await loadGuardrailOverview(supabase);
  const start = daysAgo(29).toISOString();

  const [
    ordersResult,
    recentOrdersResult,
    activitiesResult,
    runsResult,
    recentProductsResult,
    analyticsSyncResult
  ] = await Promise.all([
    supabase
      .from("shopify_orders")
      .select("*")
      .gte("processed_at", start)
      .order("processed_at", { ascending: false }),
    supabase
      .from("shopify_orders")
      .select("*")
      .order("processed_at", { ascending: false })
      .limit(15),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("factory_runs")
      .select("id,name,status,requested_count,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("products")
      .select("id,title,product_type,retail_price,status,online_store_published,printful_status,online_store_url,designs(name,thumbnail_url,front_artwork_url)")
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("analytics_sync_runs")
      .select("*")
      .eq("provider", "shopify")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (ordersResult.error) throw ordersResult.error;
  if (recentOrdersResult.error) throw recentOrdersResult.error;
  if (activitiesResult.error) throw activitiesResult.error;
  if (runsResult.error) throw runsResult.error;
  if (recentProductsResult.error) throw recentProductsResult.error;
  if (analyticsSyncResult.error) throw analyticsSyncResult.error;

  const orderSummary = summarizeOrders(ordersResult.data || []);
  const featuredProducts = (feed.products || []).map(normalizeProduct);
  const recentProducts = (recentProductsResult.data || []).map((product, index) => {
    const design = Array.isArray(product.designs)
      ? product.designs[0] || null
      : product.designs || null;
    return normalizeProduct(
      {
        id: product.id,
        title: product.title,
        product_type: product.product_type,
        retail_price: product.retail_price,
        status: product.status,
        online_store_url: product.online_store_url,
        onlineStorePublished: product.online_store_published,
        printful_status: product.printful_status,
        image:
          design?.thumbnail_url ||
          design?.front_artwork_url ||
          null,
        subtitle: design?.name || product.product_type
      },
      index
    );
  });

  const approval = buildApprovalPlan({
    feed,
    launch: feed.launch,
    brain: feed.brain,
    guardrails
  });

  const autopilot = buildBusinessAutopilot({
    feed,
    launch: feed.launch,
    brain: feed.brain,
    guardrails
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: {
      revenue30d: roundMoney(orderSummary.revenue),
      orders30d: orderSummary.orders,
      units30d: orderSummary.units,
      featuredCount: featuredProducts.length,
      readyCount: Number(feed.launch?.ready || 0),
      blockedCount: Number(feed.launch?.blocked || 0),
      liveCount: Number(feed.launch?.live || 0),
      pendingApprovalCount: Number(guardrails?.pendingApprovalCount || 0)
    },
    storefront: feed.storefront || null,
    launch: feed.launch || null,
    brain: feed.brain || null,
    approval,
    autopilot,
    guardrails,
    featuredProducts,
    recentProducts,
    recentOrders: (recentOrdersResult.data || [])
      .filter((order) => !order.test)
      .map(normalizeOrder),
    activities: (activitiesResult.data || []).map(normalizeActivity),
    factoryRuns: runsResult.data || [],
    lastAnalyticsSync: analyticsSyncResult.data || null
  };
}

export async function GET(request) {
  try {
    const user = await requireAdminApiUser(request);
    const payload = await loadMobilePayload();
    return NextResponse.json({
      ...payload,
      user: {
        id: user.id,
        email: user.email || null
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: error?.status || 400 }
    );
  }
}

export async function POST(request) {
  try {
    await requireAdminApiUser(request);
    const token = readBearerToken(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (!action) {
      throw new Error("Action is required.");
    }

    let message = "Action completed.";

    if (action === "sync_sales") {
      const payload = await readPayload(
        await analyticsPost(
          makeForwardRequest("/api/analytics", { full: false }, token)
        ),
        "Sales sync failed."
      );
      message = payload.message || "Sales synced.";
    } else if (action === "sync_merch") {
      const payload = await readPayload(
        await storefrontCollectionPost(
          makeForwardRequest("/api/storefront/collection", {}, token)
        ),
        "Merch sync failed."
      );
      message =
        payload.message ||
        `Merch synced: ${payload.changes?.added || 0} added, ${payload.changes?.removed || 0} removed.`;
    } else if (action === "run_automation") {
      const payload = await readPayload(
        await automationPost(
          makeForwardRequest(
            "/api/automation",
            {
              full: Boolean(body.full),
              approved: true
            },
            token
          )
        ),
        "Automation failed."
      );
      message = payload.message || "Automation cycle completed.";
    } else if (action === "create_factory_run") {
      const payload = await readPayload(
        await designFactoryPost(
          makeForwardRequest(
            "/api/design-factory",
            {
              action: "create_run",
              name: body.name,
              theme: body.theme,
              productType: body.productType,
              audience: body.audience,
              style: body.style,
              mood: body.mood,
              placement: body.placement,
              basePrompt: body.basePrompt,
              count: body.count,
              autoPublish: false
            },
            token
          )
        ),
        "Could not queue the merch run."
      );
      message = payload.message || "Design Factory run queued.";
    } else if (action === "approve_price" || action === "reject_price") {
      const payload = await readPayload(
        await guardrailsPost(
          makeForwardRequest(
            "/api/guardrails",
            {
              action,
              approvalId: body.approvalId
            },
            token
          )
        ),
        "Price decision failed."
      );
      message = payload.message || "Price decision saved.";
    } else {
      throw new Error("Unknown mobile action.");
    }

    const payload = await loadMobilePayload();
    return NextResponse.json({
      ...payload,
      ok: true,
      message
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: error?.status || 400 }
    );
  }
}
