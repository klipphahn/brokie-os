import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadStorefrontFeed } from "@/lib/storefront-feed";

export const dynamic = "force-dynamic";

async function loadMerch() {
  const supabase = tryCreateSupabaseAdminClient();
  return loadStorefrontFeed(supabase);
}

function familyRankMap(order = []) {
  return new Map(order.map((family, index) => [family, index]));
}

function uniqueHighlights(products, familyOrder = []) {
  const seen = new Set();
  const highlights = [];
  const rank = familyRankMap(familyOrder);
  const sorted = [...(Array.isArray(products) ? products : [])].sort((left, right) => {
    const leftScore = Number(left.priorityScore || 0);
    const rightScore = Number(right.priorityScore || 0);
    if (leftScore !== rightScore) return rightScore - leftScore;

    const leftRank = rank.has(familyBucket(left)) ? rank.get(familyBucket(left)) : 99;
    const rightRank = rank.has(familyBucket(right)) ? rank.get(familyBucket(right)) : 99;
    if (leftRank !== rightRank) return leftRank - rightRank;

    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  for (const product of sorted) {
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

function familySections(products, familyOrder = []) {
  const order = [...familyOrder, "apparel", "headwear", "sticker"]
    .filter((value, index, array) => array.indexOf(value) === index);
  const sections = new Map();

  for (const product of Array.isArray(products) ? products : []) {
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

function spotlightFor(products, brain) {
  const queue = Array.isArray(products) ? products : [];
  const primary = queue.find(
    (product) => product.family === brain?.focusFamily?.key
  ) || queue[0];
  if (!primary) {
    return {
      title: brain?.headline || "Drop of the week",
      subtitle: brain?.nextAction || "Still building the next family release.",
      description:
        brain?.summary ||
        "When the next piece lands, this spotlight will promote the newest Brokie family first.",
      badge: "SPOTLIGHT",
      url: "/collections/all",
      image: null,
      imageAlt: "The Brokie spotlight"
    };
  }

  return {
    title: primary.title,
    subtitle:
      brain?.focusLabel ||
      primary.familyLabel ||
      primary.cardLabel ||
      "New this family",
    description:
      brain?.summary ||
      primary.story ||
      primary.fitNote ||
      primary.subtitle ||
      "The latest piece in the Brokie drop family.",
    badge: brain?.strongestPhrase || primary.badge || "SPOTLIGHT",
    url: primary.url,
    image: primary.image,
    imageAlt: primary.imageAlt || primary.title
  };
}

function money(value, currency) {
  return value == null
    ? ""
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD"
      }).format(value);
}

function currentDropStatus(product = {}) {
  const live = Boolean(product.onlineStorePublished || ["live", "active"].includes(String(product.status || "").toLowerCase()));
  const fulfilled = String(product.printful_status || "").toLowerCase() === "configured";

  if (live && fulfilled) {
    return {
      tone: "good",
      label: "LIVE + FULFILLED",
      detail: "Buy now. Printful is connected and the drop is ready to move."
    };
  }

  if (live) {
    return {
      tone: "warn",
      label: "LIVE ON SHOPIFY",
      detail: "The listing is public, but Printful still needs a final check."
    };
  }

  if (fulfilled) {
    return {
      tone: "warn",
      label: "PRINTFUL READY",
      detail: "Printful is set up. Shopify still needs the product turned on."
    };
  }

  return {
    tone: "muted",
    label: "BUILDING",
    detail: "This drop is still being prepared behind the scenes."
  };
}

export default async function MerchPage() {
  const { storefront, products, brain, launch } = await loadMerch();
  const highlights = uniqueHighlights(products, brain?.familyOrder);
  const sections = familySections(products, brain?.familyOrder);
  const spotlight = spotlightFor(products, brain);
  const currentDrop = products[0] || spotlight;
  const currentDropState = currentDropStatus(currentDrop);
  const heroHeadline = brain?.headline || storefront.hero.headline;
  const heroBody = brain?.summary || storefront.hero.subheadline;
  const collectionTitle = brain?.focusLabel
    ? `${brain.focusLabel} Collection`
    : storefront.collection.title;
  const collectionDescription = brain?.nextAction || storefront.collection.description;

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
      <section className="merchCurrentDrop">
        <div className="merchCurrentDropCopy">
          <span className="merchEyebrow">CURRENT DROP</span>
          <div className={`merchStatusStrip merchStatusStrip--${currentDropState.tone}`}>
            <strong>{currentDropState.label}</strong>
            <span>{currentDropState.detail}</span>
          </div>
          <h1>{currentDrop.title || heroHeadline}</h1>
          <p>{currentDrop.description || currentDrop.subtitle || heroBody}</p>
          <div className="merchHeroActions">
            <a href={currentDrop.url || storefront.collection.url} className="merchPrimary">
              SHOP NOW
            </a>
            <a href={storefront.collection.url} className="merchSecondary">
              VIEW ALL
            </a>
          </div>
        </div>
        <a href={currentDrop.url || storefront.collection.url} className="merchCurrentDropMedia">
          {currentDrop.image ? (
            <img src={currentDrop.image} alt={currentDrop.imageAlt || currentDrop.title} />
          ) : (
            <div className="merchImageEmpty">The Brokie</div>
          )}
        </a>
      </section>

      <section className="merchHero">
        <div className="merchHeroCopy">
          <span className="merchEyebrow">{storefront.hero.eyebrow}</span>
          <h1>{heroHeadline}</h1>
          <p>{heroBody}</p>
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
          <span>{brain?.northStar || storefront.announcement}</span>
          <strong>{brain?.strongestPhrase || storefront.manifesto.headline}</strong>
          <p>{brain?.nextAction || storefront.manifesto.body}</p>
        </div>
      </section>

      <section className="merchBrain">
        <article className="merchBrainCard">
          <span className="merchEyebrow">BRAND BRAIN</span>
          <h2>{brain?.headline || "Keep the brand moving."}</h2>
          <p>{brain?.summary || storefront.manifesto.body}</p>
          <div className="merchBrainMeta">
            <div>
              <span>North star</span>
              <strong>{brain?.northStar || storefront.manifesto.headline}</strong>
            </div>
            <div>
              <span>Focus family</span>
              <strong>{brain?.focusFamily?.label || "The Brokie"}</strong>
            </div>
            <div>
              <span>Focus product</span>
              <strong>{brain?.focusLabel || "Heavyweight Tee"}</strong>
            </div>
          </div>
          <div className="merchBrainLaunch">
            <span>Launch queue</span>
            <strong>{launch?.ready || 0} ready · {launch?.blocked || 0} blocked · {launch?.live || 0} live</strong>
          </div>
        </article>
        <article className="merchBrainNext">
          <span className="merchEyebrow">NEXT DROP</span>
          <strong>{brain?.strongestPhrase || storefront.manifesto.headline}</strong>
          <p>{brain?.nextAction || storefront.manifesto.body}</p>
          <small>{brain?.brandRule || storefront.policies.note}</small>
        </article>
      </section>

      <section className="merchSection">
        <div className="merchSectionHead">
          <div>
            <span className="merchEyebrow">FEATURED DROP</span>
            <h2>{collectionTitle}</h2>
            <p>{collectionDescription}</p>
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

        <div className="merchSpotlight">
          <div className="merchSpotlightCopy">
            <span>{spotlight.badge}</span>
            <h3>{spotlight.title}</h3>
            <strong>{spotlight.subtitle}</strong>
            <p>{spotlight.description}</p>
            <a href={spotlight.url} className="merchPrimary">
              SHOP THE SPOTLIGHT
            </a>
          </div>
          <a href={spotlight.url} className="merchSpotlightMedia">
            {spotlight.image ? (
              <img src={spotlight.image} alt={spotlight.imageAlt} />
            ) : (
              <div className="merchImageEmpty">The Brokie</div>
            )}
          </a>
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
          <h3>{brain?.northStar || storefront.manifesto.headline}</h3>
          <p>{brain?.summary || storefront.manifesto.body}</p>
        </article>
        <article>
          <span>WHAT YOU GET</span>
          <p>
            Each drop is shaped around the product family the brain thinks should
            move first—tees and hoodies get the main stage, hats stay lean, and
            stickers get a compact collector feel—so the listing copy,
            storefront cards, and merch page all stay in sync.
          </p>
        </article>
      </section>
    </main>
  );
}
