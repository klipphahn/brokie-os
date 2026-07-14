import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";

export const dynamic = "force-dynamic";

async function loadMerch() {
  const supabase = createSupabaseAdminClient();
  return loadStorefrontFeed(supabase);
}

function uniqueHighlights(products) {
  const seen = new Set();
  const highlights = [];

  for (const product of products) {
    const key = product.familyLabel || product.productType || product.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    highlights.push(product);
    if (highlights.length >= 3) break;
  }

  return highlights.length
    ? highlights
    : [
        {
          id: "default-apparel",
          familyLabel: "Core apparel",
          title: "Heavyweight tees and hoodies",
          fitNote: "Built for long days, late nights, and repeat wear.",
          story: "The foundation of the Brokie wardrobe.",
          badge: "APPAREL"
        },
        {
          id: "default-headwear",
          familyLabel: "Headwear",
          title: "Hats and caps",
          fitNote: "Easy everyday pieces with low-key branding.",
          story: "Clean pieces you can wear anywhere.",
          badge: "HEADWEAR"
        },
        {
          id: "default-stickers",
          familyLabel: "Small-format merch",
          title: "Stickers and extras",
          fitNote: "Little drops that spread the brand everywhere.",
          story: "For laptops, toolboxes, hard hats, and water bottles.",
          badge: "STICKER"
        }
      ];
}

function familyBucket(product) {
  return product.family || "apparel";
}

function familyLabel(product) {
  return product.familyLabel || "The Brokie";
}

function familySections(products) {
  const order = ["apparel", "headwear", "sticker"];
  const sections = new Map();

  for (const product of products) {
    const key = familyBucket(product);
    if (!sections.has(key)) {
      sections.set(key, []);
    }
    sections.get(key).push(product);
  }

  return order
    .filter((family) => sections.has(family))
    .map((family) => ({
      family,
      title:
        family === "headwear"
          ? "Headwear"
          : family === "sticker"
            ? "Small-format merch"
            : "Core apparel",
      description:
        family === "headwear"
          ? "Caps and hats that keep the Brokie mark low-key and wearable."
          : family === "sticker"
            ? "Small pieces that spread the brand across the things you already carry."
            : "The tees, hoodies, and layers that hold the main story.",
      products: sections.get(family)
    }));
}

function money(value, currency) {
  return value == null
    ? ""
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD"
      }).format(value);
}

export default async function MerchPage() {
  const { storefront, products } = await loadMerch();
  const highlights = uniqueHighlights(products);
  const sections = familySections(products);

  return (
    <main
      className="merchPage"
      style={{
        "--mp-bg": storefront.palette.background,
        "--mp-panel": storefront.palette.panel,
        "--mp-orange": storefront.palette.orange,
        "--mp-gold": storefront.palette.gold,
        "--mp-text": storefront.palette.text,
        "--mp-muted": storefront.palette.muted
      }}
    >
      <section className="merchHero">
        <div className="merchHeroCopy">
          <span className="merchEyebrow">{storefront.hero.eyebrow}</span>
          <h1>{storefront.hero.headline}</h1>
          <p>{storefront.hero.subheadline}</p>
          <div className="merchHeroActions">
            <a href={storefront.hero.primaryCta.url} className="merchPrimary">
              {storefront.hero.primaryCta.label}
            </a>
            <a href={storefront.hero.secondaryCta.url} className="merchSecondary">
              {storefront.hero.secondaryCta.label}
            </a>
          </div>
        </div>
        <div className="merchHeroPanel">
          <span>{storefront.announcement}</span>
          <strong>{storefront.manifesto.headline}</strong>
          <p>{storefront.manifesto.body}</p>
        </div>
      </section>

      <section className="merchSection">
        <div className="merchSectionHead">
          <div>
            <span className="merchEyebrow">FEATURED DROP</span>
            <h2>{storefront.collection.title}</h2>
            <p>{storefront.collection.description}</p>
          </div>
          <a href={storefront.collection.url} className="merchSecondary">
            SHOP ALL
          </a>
        </div>

        <div className="merchHighlights">
          {highlights.map((product) => (
            <article key={product.id} className="merchHighlight">
              <span>{product.familyLabel || "The Brokie"}</span>
              <strong>{product.title}</strong>
              <p>{product.fitNote || product.story || product.subtitle || ""}</p>
            </article>
          ))}
        </div>

        {sections.length ? sections.map((section) => (
          <div key={section.family} className="merchFamilySection">
            <div className="merchFamilyHead">
              <div>
                <span className="merchEyebrow">{section.title}</span>
                <p>{section.description}</p>
              </div>
            </div>
            <div className={`merchGrid merchGrid--${section.family}`}>
              {section.products.map((product) => (
                <article key={product.id} className={`merchCard merchCard--${familyBucket(product)}`}>
                  {product.badge ? <span className="merchBadge">{product.badge}</span> : null}
                  <a href={product.url} className="merchImage">
                    {product.image ? (
                      <img src={product.image} alt={product.imageAlt || product.title} />
                    ) : (
                      <div className="merchImageEmpty">The Brokie</div>
                    )}
                  </a>
                  <div className="merchBody">
                    <span className="merchFamily">{familyLabel(product)}</span>
                    <strong>{product.title}</strong>
                    <p>{product.fitNote || product.story || product.subtitle || ""}</p>
                    {product.cardLabel ? <small>{product.cardLabel}</small> : null}
                    <span>{money(product.price, product.currencyCode)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )) : (
            <div className="merchEmpty">The next drop is still building.</div>
          )}
      </section>

      <section className="merchPolicies">
        <article>
          <span>{storefront.policies.shipping.title}</span>
          <p>{storefront.policies.shipping.body}</p>
        </article>
        <article>
          <span>{storefront.policies.returns.title}</span>
          <p>{storefront.policies.returns.body}</p>
        </article>
        <article>
          <span>Fulfillment</span>
          <p>{storefront.policies.note}</p>
        </article>
      </section>

      <section className="merchStory">
        <article>
          <span>BUILT FOR</span>
          <h3>{storefront.manifesto.headline}</h3>
          <p>{storefront.manifesto.body}</p>
        </article>
        <article>
          <span>WHAT YOU GET</span>
          <p>
            Each drop is shaped around the product family—tees and hoodies
            get the main stage, hats stay lean, and stickers get a compact
            collector feel—so the listing copy, storefront cards, and merch
            page all stay in sync.
          </p>
        </article>
      </section>
    </main>
  );
}
