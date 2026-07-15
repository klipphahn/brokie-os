import { NextResponse } from "next/server";
import {
  daysAgo,
  dateKey,
  percentChange,
  roundMoney
} from "@/lib/analytics";
import {
  aggregateDailyMetrics,
  fetchShopifyOrdersSince,
  normalizeOrder
} from "@/lib/shopify-orders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function db() {
  return createSupabaseAdminClient();
}

async function createRun(supabase, windowStart) {
  const { data, error } = await supabase
    .from("analytics_sync_runs")
    .insert({
      provider: "shopify",
      status: "running",
      window_start: windowStart
    })
    .select()
    .single();

  if (error) throw error;
  return data || {
    id: "noop-analytics-run",
    provider: "shopify",
    status: "running",
    window_start: windowStart
  };
}

async function finishRun(supabase, id, values) {
  if (!id || id === "noop-analytics-run") return;
  await supabase
    .from("analytics_sync_runs")
    .update({
      ...values,
      finished_at: new Date().toISOString()
    })
    .eq("id", id);
}

async function refreshDesignMetrics(supabase) {
  const { data: products, error: productsError } =
    await supabase
      .from("products")
      .select("id,design_id,shopify_product_id")
      .not("design_id", "is", null)
      .not("shopify_product_id", "is", null);

  if (productsError) throw productsError;
  if (!(products || []).length) return;

  const ids = products.map((item) => item.shopify_product_id);

  const { data: daily, error: dailyError } =
    await supabase
      .from("product_daily_metrics")
      .select(
        "shopify_product_id,orders,units,net_revenue"
      )
      .in("shopify_product_id", ids);

  if (dailyError) throw dailyError;

  const totals = new Map();

  for (const metric of daily || []) {
    const current = totals.get(metric.shopify_product_id) || {
      orders: 0,
      units: 0,
      revenue: 0
    };

    current.orders += Number(metric.orders || 0);
    current.units += Number(metric.units || 0);
    current.revenue += Number(metric.net_revenue || 0);
    totals.set(metric.shopify_product_id, current);
  }

  for (const product of products) {
    const total = totals.get(product.shopify_product_id) || {
      orders: 0,
      units: 0,
      revenue: 0
    };

    await supabase
      .from("design_metrics")
      .upsert(
        {
          design_id: product.design_id,
          orders: total.orders,
          units_sold: total.units,
          revenue: roundMoney(total.revenue),
          updated_at: new Date().toISOString()
        },
        { onConflict: "design_id" }
      );
  }
}

