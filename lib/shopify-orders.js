import { shopifyGraphQL } from "@/lib/shopify";
import {
  dateKey,
  moneyAmount,
  roundMoney
} from "@/lib/analytics";

const ORDERS_QUERY = `
query BrokieOrders(
  $first: Int!,
  $after: String,
  $query: String
) {
  orders(
    first: $first,
    after: $after,
    query: $query,
    sortKey: UPDATED_AT
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      legacyResourceId
      name
      createdAt
      processedAt
      updatedAt
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      currencyCode
      currentSubtotalLineItemsQuantity
      currentSubtotalPriceSet {
        shopMoney { amount currencyCode }
      }
      currentTotalDiscountsSet {
        shopMoney { amount currencyCode }
      }
      currentShippingPriceSet {
        shopMoney { amount currencyCode }
      }
      currentTotalTaxSet {
        shopMoney { amount currencyCode }
      }
      currentTotalPriceSet {
        shopMoney { amount currencyCode }
      }
      totalRefundedSet {
        shopMoney { amount currencyCode }
      }
      test
      sourceName
      lineItems(first: 100) {
        nodes {
          id
          title
          name
          variantTitle
          sku
          quantity
          currentQuantity
          originalUnitPriceSet {
            shopMoney { amount currencyCode }
          }
          discountedUnitPriceSet {
            shopMoney { amount currencyCode }
          }
          originalTotalSet {
            shopMoney { amount currencyCode }
          }
          priceAfterAllDiscountsBeforeTaxesSet {
            shopMoney { amount currencyCode }
          }
          product { id }
          variant { id }
        }
      }
    }
  }
}`;

export async function fetchShopifyOrdersSince(windowStart, maxOrders = 1000) {
  const query = windowStart
    ? `updated_at:>=${new Date(windowStart).toISOString()}`
    : null;

  const orders = [];
  let after = null;

  while (orders.length < maxOrders) {
    const data = await shopifyGraphQL(ORDERS_QUERY, {
      first: Math.min(100, maxOrders - orders.length),
      after,
      query
    });

    const connection = data.orders;
    orders.push(...(connection.nodes || []));

    if (!connection.pageInfo?.hasNextPage) break;
    after = connection.pageInfo.endCursor;
  }

  return orders;
}

export function normalizeOrder(order, internalProducts = new Map()) {
  const normalizedOrder = {
    shopify_order_id: order.id,
    legacy_order_id: String(order.legacyResourceId || ""),
    order_name: order.name,
    processed_at: order.processedAt,
    shopify_created_at: order.createdAt,
    shopify_updated_at: order.updatedAt,
    cancelled_at: order.cancelledAt || null,
    financial_status: order.displayFinancialStatus || null,
    fulfillment_status: order.displayFulfillmentStatus || null,
    currency_code: order.currencyCode || "USD",
    subtotal: roundMoney(moneyAmount(order.currentSubtotalPriceSet)),
    discounts: roundMoney(moneyAmount(order.currentTotalDiscountsSet)),
    shipping: roundMoney(moneyAmount(order.currentShippingPriceSet)),
    taxes: roundMoney(moneyAmount(order.currentTotalTaxSet)),
    total: roundMoney(moneyAmount(order.currentTotalPriceSet)),
    refunded: roundMoney(moneyAmount(order.totalRefundedSet)),
    item_quantity: Number(order.currentSubtotalLineItemsQuantity || 0),
    test: Boolean(order.test),
    source_name: order.sourceName || null,
    raw: order,
    synced_at: new Date().toISOString()
  };

  const items = (order.lineItems?.nodes || []).map((item) => ({
    shopify_line_item_id: item.id,
    shopify_order_id: order.id,
    shopify_product_id: item.product?.id || null,
    shopify_variant_id: item.variant?.id || null,
    internal_product_id:
      internalProducts.get(item.product?.id || "") || null,
    title: item.title || item.name || "Product",
    variant_title: item.variantTitle || null,
    sku: item.sku || null,
    quantity: Number(item.quantity || 0),
    current_quantity: Number(item.currentQuantity || 0),
    original_unit_price: roundMoney(
      moneyAmount(item.originalUnitPriceSet)
    ),
    discounted_unit_price: roundMoney(
      moneyAmount(item.discountedUnitPriceSet)
    ),
    original_line_total: roundMoney(
      moneyAmount(item.originalTotalSet)
    ),
    net_line_revenue: roundMoney(
      moneyAmount(item.priceAfterAllDiscountsBeforeTaxesSet)
    ),
    synced_at: new Date().toISOString()
  }));

  return { order: normalizedOrder, items };
}

export function aggregateDailyMetrics(orders, items, productMap = new Map()) {
  const orderMap = new Map(
    orders.map((order) => [order.shopify_order_id, order])
  );
  const aggregate = new Map();

  for (const item of items) {
    if (!item.shopify_product_id) continue;
    const order = orderMap.get(item.shopify_order_id);
    if (!order || order.test) continue;

    const key = `${dateKey(order.processed_at)}::${item.shopify_product_id}`;
    const current = aggregate.get(key) || {
      metric_date: dateKey(order.processed_at),
      shopify_product_id: item.shopify_product_id,
      internal_product_id:
        item.internal_product_id ||
        productMap.get(item.shopify_product_id) ||
        null,
      orders: new Set(),
      units: 0,
      gross_sales: 0,
      net_revenue: 0
    };

    current.orders.add(item.shopify_order_id);
    current.units += Number(item.current_quantity || 0);
    current.gross_sales += Number(item.original_line_total || 0);
    current.net_revenue += Number(item.net_line_revenue || 0);
    aggregate.set(key, current);
  }

  return [...aggregate.values()].map((entry) => ({
    metric_date: entry.metric_date,
    shopify_product_id: entry.shopify_product_id,
    internal_product_id: entry.internal_product_id,
    orders: entry.orders.size,
    units: entry.units,
    gross_sales: roundMoney(entry.gross_sales),
    net_revenue: roundMoney(entry.net_revenue),
    updated_at: new Date().toISOString()
  }));
}
