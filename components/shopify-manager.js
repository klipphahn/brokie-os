"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Search,
  ShoppingBag
} from "lucide-react";

export default function ShopifyManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  async function loadProducts() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shopify/products?limit=100", {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not load Shopify products.");
      }

      setProducts(data.products);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return products;

    return products.filter((product) =>
      [
        product.title,
        product.status,
        product.productType,
        ...(product.tags || [])
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [products, query]);

  const counts = products.reduce(
    (result, product) => {
      result.total += 1;
      const key = String(product.status || "").toLowerCase();
      if (key in result) result[key] += 1;
      return result;
    },
    { total: 0, active: 0, draft: 0, archived: 0 }
  );

  return (
    <section className="panel" id="shopify-manager">
      <div className="panelHead">
        <div>
          <span className="eyebrow">SHOPIFY SYNC</span>
          <h2>Store products</h2>
        </div>

        <button
          className="secondary"
          onClick={loadProducts}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <RefreshCw size={17} />
          )}
          Refresh
        </button>
      </div>

      <div className="shopifyStats">
        <article><strong>{counts.total}</strong><span>Total</span></article>
        <article><strong>{counts.active}</strong><span>Active</span></article>
        <article><strong>{counts.draft}</strong><span>Draft</span></article>
        <article><strong>{counts.archived}</strong><span>Archived</span></article>
      </div>

      <div className="productToolbar">
        <Search size={17} />
        <input
          placeholder="Search title, status, type, or tag..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error && <div className="managerNotice error">{error}</div>}

      {loading ? (
        <div className="managerEmpty">
          <LoaderCircle className="spin" />
          <span>Loading Shopify products…</span>
        </div>
      ) : filtered.length ? (
        <div className="shopifyProductGrid">
          {filtered.map((product) => (
            <article className="shopifyProductCard" key={product.id}>
              <div className="shopifyImage">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.imageAlt || ""}
                  />
                ) : (
                  <ShoppingBag size={28} />
                )}
              </div>

              <div className="shopifyProductBody">
                <div className="shopifyProductMeta">
                  <span className={`statusPill ${String(product.status).toLowerCase()}`}>
                    {product.status}
                  </span>
                  <span>{product.variantCount} variants</span>
                </div>

                <h3>{product.title}</h3>

                <p>
                  {product.minPrice
                    ? `$${product.minPrice}${
                        product.minPrice !== product.maxPrice
                          ? `–$${product.maxPrice}`
                          : ""
                      }`
                    : "No price"}
                  {" · "}
                  Inventory {product.inventory}
                </p>

                <a
                  href={product.adminUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Shopify <ExternalLink size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="managerEmpty">
          <ShoppingBag />
          <span>No matching Shopify products.</span>
        </div>
      )}
    </section>
  );
}
