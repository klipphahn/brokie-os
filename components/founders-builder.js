"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Rocket } from "lucide-react";
import { foundersProducts } from "@/lib/founders";

export default function FoundersBuilder() {
  const [products, setProducts] = useState(
    foundersProducts.map((product, index) => ({
      ...product,
      enabled: index === 0,
      variantIds: "",
      frontUrl: "",
      backUrl: ""
    }))
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const selected = useMemo(
    () => products.filter((product) => product.enabled),
    [products]
  );

  function patch(id, changes) {
    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...changes } : product
      )
    );
  }

  async function run(dryRun) {
    setLoading(true);
    setResult("");
    try {
      const response = await fetch("/api/printful/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          products: selected.map((product) => ({
            id: product.id,
            title: product.title,
            price: product.price,
            variantIds: product.variantIds
              .split(",")
              .map((value) => Number(value.trim()))
              .filter(Boolean),
            frontUrl: product.frontUrl.trim(),
            backUrl: product.backUrl.trim()
          }))
        })
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(JSON.stringify({ ok: false, error: error.message }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel" id="builder">
      <div className="panelHead">
        <div>
          <span className="eyebrow">FOUNDERS COLLECTION 001</span>
          <h2>Collection builder</h2>
        </div>
        <span className="approval">REVIEW BEFORE PUBLISHING</span>
      </div>

      <div className="warning">
        Begin with one product and one variant. Use public HTTPS artwork URLs,
        run Dry Test, then create the real Printful product.
      </div>

      <div className="productGrid">
        {products.map((product) => (
          <article
            className={`productCard ${product.enabled ? "selected" : ""}`}
            key={product.id}
          >
            <div className="productTop">
              <span>{product.number}</span>
              <label className="include">
                <input
                  type="checkbox"
                  checked={product.enabled}
                  onChange={(event) =>
                    patch(product.id, { enabled: event.target.checked })
                  }
                />
                Include
              </label>
            </div>

            <small>{product.type}</small>
            <h3>{product.title}</h3>
            <p>{product.description}</p>

            <div className="placement">
              <span><b>Front:</b> {product.front}</span>
              <span><b>Back:</b> {product.back}</span>
            </div>

            <label>
              Retail price
              <input
                value={product.price}
                onChange={(event) =>
                  patch(product.id, { price: event.target.value })
                }
              />
            </label>

            <label>
              Printful catalog variant IDs
              <input
                placeholder="Example: 4011, 4012"
                value={product.variantIds}
                onChange={(event) =>
                  patch(product.id, { variantIds: event.target.value })
                }
              />
            </label>

            <label>
              Front artwork URL
              <input
                placeholder="https://..."
                value={product.frontUrl}
                onChange={(event) =>
                  patch(product.id, { frontUrl: event.target.value })
                }
              />
            </label>

            <label>
              Back artwork URL
              <input
                placeholder="https://... (optional)"
                value={product.backUrl}
                onChange={(event) =>
                  patch(product.id, { backUrl: event.target.value })
                }
              />
            </label>
          </article>
        ))}
      </div>

      <div className="actionBar">
        <div>
          <strong>{selected.length} selected</strong>
          <span>Dry Test sends nothing to Printful.</span>
        </div>
        <button
          className="secondary"
          disabled={!selected.length || loading}
          onClick={() => run(true)}
        >
          <FlaskConical size={18} /> Dry Test
        </button>
        <button
          disabled={!selected.length || loading}
          onClick={() => run(false)}
        >
          <Rocket size={18} /> Create in Printful
        </button>
      </div>

      {result && <pre className="result">{result}</pre>}
    </section>
  );
}
