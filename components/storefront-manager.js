"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Save,
  ShoppingBag
} from "lucide-react";
import { merchListingCopy } from "@/lib/product-types";

const EMPTY = {
  site_name: "the brokie",
  shop_domain: "shop.thebrokie.com",
  announcement_text: "FOUNDERS DROP 001 — BUILT FOR THE PEOPLE STILL BUILDING",
  hero_eyebrow: "THE BROKIE GOODS",
  hero_headline: "WE DON'T NEED MONEY TO BE DANGEROUS.",
  hero_subheadline: "Premium workwear and streetwear for builders, creators, and people earning what comes next.",
  primary_cta_label: "SHOP THE DROP",
  primary_cta_url: "/collections/the-brokie-featured",
  secondary_cta_label: "OUR STORY",
  secondary_cta_url: "https://thebrokie.com",
  manifesto_headline: "BROKE TODAY. BUILDING FOREVER.",
  manifesto_body: "We build. We sacrifice. We stay loyal. We keep showing up.",
  shipping_policy_title: "Shipping",
  shipping_policy_body: "Orders are fulfilled by Printful and usually ship after production is complete. You will get tracking as soon as the order leaves the facility.",
  returns_policy_title: "Returns",
  returns_policy_body: "Because each item is made to order, returns are limited to damaged, misprinted, or incorrect items. Reach out quickly if something arrives wrong so we can help fix it.",
  fulfillment_note: "Printed on demand. Fulfilled by Printful. Built for the people still building.",
  collection_title: "The Brokie Featured",
  collection_handle: "the-brokie-featured",
  collection_description: "The latest pieces selected by The Brokie. Built for the people still building."
};

function featuredDefaultsFor(product) {
  const copy = merchListingCopy(product.productType || product.product_type);
  return {
    badge: copy.badge || "NEW",
    displayTitle: copy.title || product.title,
    displaySubtitle: copy.subtitle || ""
  };
}

