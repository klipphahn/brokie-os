"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  LoaderCircle,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Workflow
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function currency(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function compact(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function Change({ value }) {
  const number = Number(value || 0);
  const positive = number >= 0;

  return (
    <span className={positive ? "metricUp" : "metricDown"}>
      {positive ? (
        <ArrowUpRight size={13} />
      ) : (
        <ArrowDownRight size={13} />
      )}
      {Math.abs(number).toFixed(1)}%
    </span>
  );
}

function summarizeLaunchQueue(items = []) {
  const queue = Array.isArray(items) ? items : [];
  const ready = [];
  const blocked = [];
  const live = [];

  for (const item of queue) {
    const product = item?.product || {};
    const state = String(
      product.status || item?.design?.status || ""
    ).toLowerCase();
    const configured =
      product.shopify_product_id &&
      product.printful_status === "configured";
    const isLive = state === "live" || state === "active";

    if (isLive) {
      live.push(item);
    } else if (configured) {
      ready.push(item);
    } else {
      blocked.push(item);
    }
  }

  return {
    total: queue.length,
    ready: ready.length,
    blocked: blocked.length,
    live: live.length,
    nextBlocked: blocked[0] || null
  };
}

export default function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [launch, setLaunch] = useState({
    total: 0,
    ready: 0,
    blocked: 0,
    live: 0,
    nextBlocked: null
  });
  const [approval, setApproval] = useState(null);
  const [autopilot, setAutopilot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [automating, setAutomating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [response, publisherResponse, automationResponse] = await Promise.all([
        fetch(`/api/analytics?days=${days}`, {
          cache: "no-store"
        }),
        fetch("/api/publisher", { cache: "no-store" })
        ,
        fetch("/api/automation", { cache: "no-store" })
      ]);
      const payload = await response.json();
      const publisher = await publisherResponse.json();
      const automation = await automationResponse.json();

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Analytics could not be loaded."
        );
      }

      if (!publisherResponse.ok || !publisher.ok) {
        throw new Error(
          publisher.error ||
            "Launch workflow could not be loaded."
        );
      }

      if (!automationResponse.ok || !automation.ok) {
        throw new Error(
          automation.error ||
            "Approval queue could not be loaded."
        );
      }

      setData(payload);
      setLaunch(summarizeLaunchQueue(publisher.items || []));
      setApproval(automation.approval || null);
      setAutopilot(automation.autopilot || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function sync(full = false) {
    setSyncing(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ full })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Shopify sync failed."
        );
      }

      setMessage(payload.message);
      await load();
      window.dispatchEvent(new Event("brokie-analytics-sync"));
    } catch (syncError) {
      setError(syncError.message);
    } finally {
      setSyncing(false);
    }
  }

  async function runAutomation() {
    setAutomating(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/automation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ full: false, approved: true })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Automation cycle failed."
        );
      }

      setMessage(payload.message || "Automation cycle completed.");
      await load();
      window.dispatchEvent(new Event("brokie-analytics-sync"));
    } catch (automationError) {
      setError(automationError.message);
    } finally {
      setAutomating(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  const maxRevenue = useMemo(
    () =>
      Math.max(
        1,
        ...(data?.trend || []).map((point) =>
          Number(point.revenue || 0)
        )
      ),
    [data]
  );

  const cards = data?.cards || {};

  return (
    <section className="panel analyticsPanel" id="analytics">
      <div className="panelHead">
        <div>
          <span className="eyebrow">SALES INTELLIGENCE</span>
          <h2>Performance Engine</h2>
        </div>

        <div className="analyticsHeadActions">
          <select
            value={days}
            onChange={(event) =>
              setDays(Number(event.target.value))
            }
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>

          <button
            className="secondary"
            onClick={() => sync(false)}
            disabled={syncing || automating}
          >
            {syncing ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            {syncing ? "Syncing…" : "Sync Shopify"}
          </button>

          <button
            className="secondary"
            onClick={runAutomation}
            disabled={syncing || automating}
          >
            {automating ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Workflow size={16} />
            )}
            {automating ? "Running…" : "Run automation"}
          </button>
        </div>
      </div>

      {message && (
        <div className="managerNotice success">{message}</div>
      )}

      {error && (
        <div className="managerNotice error">
          {error}
          {String(error).includes("read_orders") && (
            <div className="scopeHint">
              Confirm the installed Shopify app has
              <code>read_orders</code> and redeploy Vercel.
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="managerEmpty">
          <LoaderCircle className="spin" />
          Loading sales intelligence…
        </div>
      ) : data ? (
        <>
          <div className="analyticsCards">
            <article>
              <div className="analyticsCardIcon">
                <CircleDollarSign />
              </div>
              <span>Revenue</span>
              <strong>{currency(cards.revenue)}</strong>
              <Change value={data.changes?.revenue} />
            </article>

            <article>
              <div className="analyticsCardIcon">
                <ReceiptText />
              </div>
              <span>Orders</span>
              <strong>{compact(cards.orders)}</strong>
              <Change value={data.changes?.orders} />
            </article>

            <article>
              <div className="analyticsCardIcon">
                <Boxes />
              </div>
              <span>Units sold</span>
              <strong>{compact(cards.units)}</strong>
              <Change value={data.changes?.units} />
            </article>

            <article>
              <div className="analyticsCardIcon">
                <ShoppingCart />
              </div>
              <span>Average order</span>
              <strong>{currency(cards.averageOrderValue)}</strong>
              <small>{currency(cards.refunds)} refunded</small>
            </article>

            <article>
              <div className="analyticsCardIcon">
                <PackageCheck />
              </div>
              <span>Launch ready</span>
              <strong>{compact(launch.ready)}</strong>
              <small>
                {compact(launch.blocked)} blocked ·{" "}
                {compact(launch.live)} live
              </small>
            </article>
          </div>

          <div className="analyticsGrid">
            <article className="analyticsChartCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">REVENUE TREND</span>
                  <h3>{days}-day performance</h3>
                </div>
                <TrendingUp />
              </div>

              <div className="revenueChart">
                {(data.trend || []).map((point) => (
                  <div className="revenueBarColumn" key={point.date}>
                    <div className="revenueBarTrack">
                      <div
                        className="revenueBar"
                        style={{
                          height: `${Math.max(
                            2,
                            (Number(point.revenue || 0) /
                              maxRevenue) *
                              100
                          )}%`
                        }}
                        title={`${point.date}: ${currency(
                          point.revenue
                        )}`}
                      />
                    </div>
                    <span>
                      {new Date(
                        `${point.date}T12:00:00`
                      ).toLocaleDateString("en-US", {
                        month: "numeric",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="syncStatusCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">DATA HEALTH</span>
                  <h3>Shopify sync</h3>
                </div>
                <PackageCheck />
              </div>

              <div className="syncStatusRows">
                <div>
                  <span>Last status</span>
                  <strong
                    className={
                      data.lastSync?.status === "success"
                        ? "statusGood"
                        : "statusWarn"
                    }
                  >
                    {data.lastSync?.status || "Never synced"}
                  </strong>
                </div>
                <div>
                  <span>Last run</span>
                  <strong>
                    {data.lastSync?.finished_at
                      ? new Date(
                          data.lastSync.finished_at
                        ).toLocaleString()
                      : "Not available"}
                  </strong>
                </div>
                <div>
                  <span>Orders processed</span>
                  <strong>
                    {compact(data.lastSync?.orders_saved)}
                  </strong>
                </div>
                <div>
                  <span>Line items processed</span>
                  <strong>
                    {compact(data.lastSync?.items_saved)}
                  </strong>
                </div>
              </div>

              <button
                className="secondary fullSyncButton"
                onClick={() => sync(true)}
                disabled={syncing}
              >
                <RotateCcw size={15} />
                Rebuild last 12 months
              </button>
            </article>
          </div>

          <div className="analyticsGrid lowerAnalyticsGrid">
            <article className="syncStatusCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">AUTOPILOT</span>
                  <h3>Business loop</h3>
                </div>
                <Workflow />
              </div>

              {autopilot ? (
                <div className="approvalQueue">
                  <p className="approvalSummary">{autopilot.summary}</p>
                  <div className="approvalItems">
                    {(autopilot.alwaysOn || []).map((item) => (
                      <div key={item.label} className="approvalItem ready">
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="approvalItems">
                    <div className="approvalItem needs_attention">
                      <strong>{autopilot.nextMove?.label || "Next move"}</strong>
                      <p>{autopilot.nextMove?.detail || "Keep the queue moving."}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="analyticsEmptyRow">Loading autopilot plan…</div>
              )}
            </article>

            <article className="syncStatusCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">APPROVAL CENTER</span>
                  <h3>Major approvals only</h3>
                </div>
                <Workflow />
              </div>

              {approval ? (
                <div className="approvalQueue">
                  <p className="approvalSummary">{approval.summary}</p>
                  <div className="approvalItems">
                    {(approval.actions || []).map((item) => (
                      <div key={item.id} className={`approvalItem ${item.status}`}>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary fullSyncButton"
                    onClick={runAutomation}
                    disabled={syncing || automating}
                  >
                    <Workflow size={15} />
                    {automating ? "Running…" : approval.approveLabel || "Approve & run"}
                  </button>
                </div>
              ) : (
                <div className="analyticsEmptyRow">
                  Loading approval queue…
                </div>
              )}
            </article>

            <article className="syncStatusCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">LAUNCH STATUS</span>
                  <h3>Publisher readiness</h3>
                </div>
                <PackageCheck />
              </div>

              <div className="syncStatusRows">
                <div>
                  <span>Total in queue</span>
                  <strong>{compact(launch.total)}</strong>
                </div>
                <div>
                  <span>Ready to launch</span>
                  <strong className="statusGood">
                    {compact(launch.ready)}
                  </strong>
                </div>
                <div>
                  <span>Blocked</span>
                  <strong className="statusWarn">
                    {compact(launch.blocked)}
                  </strong>
                </div>
                <div>
                  <span>Live</span>
                  <strong>{compact(launch.live)}</strong>
                </div>
              </div>
            </article>

            <article className="recentOrdersCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">NEXT BLOCKER</span>
                  <h3>Needs attention</h3>
                </div>
                <BarChart3 />
              </div>

              {launch.nextBlocked ? (
                <div className="recentOrdersList">
                  <div>
                    <span>
                      <strong>
                        {launch.nextBlocked.form?.title ||
                          launch.nextBlocked.design?.name ||
                          "Untitled"}
                      </strong>
                      <small>
                        {launch.nextBlocked.product?.status ||
                          launch.nextBlocked.design?.status ||
                          "draft"}
                      </small>
                    </span>
                    <span>
                      <strong>
                        {launch.nextBlocked.product?.printful_status ||
                          "not configured"}
                      </strong>
                      <small>Printful state</small>
                    </span>
                  </div>
                  <div className="analyticsEmptyRow">
                    Finish the remaining Publisher and Printful steps for this item to clear the queue.
                  </div>
                </div>
              ) : (
                <div className="analyticsEmptyRow">
                  Nothing is blocked right now. The launch queue is moving.
                </div>
              )}
            </article>
          </div>

          <div className="analyticsGrid lowerAnalyticsGrid">
            <article className="topProductsCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">LEADERBOARD</span>
                  <h3>Top products</h3>
                </div>
                <BarChart3 />
              </div>

              <div className="topProductsTable">
                <div className="analyticsTableHead">
                  <span>Product</span>
                  <span>Orders</span>
                  <span>Units</span>
                  <span>Revenue</span>
                </div>

                {(data.topProducts || []).length ? (
                  data.topProducts.map((product, index) => (
                    <div className="analyticsTableRow" key={product.shopifyProductId}>
                      <span className="rankedProduct">
                        <b>{index + 1}</b>
                        <span>
                          <strong>{product.title}</strong>
                          <small>
                            {product.onlineStoreUrl
                              ? "Live"
                              : "Shopify product"}
                          </small>
                        </span>
                      </span>
                      <span>{compact(product.orders)}</span>
                      <span>{compact(product.units)}</span>
                      <span>{currency(product.revenue)}</span>
                    </div>
                  ))
                ) : (
                  <div className="analyticsEmptyRow">
                    Sync Shopify to build the product leaderboard.
                  </div>
                )}
              </div>
            </article>

            <article className="recentOrdersCard">
              <div className="analyticsSectionHead">
                <div>
                  <span className="eyebrow">LATEST ACTIVITY</span>
                  <h3>Recent orders</h3>
                </div>
                <ReceiptText />
              </div>

              <div className="recentOrdersList">
                {(data.recentOrders || []).length ? (
                  data.recentOrders.map((order) => (
                    <div key={order.id}>
                      <span>
                        <strong>{order.name}</strong>
                        <small>
                          {new Date(
                            order.processedAt
                          ).toLocaleString()}
                        </small>
                      </span>
                      <span>
                        <strong>{currency(order.total)}</strong>
                        <small>
                          {order.units} unit
                          {order.units === 1 ? "" : "s"} ·{" "}
                          {String(
                            order.fulfillmentStatus || ""
                          ).toLowerCase()}
                        </small>
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="analyticsEmptyRow">
                    No non-test orders were found in this period.
                  </div>
                )}
              </div>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
