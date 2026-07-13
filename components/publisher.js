"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Rocket,
  Save,
  ShoppingBag,
  Store,
  TriangleAlert
} from "lucide-react";

function normalize(item) {
  const concept = item.concept || {};
  const product = item.product || {};

  return {
    ...item,
    form: {
      title:
        product.title ||
        concept.title ||
        item.design.name ||
        "",
      description:
        product.description ||
        concept.description ||
        "",
      productType:
        product.product_type ||
        concept.productType ||
        "Apparel",
      price: String(
        product.retail_price ||
        concept.price ||
        39.99
      ),
      tags: (
        product.tags ||
        concept.tags ||
        ["The Brokie"]
      ).join(", "),
      seoTitle:
        product.seo_title ||
        concept.seoTitle ||
        concept.title ||
        item.design.name ||
        "",
      metaDescription:
        product.meta_description ||
        concept.metaDescription ||
        concept.description ||
        ""
    }
  };
}

export default function Publisher() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [printfulConfirmed, setPrintfulConfirmed] =
    useState(false);
  const [publication, setPublication] = useState(null);
  const [publicationError, setPublicationError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/publisher", {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Unable to load publisher."
        );
      }

      setItems((data.items || []).map(normalize));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkPublication() {
    try {
      const response = await fetch(
        "/api/shopify/publications",
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "Online Store publishing is unavailable."
        );
      }

      setPublication(data.publication);
      setPublicationError("");
    } catch (publicationLoadError) {
      setPublication(null);
      setPublicationError(publicationLoadError.message);
    }
  }

  useEffect(() => {
    load();
    checkPublication();
  }, []);

  useEffect(() => {
    setPrintfulConfirmed(false);
  }, [selected]);

  const current = items[selected];

  function patch(key, value) {
    setItems((values) =>
      values.map((item, index) =>
        index === selected
          ? {
              ...item,
              form: {
                ...item.form,
                [key]: value
              }
            }
          : item
      )
    );
  }

  async function act(action, extra = {}) {
    if (!current) return;

    setWorking(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/publisher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          designId: current.design.id,
          ...current.form,
          tags: current.form.tags
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          ...extra
        })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "Publisher action failed."
        );
      }

      setMessage(data.message);
      await load();

      if (
        action === "launch_store" ||
        action === "refresh_store_state"
      ) {
        await checkPublication();
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setWorking("");
    }
  }

  const steps = useMemo(() => {
    if (!current) return [];

    const product = current.product || {};

    return [
      [
        "Artwork ready",
        Boolean(
          current.concept.artworkUrl ||
            current.design.thumbnail_url
        )
      ],
      [
        "Metadata reviewed",
        ["review", "shopify_draft", "live"].includes(
          product.status
        ) ||
          ["approved", "ready", "published"].includes(
            current.design.status
          )
      ],
      [
        "Shopify product",
        Boolean(product.shopify_product_id)
      ],
      [
        "Printful fulfilled",
        product.printful_status === "configured"
      ],
      [
        "Online Store",
        Boolean(product.online_store_published)
      ],
      ["Live", product.status === "live"]
    ];
  }, [current]);

  const canLaunch =
    Boolean(current?.product?.shopify_product_id) &&
    current?.product?.printful_status === "configured" &&
    Boolean(publication);

  return (
    <section
      className="panel publisherPanel"
      id="publisher"
    >
      <div className="panelHead">
        <div>
          <span className="eyebrow">
            PUBLISHER V1.8
          </span>
          <h2>Launch to the Online Store</h2>
        </div>

        <button
          className="secondary"
          onClick={() => {
            load();
            checkPublication();
          }}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="publisherNotice">
        <TriangleAlert size={18} />
        <span>
          Brokie OS can activate and publish the Shopify
          product automatically. Because Printful does not
          allow its Shopify-connected store to be configured
          through the synced-product API, you must confirm
          fulfillment once before launching.
        </span>
      </div>

      {publication ? (
        <div className="publicationReady">
          <Store size={17} />
          <span>
            Sales channel ready:{" "}
            <strong>{publication.title}</strong>
          </span>
        </div>
      ) : (
        <div className="managerNotice error">
          {publicationError ||
            "Checking Online Store publication…"}
          <div className="scopeHint">
            Shopify app scopes required:{" "}
            <code>read_publications</code> and{" "}
            <code>write_publications</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="managerNotice error">
          {error}
        </div>
      )}

      {message && (
        <div className="managerNotice success">
          {message}
        </div>
      )}

      {loading ? (
        <div className="managerEmpty">
          <LoaderCircle className="spin" />
          Loading publisher…
        </div>
      ) : items.length ? (
        <div className="publisherLayout">
          <div className="publisherQueue">
            {items.map((item, index) => (
              <button
                key={item.design.id}
                className={
                  index === selected
                    ? "activePublishItem"
                    : ""
                }
                onClick={() => setSelected(index)}
              >
                <img
                  src={
                    item.concept.artworkUrl ||
                    item.design.thumbnail_url ||
                    ""
                  }
                  alt=""
                />
                <span>
                  <b>{item.form.title}</b>
                  <small>
                    {item.product?.status ||
                      item.design.status}
                  </small>
                </span>
              </button>
            ))}
          </div>

          {current && (
            <div className="reviewWorkspace">
              <div className="reviewTop">
                <div className="reviewArtwork">
                  <img
                    src={
                      current.concept.artworkUrl ||
                      current.design.thumbnail_url ||
                      ""
                    }
                    alt=""
                  />
                </div>

                <div className="publishChecklist">
                  {steps.map(([label, done]) => (
                    <div key={label}>
                      {done ? (
                        <CheckCircle2 />
                      ) : (
                        <CircleDashed />
                      )}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="reviewFields">
                <label>
                  Product title
                  <input
                    value={current.form.title}
                    onChange={(event) =>
                      patch(
                        "title",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Product type
                  <input
                    value={current.form.productType}
                    onChange={(event) =>
                      patch(
                        "productType",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="fullField">
                  Description
                  <textarea
                    value={current.form.description}
                    onChange={(event) =>
                      patch(
                        "description",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Retail price
                  <input
                    value={current.form.price}
                    onChange={(event) =>
                      patch(
                        "price",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Tags
                  <input
                    value={current.form.tags}
                    onChange={(event) =>
                      patch(
                        "tags",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  SEO title
                  <input
                    value={current.form.seoTitle}
                    onChange={(event) =>
                      patch(
                        "seoTitle",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Meta description
                  <input
                    value={
                      current.form.metaDescription
                    }
                    onChange={(event) =>
                      patch(
                        "metaDescription",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <div className="launchGate">
                <div>
                  <PackageCheck size={19} />
                  <span>
                    <strong>
                      Printful fulfillment checkpoint
                    </strong>
                    Confirm the product blank, all variants,
                    artwork placement, retail price, and
                    Shopify synchronization in Printful.
                  </span>
                </div>

                {current.product?.printful_status ===
                "configured" ? (
                  <div className="confirmedGate">
                    <CheckCircle2 size={18} />
                    Printful configuration confirmed
                  </div>
                ) : (
                  <>
                    <label className="confirmationCheck">
                      <input
                        type="checkbox"
                        checked={printfulConfirmed}
                        onChange={(event) =>
                          setPrintfulConfirmed(
                            event.target.checked
                          )
                        }
                      />
                      I checked the Printful product and it
                      is ready to fulfill customer orders.
                    </label>

                    <button
                      className="secondary"
                      disabled={
                        !printfulConfirmed || !!working
                      }
                      onClick={() =>
                        act(
                          "mark_printful_configured",
                          { confirmed: true }
                        )
                      }
                    >
                      <PackageCheck size={16} />
                      {working ===
                      "mark_printful_configured"
                        ? "Saving…"
                        : "Mark Printful configured"}
                    </button>
                  </>
                )}
              </div>

              <div className="publisherActions">
                <button
                  className="secondary"
                  onClick={() => act("save_review")}
                  disabled={!!working}
                >
                  <Save size={16} />
                  {working === "save_review"
                    ? "Saving…"
                    : "Save review"}
                </button>

                <button
                  onClick={() =>
                    act("create_shopify_draft")
                  }
                  disabled={!!working}
                >
                  <ShoppingBag size={16} />
                  {working === "create_shopify_draft"
                    ? "Creating…"
                    : current.product
                          ?.shopify_product_id
                      ? "Update Shopify product"
                      : "Create Shopify draft"}
                </button>

                <button
                  className="launchButton"
                  onClick={() => act("launch_store")}
                  disabled={!canLaunch || !!working}
                  title={
                    canLaunch
                      ? "Activate and publish to the Online Store"
                      : "Create the Shopify product, confirm Printful, and enable publication scopes first"
                  }
                >
                  <Rocket size={17} />
                  {working === "launch_store"
                    ? "Launching…"
                    : "Launch to Store"}
                </button>

                {current.product
                  ?.shopify_admin_url && (
                  <a
                    href={
                      current.product
                        .shopify_admin_url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Shopify Admin{" "}
                    <ExternalLink size={14} />
                  </a>
                )}

                {current.product?.online_store_url ? (
                  <a
                    className="storefrontLink"
                    href={
                      current.product.online_store_url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    View live product{" "}
                    <ExternalLink size={14} />
                  </a>
                ) : current.product
                    ?.shopify_product_id ? (
                  <button
                    className="textButton"
                    onClick={() =>
                      act("refresh_store_state")
                    }
                    disabled={!!working}
                  >
                    <RefreshCw size={14} />
                    Refresh storefront status
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="managerEmpty">
          Generate designs in Foundry first.
        </div>
      )}
    </section>
  );
}