export default function StorefrontManager() {
  const [settings, setSettings] = useState(EMPTY);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [brain, setBrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState(null);

  const feedUrl = typeof window === "undefined"
    ? "/api/storefront/featured"
    : `${window.location.origin}/api/storefront/featured`;

  async function load() {
    setLoading(true);
    setNotice(null);
    try {
      const feedRequest = fetch(feedUrl, { cache: "no-store" }).catch(() => null);
      const [stateResponse, productsResponse] = await Promise.all([
        fetch("/api/storefront/settings", { cache: "no-store" }),
        fetch("/api/shopify/products?limit=100", { cache: "no-store" })
      ]);
      const feedResponse = await feedRequest;
      const state = await stateResponse.json();
      const shopify = await productsResponse.json();
      const feed = feedResponse ? await feedResponse.json() : null;
      if (!stateResponse.ok || !state.ok) throw new Error(state.error || "Could not load storefront settings.");
      if (!productsResponse.ok || !shopify.ok) throw new Error(shopify.error || "Could not load Shopify products.");
      setSettings({ ...EMPTY, ...state.settings });
      setProducts(shopify.products || []);
      setBrain(feed?.brain || null);
      setSelected((state.featured || []).map((item) => ({
        id: item.shopify_product_id,
        badge: item.badge || featuredDefaultsFor(item).badge,
        displayTitle: item.display_title || featuredDefaultsFor(item).displayTitle,
        displaySubtitle: item.display_subtitle || featuredDefaultsFor(item).displaySubtitle,
        productType: item.product_type
      })));
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedProducts = useMemo(() => selected.map((choice) => {
    const product = products.find((item) => item.id === choice.id);
    return product ? { ...product, ...choice } : null;
  }).filter(Boolean), [products, selected]);

  function toggle(product) {
    const exists = selected.some((item) => item.id === product.id);
    if (exists) return setSelected((items) => items.filter((item) => item.id !== product.id));
    if (selected.length >= 8) return setNotice({ type: "error", text: "Choose up to eight featured products." });
    const defaults = featuredDefaultsFor(product);
    setSelected((items) => [...items, {
      id: product.id,
      badge: defaults.badge,
      displayTitle: defaults.displayTitle,
      displaySubtitle: defaults.displaySubtitle,
      productType: product.productType
    }]);
  }

  function move(index, direction) {
    setSelected((items) => {
      const next = [...items];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/storefront/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, products: selectedProducts })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not save storefront settings.");
      setNotice({ type: "success", text: "Storefront settings and public merch feed saved." });
      return true;
    } catch (error) {
      setNotice({ type: "error", text: error.message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function syncCollection() {
    setSyncing(true);
    setNotice(null);
    try {
      const saved = await save();
      if (!saved) return;
      const response = await fetch("/api/storefront/collection", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not sync the Shopify collection.");
      setNotice({ type: "success", text: `Shopify collection synced: ${data.changes.added} added, ${data.changes.removed} removed.` });
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSyncing(false);
    }
  }

  function field(key, label, multiline = false) {
    const Tag = multiline ? "textarea" : "input";
    return <label><span>{label}</span><Tag value={settings[key] || ""} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} /></label>;
  }

  return (
    <section className="panel" id="storefront">
      <div className="panelHead">
        <div><span className="eyebrow">STOREFRONT AUTOMATION</span><h2>Control the merch experience</h2></div>
        <button className="secondary" onClick={load} disabled={loading}><RefreshCw size={17} /> Refresh</button>
      </div>

      {notice && <div className={`managerNotice ${notice.type}`}>{notice.type === "success" && <Check size={16} />} {notice.text}</div>}
      {loading ? <div className="managerEmpty"><LoaderCircle className="spin" /><span>Loading storefront…</span></div> : (
        <div className="storefrontLayout">
          <div className="storefrontEditor">
            <div className="storefrontFields">
              {field("shop_domain", "Shopify shop domain")}
              {field("announcement_text", "Announcement")}
              {field("hero_eyebrow", "Hero eyebrow")}
              {field("hero_headline", "Hero headline")}
              {field("hero_subheadline", "Hero message", true)}
              {field("primary_cta_label", "Primary button")}
              {field("primary_cta_url", "Primary button link")}
              {field("manifesto_headline", "Manifesto headline")}
              {field("manifesto_body", "Manifesto message", true)}
              {field("shipping_policy_title", "Shipping title")}
              {field("shipping_policy_body", "Shipping policy", true)}
              {field("returns_policy_title", "Returns title")}
              {field("returns_policy_body", "Returns policy", true)}
              {field("fulfillment_note", "Fulfillment note", true)}
              {field("collection_title", "Collection title")}
              {field("collection_handle", "Collection URL handle")}
              {field("collection_description", "Collection description", true)}
            </div>

            <div className="storefrontProducts">
              <div><strong>Featured products</strong><span>{selected.length}/8 selected</span></div>
              <div className="storefrontPicker">
                {products.filter((product) => product.status === "ACTIVE").map((product) => {
                  const checked = selected.some((item) => item.id === product.id);
                  return <button type="button" className={checked ? "selected" : ""} key={product.id} onClick={() => toggle(product)}>
                    {product.image ? <img src={product.image} alt="" /> : <ShoppingBag size={20} />}
                    <span>{product.title}<small>{product.productType || "tee"} · {product.minPrice ? `$${product.minPrice}` : "No price"}</small></span>
                    {checked && <Check size={16} />}
                  </button>;
                })}
              </div>
              <div className="storefrontOrder">
                {selectedProducts.map((product, index) => <div key={product.id}>
                  <b>{index + 1}</b><span>{product.displayTitle || product.title}</span>
                  <button onClick={() => move(index, -1)} disabled={index === 0}><ArrowUp size={14} /></button>
                  <button onClick={() => move(index, 1)} disabled={index === selectedProducts.length - 1}><ArrowDown size={14} /></button>
                </div>)}
              </div>
            </div>

            <div className="storefrontActions">
              <button className="secondary" onClick={save} disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} Save feed</button>
              <button onClick={syncCollection} disabled={syncing || !selected.length}>{syncing ? <LoaderCircle className="spin" size={17} /> : <ShoppingBag size={17} />} Sync Shopify collection</button>
            </div>
          </div>

            <div className="storefrontPreview">
              {brain && (
                <div className="merchBrainCard storefrontBrainCard">
                  <span className="eyebrow">MERCH BRAIN</span>
                  <h2>{brain.headline}</h2>
                  <p>{brain.summary}</p>
                  <small>{brain.nextAction}</small>
                </div>
              )}
              <span className="storefrontAnnouncement">{settings.announcement_text}</span>
              <small>{settings.hero_eyebrow}</small>
              <h3>{settings.hero_headline}</h3>
              <p>{settings.hero_subheadline}</p>
              <button>{settings.primary_cta_label}</button>
              <div className="storefrontMiniGrid">{selectedProducts.slice(0, 4).map((product) => <article key={product.id}>{product.image ? <img src={product.image} alt="" /> : <ShoppingBag />}<strong>{product.title}</strong></article>)}</div>
              <div className="storefrontPolicyPreview">
                <article>
                  <span>{settings.shipping_policy_title}</span>
                  <p>{settings.shipping_policy_body}</p>
                </article>
                <article>
                  <span>{settings.returns_policy_title}</span>
                  <p>{settings.returns_policy_body}</p>
                </article>
                <article>
                  <span>Fulfillment note</span>
                  <p>{settings.fulfillment_note}</p>
                </article>
              </div>
              <div className="feedLink"><code>{feedUrl}</code><button onClick={() => navigator.clipboard?.writeText(feedUrl)}><Copy size={14} /></button><a href={feedUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a></div>
            </div>
        </div>
      )}
    </section>
  );
}
