import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_STOREFRONT_SETTINGS,
  STOREFRONT_KEY,
  storefrontPublicSettings
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

async function loadMerch() {
  const supabase = createSupabaseAdminClient();
  const [
    { data: settings, error: settingsError },
    { data: featured, error: featuredError }
  ] = await Promise.all([
    supabase
      .from("storefront_settings")
      .select("*")
      .eq("key", STOREFRONT_KEY)
      .maybeSingle(),
    supabase
      .from("storefront_featured_products")
      .select("*")
      .eq("active", true)
      .order("position")
  ]);

  if (settingsError) throw settingsError;
  if (featuredError) throw featuredError;

  const rawSettings = settings || DEFAULT_STOREFRONT_SETTINGS;
  const storefront = storefrontPublicSettings(rawSettings);
  const products = (featured || []).map((row) => ({
    id: row.shopify_product_id,
    title: row.display_title || row.product_title,
    subtitle: row.display_subtitle,
    badge: row.badge,
    url:
      row.product_url ||
      `https://${storefront.shopDomain}/products/${row.product_handle}`,
    image: row.image_url,
    imageAlt: row.image_alt || row.product_title,
    price: row.min_price === null ? null : Number(row.min_price),
    maxPrice: row.max_price === null ? null : Number(row.max_price),
    currencyCode: row.currency_code,
    position: row.position
  }));

  return { storefront, products };
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

        <div className="merchGrid">
          {products.length ? (
            products.map((product) => (
              <article key={product.id} className="merchCard">
                {product.badge ? <span className="merchBadge">{product.badge}</span> : null}
                <a href={product.url} className="merchImage">
                  {product.image ? (
                    <img src={product.image} alt={product.imageAlt || product.title} />
                  ) : (
                    <div className="merchImageEmpty">The Brokie</div>
                  )}
                </a>
                <div className="merchBody">
                  <strong>{product.title}</strong>
                  <p>{product.subtitle || ""}</p>
                  <span>{money(product.price, product.currencyCode)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="merchEmpty">The next drop is still building.</div>
          )}
        </div>
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
    </main>
  );
}
