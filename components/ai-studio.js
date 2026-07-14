"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Flame,
  Heart,
  LoaderCircle,
  Sparkles
} from "lucide-react";
import JobQueue from "@/components/job-queue";
import {
  audiences,
  foundryPresets,
  moods,
  palettes,
  placements,
  productTypes,
  visualStyles
} from "@/lib/foundry-options";

const labels = [
  "Reading creative direction",
  "Applying Brand DNA",
  "Writing product concepts",
  "Generating front + back artwork",
  "Building product mockups",
  "Saving approved assets"
];

const initialState = {
  productType: "Heavyweight Tee",
  audience: "Union electricians",
  style: "Premium graffiti",
  mood: "Relentless",
  placement: "Small left chest + large back",
  palette: "brokie-core",
  variations: 2,
  prompt:
    "Create a product for people who outwork everyone. Use power, current, overtime, and pride in skilled work."
};

export default function AiStudio() {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const [favorites, setFavorites] = useState({});
  const [error, setError] = useState("");
  const [stages, setStages] = useState([]);

  const palette = useMemo(
    () => palettes.find((item) => item.id === form.palette) || palettes[0],
    [form.palette]
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset) {
    setForm((current) => ({
      ...current,
      audience: preset.audience,
      style: preset.style,
      mood: preset.mood,
      placement: preset.placement,
      palette: preset.palette,
      prompt: preset.prompt
    }));
  }

  async function generate() {
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(0);
    setStages(
      labels.map((label, index) => ({
        label,
        status: index === 0 ? "active" : "pending"
      }))
    );

    const timer = setInterval(() => {
      setStages((current) => {
        const active = current.findIndex((item) => item.status === "active");
        if (active < 0 || active >= current.length - 1) return current;
        return current.map((item, index) =>
          index === active
            ? { ...item, status: "done" }
            : index === active + 1
              ? { ...item, status: "active" }
              : item
        );
      });
    }, 5000);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          colors: palette.colors
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Generation failed.");
      }

      setResults(data.results || []);
      setStages(labels.map((label) => ({ label, status: "done" })));
      window.dispatchEvent(new Event("brokie-design-created"));
    } catch (generationError) {
      setError(generationError.message);
      setStages((current) =>
        current.map((item) =>
          item.status === "active" ? { ...item, status: "error" } : item
        )
      );
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  function downloadAsset(result, side) {
    const asset = result?.artwork?.[side];
    if (!asset?.dataUrl) return;
    const link = document.createElement("a");
    link.href = asset.dataUrl;
    link.download = `${result.concept.concept_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${side}-print.png`;
    link.click();
  }

  const current = results[selected];

  return (
    <section className="panel foundryTwo" id="ai">
      <div className="panelHead">
        <div>
          <span className="eyebrow">FOUNDRY 2.0</span>
          <h2>Direct the creative team</h2>
        </div>
        <Flame className="orangeIcon" />
      </div>

      <div className="presetStrip">
        <span>STARTING PRESETS</span>
        {foundryPresets.map((preset) => (
          <button
            type="button"
            className="promptChip"
            key={preset.name}
            onClick={() => applyPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="foundryWorkbench">
        <div className="foundryControls">
          <div className="controlGrid">
            <label>
              Product
              <select
                value={form.productType}
                onChange={(event) => update("productType", event.target.value)}
              >
                {productTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              Audience
              <select
                value={form.audience}
                onChange={(event) => update("audience", event.target.value)}
              >
                {audiences.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              Visual style
              <select
                value={form.style}
                onChange={(event) => update("style", event.target.value)}
              >
                {visualStyles.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              Mood
              <select
                value={form.mood}
                onChange={(event) => update("mood", event.target.value)}
              >
                {moods.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label className="wideControl">
              Print placement
              <select
                value={form.placement}
                onChange={(event) => update("placement", event.target.value)}
              >
                {placements.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>

            <label>
              Variations
              <select
                value={form.variations}
                onChange={(event) =>
                  update("variations", Number(event.target.value))
                }
              >
                <option value={1}>1 — lowest cost</option>
                <option value={2}>2 — recommended</option>
                <option value={4}>4 — full exploration</option>
              </select>
            </label>
          </div>

          <label>
            Creative direction
            <textarea
              value={form.prompt}
              onChange={(event) => update("prompt", event.target.value)}
            />
          </label>

          <div className="palettePicker">
            <span>COLOR SYSTEM</span>
            <div>
              {palettes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={form.palette === item.id ? "activePalette" : ""}
                  onClick={() => update("palette", item.id)}
                >
                  <span className="miniSwatches">
                    {item.colors.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <button
            className="forgeButton"
            onClick={generate}
            disabled={loading || form.prompt.trim().length < 10}
          >
            {loading ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}
            {loading
              ? `Forging ${form.variations} variation${form.variations > 1 ? "s" : ""}…`
              : `Forge ${form.variations} variation${form.variations > 1 ? "s" : ""}`}
          </button>

          <p className="aiCostNote">
            Each variation creates coordinated front and back print files plus
            two product mockups. Start with one, then explore more when the
            direction is promising.
          </p>

          {error && <div className="managerNotice error">{error}</div>}
        </div>

        <div className="foundryResults">
          {results.length ? (
            <>
              <div className="variationTabs">
                {results.map((result, index) => (
                  <button
                    type="button"
                    className={selected === index ? "activeVariation" : ""}
                    onClick={() => setSelected(index)}
                    key={`${result.concept.concept_name}-${index}`}
                  >
                    <span>0{index + 1}</span>
                    {result.concept.concept_name}
                    {favorites[index] && <Heart size={13} fill="currentColor" />}
                  </button>
                ))}
              </div>

              <div className="conceptCompare">
                {results.map((result, index) => (
                  <button
                    type="button"
                    className={`conceptThumb ${selected === index ? "selectedThumb" : ""}`}
                    onClick={() => setSelected(index)}
                    key={result.mockups?.back?.publicUrl || result.image.publicUrl || index}
                  >
                    <img
                      src={result.mockups?.back?.dataUrl || result.image.dataUrl}
                      alt={result.concept.concept_name}
                    />
                    <span>{result.concept.headline}</span>
                    {selected === index && <Check size={16} />}
                  </button>
                ))}
              </div>

              {current && (
                <article className="selectedConcept">
                  <div className="selectedArtwork mockupPair">
                    <figure>
                      <img
                        src={current.mockups?.front?.dataUrl || current.image.dataUrl}
                        alt={`${current.concept.concept_name} front`}
                      />
                      <figcaption>FRONT</figcaption>
                    </figure>
                    <figure>
                      <img
                        src={current.mockups?.back?.dataUrl || current.image.dataUrl}
                        alt={`${current.concept.concept_name} back`}
                      />
                      <figcaption>BACK</figcaption>
                    </figure>
                  </div>

                  <div className="selectedCopy">
                    <div className="generatedHeader">
                      <div>
                        <small>{current.concept.collection_name}</small>
                        <h3>{current.concept.concept_name}</h3>
                      </div>
                      <button
                        className={`favoriteButton ${favorites[selected] ? "favorited" : ""}`}
                        onClick={() =>
                          setFavorites((value) => ({
                            ...value,
                            [selected]: !value[selected]
                          }))
                        }
                      >
                        <Heart
                          size={17}
                          fill={favorites[selected] ? "currentColor" : "none"}
                        />
                      </button>
                    </div>

                    <blockquote>{current.concept.headline}</blockquote>

                    <div className="copyGrid">
                      <article>
                        <small>PRODUCT TITLE</small>
                        <strong>{current.concept.product_title}</strong>
                      </article>
                      <article>
                        <small>RETAIL PRICE</small>
                        <strong>
                          ${Number(current.concept.retail_price).toFixed(2)}
                        </strong>
                      </article>
                    </div>

                    <p className="generatedDescription">
                      {current.concept.product_description}
                    </p>

                    <div className="generatedTags">
                      {current.concept.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>

                    <div className="generatedActions">
                      <button onClick={() => downloadAsset(current, "front")}>
                        <Download size={16} /> Front print PNG
                      </button>
                      <button onClick={() => downloadAsset(current, "back")}>
                        <Download size={16} /> Back print PNG
                      </button>
                      {current.artwork?.back?.publicUrl && (
                        <a
                          href={current.artwork.back.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Back artwork URL <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              )}
            </>
          ) : (
            <div className="emptyOutput">
              <Flame size={36} />
              <strong>Your creative direction becomes a product system.</strong>
              <span>
                Pick the product, audience, visual language, placement, palette,
                and number of concepts. Foundry will save each result to the
                Design Library.
              </span>
            </div>
          )}
        </div>
      </div>

      <JobQueue stages={stages} running={loading} />
    </section>
  );
}