export async function POST(request) {
  const supabase = db();
  let run = null;

  try {
    const body = await request.json().catch(() => ({}));
    const full = Boolean(body.full);

    const { data: latest } = await supabase
      .from("analytics_sync_runs")
      .select("finished_at")
      .eq("provider", "shopify")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const defaultStart = daysAgo(
      Number(process.env.ANALYTICS_INITIAL_SYNC_DAYS || 90)
    );

    const incrementalStart = latest?.finished_at
      ? new Date(
          new Date(latest.finished_at).getTime() -
            24 * 60 * 60 * 1000
        )
      : defaultStart;

    const windowStart = full ? daysAgo(365) : incrementalStart;
    run = await createRun(supabase, windowStart.toISOString());

    const { data: products, error: productError } =
      await supabase
        .from("products")
        .select("id,shopify_product_id")
        .not("shopify_product_id", "is", null);

    if (productError) throw productError;

    const productMap = new Map(
      (products || []).map((item) => [
        item.shopify_product_id,
        item.id
      ])
    );

    const shopifyOrders = await fetchShopifyOrdersSince(
      windowStart,
      Number(process.env.ANALYTICS_MAX_ORDERS || 1000)
    );

    const normalized = shopifyOrders.map((order) =>
      normalizeOrder(order, productMap)
    );

    const orderRows = normalized.map((entry) => entry.order);
    const itemRows = normalized.flatMap((entry) => entry.items);

    if (orderRows.length) {
      const { error } = await supabase
        .from("shopify_orders")
        .upsert(orderRows, {
          onConflict: "shopify_order_id"
        });

      if (error) throw error;
    }

    if (itemRows.length) {
      const { error } = await supabase
        .from("shopify_order_items")
        .upsert(itemRows, {
          onConflict: "shopify_line_item_id"
        });

      if (error) throw error;
    }

    const { data: storedOrders, error: storedOrdersError } =
      await supabase
        .from("shopify_orders")
        .select("*")
        .gte(
          "processed_at",
          daysAgo(365).toISOString()
        );

    if (storedOrdersError) throw storedOrdersError;

    const orderIds = (storedOrders || []).map(
      (order) => order.shopify_order_id
    );

    let storedItems = [];

    if (orderIds.length) {
      const { data, error } = await supabase
        .from("shopify_order_items")
        .select("*")
        .in("shopify_order_id", orderIds);

      if (error) throw error;
      storedItems = data || [];
    }

    const metrics = aggregateDailyMetrics(
      storedOrders || [],
      storedItems,
      productMap
    );

    const affectedDates = [
      ...new Set(metrics.map((metric) => metric.metric_date))
    ];

    if (affectedDates.length) {
      const minDate = affectedDates.sort()[0];

      const { error: deleteError } = await supabase
        .from("product_daily_metrics")
        .delete()
        .gte("metric_date", minDate);

      if (deleteError) throw deleteError;

      if (metrics.length) {
        const { error: metricsError } = await supabase
          .from("product_daily_metrics")
          .upsert(metrics, {
            onConflict: "metric_date,shopify_product_id"
          });

        if (metricsError) throw metricsError;
      }
    }

    await refreshDesignMetrics(supabase);

    await finishRun(supabase, run.id, {
      status: "success",
      orders_seen: shopifyOrders.length,
      orders_saved: orderRows.length,
      items_saved: itemRows.length,
      metadata: {
        full,
        metric_rows: metrics.length
      }
    });

    await supabase.from("activity_logs").insert({
      action: "analytics_sync",
      title: "Shopify analytics synchronized",
      detail: `${orderRows.length} orders and ${itemRows.length} line items processed.`,
      status: "success",
      metadata: {
        runId: run.id,
        windowStart: windowStart.toISOString()
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Synced ${orderRows.length} orders and ${itemRows.length} line items.`,
      run: {
        id: run.id,
        windowStart: windowStart.toISOString(),
        orders: orderRows.length,
        items: itemRows.length,
        metrics: metrics.length
      }
    });
  } catch (error) {
    if (run?.id) {
      await finishRun(supabase, run.id, {
        status: "error",
        error_message:
          error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}

function summarizeOrders(orders) {
  const valid = orders.filter((order) => !order.test);
  return {
    revenue: roundMoney(
      valid.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      )
    ),
    orders: valid.length,
    units: valid.reduce(
      (sum, order) => sum + Number(order.item_quantity || 0),
      0
    ),
    refunds: roundMoney(
      valid.reduce(
        (sum, order) => sum + Number(order.refunded || 0),
        0
      )
    )
  };
}

export async function GET(request) {
  try {
    const supabase = db();
    const url = new URL(request.url);
    const days = Math.min(
      365,
      Math.max(7, Number(url.searchParams.get("days") || 30))
    );

    const currentStart = daysAgo(days - 1);
    const previousStart = daysAgo(days * 2 - 1);

    const { data: orders, error: ordersError } =
      await supabase
        .from("shopify_orders")
        .select("*")
        .gte("processed_at", previousStart.toISOString())
        .order("processed_at", { ascending: false });

    if (ordersError) throw ordersError;

    const currentOrders = (orders || []).filter(
      (order) => new Date(order.processed_at) >= currentStart
    );

    const previousOrders = (orders || []).filter((order) => {
      const date = new Date(order.processed_at);
      return date >= previousStart && date < currentStart;
    });

    const current = summarizeOrders(currentOrders);
    const previous = summarizeOrders(previousOrders);

    const aov = current.orders
      ? current.revenue / current.orders
      : 0;

    const trendMap = new Map();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const key = dateKey(daysAgo(offset));
      trendMap.set(key, {
        date: key,
        revenue: 0,
        orders: 0
      });
    }

    for (const order of currentOrders) {
      if (order.test) continue;
      const key = dateKey(order.processed_at);
      if (!trendMap.has(key)) continue;
      const point = trendMap.get(key);
      point.revenue += Number(order.total || 0);
      point.orders += 1;
    }

    const { data: productMetrics, error: metricsError } =
      await supabase
        .from("product_daily_metrics")
        .select(
          "shopify_product_id,internal_product_id,orders,units,gross_sales,net_revenue,metric_date"
        )
        .gte("metric_date", dateKey(currentStart));

    if (metricsError) throw metricsError;

    const productIds = [
      ...new Set(
        (productMetrics || [])
          .map((row) => row.internal_product_id)
          .filter(Boolean)
      )
    ];

    let products = [];
    if (productIds.length) {
      const result = await supabase
        .from("products")
        .select(
          "id,title,shopify_product_id,shopify_admin_url,online_store_url,design_id"
        )
        .in("id", productIds);

      if (result.error) throw result.error;
      products = result.data || [];
    }

    const productById = new Map(
      products.map((product) => [product.id, product])
    );

    const rankings = new Map();
    for (const row of productMetrics || []) {
      const key =
        row.internal_product_id || row.shopify_product_id;
      const currentRow = rankings.get(key) || {
        internalProductId: row.internal_product_id,
        shopifyProductId: row.shopify_product_id,
        orders: 0,
        units: 0,
        revenue: 0,
        grossSales: 0
      };

      currentRow.orders += Number(row.orders || 0);
      currentRow.units += Number(row.units || 0);
      currentRow.revenue += Number(row.net_revenue || 0);
      currentRow.grossSales += Number(row.gross_sales || 0);
      rankings.set(key, currentRow);
    }

    const topProducts = [...rankings.values()]
      .map((row) => {
        const product = row.internalProductId
          ? productById.get(row.internalProductId)
          : null;

        return {
          ...row,
          title:
            product?.title ||
            `Shopify product ${String(
              row.shopifyProductId
            ).split("/").pop()}`,
          shopifyAdminUrl:
            product?.shopify_admin_url || null,
          onlineStoreUrl:
            product?.online_store_url || null,
          revenue: roundMoney(row.revenue),
          grossSales: roundMoney(row.grossSales)
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const { data: lastRun } = await supabase
      .from("analytics_sync_runs")
      .select("*")
      .eq("provider", "shopify")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      rangeDays: days,
      cards: {
        revenue: current.revenue,
        orders: current.orders,
        units: current.units,
        refunds: current.refunds,
        averageOrderValue: roundMoney(aov)
      },
      changes: {
        revenue: percentChange(
          current.revenue,
          previous.revenue
        ),
        orders: percentChange(
          current.orders,
          previous.orders
        ),
        units: percentChange(current.units, previous.units)
      },
      trend: [...trendMap.values()].map((point) => ({
        ...point,
        revenue: roundMoney(point.revenue)
      })),
      topProducts,
      recentOrders: currentOrders
        .filter((order) => !order.test)
        .slice(0, 12)
        .map((order) => ({
          id: order.shopify_order_id,
          name: order.order_name,
          processedAt: order.processed_at,
          total: Number(order.total || 0),
          units: Number(order.item_quantity || 0),
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status
        })),
      lastSync: lastRun || null
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : String(error)
      },
      { status: 400 }
    );
  }
}
