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
  const [printful, setPrintful] = useState(null);
  const [printfulWorking, setPrintfulWorking] =
    useState("");
  const [printfulForm, setPrintfulForm] = useState({
    blankName: "Comfort Colors 1717",
    defaultColor: "Black",
    defaultSize: "M"
  });
  const [publication, setPublication] = useState(null);
  const [publicationError, setPublicationError] =
    useState("");

  const current = items[selected];

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

  async function loadPrintful(item) {
    if (!item?.product?.id) {
      setPrintful(null);
      return;
    }

    setPrintfulWorking("loading");

    try {
      const response = await fetch(
        `/api/printful/bridge?productId=${encodeURIComponent(
          item.product.id
        )}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "Printful status could not be loaded."
        );
      }

      setPrintful(data);
    } catch (loadError) {
      setPrintful({
        ok: false,
        error: loadError.message
      });
    } finally {
      setPrintfulWorking("");
    }
  }

  async function printfulAction(action) {
    if (!current?.product?.id) {
      setError(
        "Create the Shopify product before connecting Printful."
      );
      return;
    }

    setPrintfulWorking(action);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/printful/bridge",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action,
            productId: current.product.id,
            artworkUrl:
              current.concept.artworkUrl ||
              current.design.front_artwork_url ||
              current.design.thumbnail_url,
            retailPrice: current.form.price,
            ...printfulForm
          })
        }
      );

      const data = await response.json();

      if (!response.ok && response.status !== 409) {
        throw new Error(
          data.error ||
            "Printful action failed."
        );
      }

      setPrintful(data);
      setMessage(data.message);
      await load();

      if (data.inspection?.ready) {
        await loadPrintful({
          ...current,
          product: data.product
        });
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setPrintfulWorking("");
    }
  }

  useEffect(() => {
    loadPrintful(current);
  }, [selected, current?.product?.id]);

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
    Number(current?.product?.printful_variant_count || 0) > 0 &&
    Number(
      current?.product?.printful_synced_variant_count || 0
    ) ===
      Number(
        current?.product?.printful_variant_count || 0
      ) &&
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
          Brokie OS now detects the Shopify listing imported
          into Printful, maps its variants to Comfort Colors 1717,
          attaches the artwork, and verifies fulfillment through
          Printful's Ecommerce Platform Sync API. Store Launch stays
          locked until every sellable variant passes verification.
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
                  {current.concept.mockups?.front &&
                  current.concept.mockups?.back ? (
                    <div className="twoSidedReview">
                      <figure>
                        <img
                          src={current.concept.mockups.front}
                          alt={`${current.form.title} front mockup`}
                        />
                        <figcaption>FRONT</figcaption>
                      </figure>
                      <figure>
                        <img
                          src={current.concept.mockups.back}
                          alt={`${current.form.title} back mockup`}
                        />
                        <figcaption>BACK</figcaption>
                      </figure>
                    </div>
                  ) : (
                    <img
                      src={
                        current.design.thumbnail_url ||
                        current.concept.artworkUrl ||
                        ""
                      }
                      alt={`${current.form.title} preview`}
                    />
                  )}
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

              {(current.design.front_artwork_url ||
                current.design.back_artwork_url) && (
                <div className="reviewAssetLinks">
                  <span>PRINT FILES</span>
                  {current.design.front_artwork_url && (
                    <a
                      href={current.design.front_artwork_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open front artwork
                    </a>
                  )}
                  {current.design.back_artwork_url && (
                    <a
                      href={current.design.back_artwork_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open back artwork
                    </a>
                  )}
                </div>
              )}

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

              <div className="printfulBridgePanel">
                <div className="printfulBridgeHead">
                  <div>
                    <PackageCheck size={20} />
                    <span>
                      <strong>
                        Printful Fulfillment Bridge
                      </strong>
                      Imported Shopify product · Comfort Colors
                      1717 · API-verified fulfillment
                    </span>
                  </div>

                  <span
                    className={`printfulBridgeStatus ${
                      current.product?.printful_status ||
                      "not_configured"
                    }`}
                  >
                    {current.product?.printful_status ||
                      "not configured"}
                  </span>
                </div>

                <div className="printfulSettings">
                  <label>
                    Default blank
                    <input
                      value={printfulForm.blankName}
                      onChange={(event) =>
                        setPrintfulForm((value) => ({
                          ...value,
                          blankName: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Default color
                    <input
                      value={printfulForm.defaultColor}
                      onChange={(event) =>
                        setPrintfulForm((value) => ({
                          ...value,
                          defaultColor: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Default size
                    <select
                      value={printfulForm.defaultSize}
                      onChange={(event) =>
                        setPrintfulForm((value) => ({
                          ...value,
                          defaultSize: event.target.value
                        }))
                      }
                    >
                      {[
                        "XS",
                        "S",
                        "M",
                        "L",
                        "XL",
                        "2XL",
                        "3XL",
                        "4XL"
                      ].map((size) => (
                        <option key={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {printful?.error && (
                  <div className="printfulBridgeError">
                    {printful.error}
                  </div>
                )}

                {printful?.inspection && (
                  <div className="printfulVerification">
                    <article>
                      <strong>
                        {printful.inspection.found
                          ? "Detected"
                          : "Waiting"}
                      </strong>
                      <span>Imported product</span>
                    </article>
                    <article>
                      <strong>
                        {printful.inspection.syncedVariants ||
                          0}
                        /
                        {printful.inspection.totalVariants ||
                          0}
                      </strong>
                      <span>Variants synced</span>
                    </article>
                    <article>
                      <strong>
                        {printful.inspection
                          .artworkReadyVariants || 0}
                        /
                        {printful.inspection.totalVariants ||
                          0}
                      </strong>
                      <span>Artwork ready</span>
                    </article>
                    <article>
                      <strong>
                        {printful.inspection.ready
                          ? "READY"
                          : "NOT READY"}
                      </strong>
                      <span>Fulfillment state</span>
                    </article>
                  </div>
                )}

                {printful?.inspection?.variants?.length > 0 && (
                  <div className="printfulVariantList">
                    {printful.inspection.variants.map(
                      (variant) => (
                        <div key={variant.id}>
                          <span>
                            <strong>{variant.name}</strong>
                            <small>
                              Catalog variant{" "}
                              {variant.catalogVariantId ||
                                "not assigned"}
                            </small>
                          </span>
                          <span>
                            {variant.synced ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <CircleDashed size={16} />
                            )}
                            {variant.artworkReady ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <CircleDashed size={16} />
                            )}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="printfulBridgeActions">
                  <button
                    className="secondary"
                    onClick={() =>
                      printfulAction("detect")
                    }
                    disabled={
                      !!printfulWorking ||
                      !current.product
                        ?.shopify_product_id
                    }
                  >
                    <RefreshCw
                      size={15}
                      className={
                        printfulWorking === "detect"
                          ? "spin"
                          : ""
                      }
                    />
                    Detect imported product
                  </button>

                  <button
                    onClick={() =>
                      printfulAction("configure")
                    }
                    disabled={
                      !!printfulWorking ||
                      !current.product
                        ?.shopify_product_id
                    }
                  >
                    <PackageCheck size={16} />
                    {printfulWorking === "configure"
                      ? "Configuring…"
                      : "Configure Printful"}
                  </button>

                  <button
                    className="secondary"
                    onClick={() =>
                      printfulAction("verify")
                    }
                    disabled={
                      !!printfulWorking ||
                      !current.product
                        ?.shopify_product_id
                    }
                  >
                    <CheckCircle2 size={16} />
                    Verify fulfillment
                  </button>

                  {(printful?.dashboardUrl ||
                    current.product
                      ?.printful_product_url) && (
                    <a
                      href={
                        printful?.dashboardUrl ||
                        current.product
                          .printful_product_url
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Printful{" "}
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                <p className="printfulBridgeNote">
                  Imported products can take a few seconds to
                  several hours to appear in Printful after
                  Shopify creates or updates them. Variant names
                  are matched automatically; a single “Default
                  Title” variant uses the default color and size
                  above.
                </p>
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
