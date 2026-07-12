"use client";

import { useMemo, useState } from "react";
import { Check, FlaskConical, Rocket, ShieldAlert } from "lucide-react";
import { foundersProducts, StarterProduct } from "@/lib/founders";

type ProductForm = StarterProduct & {
  enabled: boolean;
  variantIds: string;
  frontUrl: string;
  backUrl: string;
};

export function FoundersBuilder() {
  const [products, setProducts] = useState<ProductForm[]>(
    foundersProducts.map((item) => ({
      ...item,
      enabled: item.id === "manifesto-tee",
      variantIds: "",
      frontUrl: "",
      backUrl: ""
    }))
  );
  const [mode, setMode] = useState<"idle" | "loading">("idle");
  const [result, setResult] = useState("");

  const selected = useMemo(() => products.filter((p) => p.enabled), [products]);

  function patch(id: string, values: Partial<ProductForm>) {
    setProducts((current) =>
      current.map((product) => product.id === id ? { ...product, ...values } : product)
    );
  }

  async function run(dryRun: boolean) {
    setMode("loading");
    setResult("");
    try {
      const response = await fetch("/api/printful/founders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          products: selected.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            variantIds: p.variantIds.split(",").map(v => Number(v.trim())).filter(Boolean),
            frontUrl: p.frontUrl.trim(),
            backUrl: p.backUrl.trim()
          }))
        })
      });
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(JSON.stringify({ error: String(error) }, null, 2));
    } finally {
      setMode("idle");
    }
  }

  return (
    <div>
      <div className="notice">
        <ShieldAlert size={20} />
        <div>
          <strong>Start with one product.</strong>
          <p>Use real Printful catalog variant IDs and public HTTPS artwork URLs. Run Dry Test before creating anything.</p>
        </div>
      </div>

      <div className="productGrid">
        {products.map((product, index) => (
          <article className={`productCard ${product.enabled ? "selected" : ""}`} key={product.id}>
            <div className="cardTop">
              <div className="number">{String(index + 1).padStart(3, "0")}</div>
              <label className="switchRow">
                <input
                  type="checkbox"
                  checked={product.enabled}
                  onChange={(e) => patch(product.id, { enabled: e.target.checked })}
                />
                Include
              </label>
            </div>
            <span className="type">{product.type}</span>
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <div className="placements">
              <span><b>Front:</b> {product.frontLabel}</span>
              <span><b>Back:</b> {product.backLabel}</span>
            </div>

            <label>
              Retail price
              <input value={product.price} onChange={(e) => patch(product.id, { price: e.target.value })} />
            </label>
            <label>
              Catalog variant IDs
              <input
                placeholder="Example: 4011, 4012, 4013"
                value={product.variantIds}
                onChange={(e) => patch(product.id, { variantIds: e.target.value })}
              />
            </label>
            <label>
              Front artwork URL
              <input
                placeholder="https://.../front.png"
                value={product.frontUrl}
                onChange={(e) => patch(product.id, { frontUrl: e.target.value })}
              />
            </label>
            <label>
              Back artwork URL
              <input
                placeholder="Optional for hats"
                value={product.backUrl}
                onChange={(e) => patch(product.id, { backUrl: e.target.value })}
              />
            </label>
          </article>
        ))}
      </div>

      <div className="actionBar">
        <div>
          <strong>{selected.length} product{selected.length === 1 ? "" : "s"} selected</strong>
          <span>Products are created as synced products in your connected Printful store.</span>
        </div>
        <button className="secondary" disabled={!selected.length || mode === "loading"} onClick={() => run(true)}>
          <FlaskConical size={18} /> Dry Test
        </button>
        <button disabled={!selected.length || mode === "loading"} onClick={() => run(false)}>
          <Rocket size={18} /> Create in Printful
        </button>
      </div>

      {result && (
        <div className="result">
          <div className="resultTitle"><Check size={18} /> Run results</div>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}
