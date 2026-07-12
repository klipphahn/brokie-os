"use client";

import { useState } from "react";
import {
  Download,
  ExternalLink,
  LoaderCircle,
  Sparkles,
  WandSparkles
} from "lucide-react";

const ideas = [
  "Create a heavyweight electrician tee for people who outwork everyone. Use power, current, and overtime themes.",
  "Create a blue-collar dad hoodie about building a better life even when money is tight.",
  "Create a minimal loyalty tee with a small front mark and a bold premium back print.",
  "Create a dangerous collection design centered on discipline, focus, and refusing to quit."
];

export default function AiStudio() {
  const [prompt, setPrompt] = useState(ideas[0]);
  const [productType, setProductType] = useState("Heavyweight Tee");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, productType })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Generation failed.");
      }
      setResult(data);
    } catch (generationError) {
      setError(generationError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadArtwork() {
    if (!result?.image?.dataUrl) return;
    const link = document.createElement("a");
    link.href = result.image.dataUrl;
    link.download = `${result.concept.concept_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  }

  return (
    <section className="panel" id="ai">
      <div className="panelHead">
        <div>
          <span className="eyebrow">AI PRODUCT STUDIO</span>
          <h2>Generate real artwork and product copy</h2>
        </div>
        <WandSparkles className="orangeIcon" />
      </div>

      <div className="aiLiveLayout">
        <div className="aiControls">
          <label>
            Product type
            <select value={productType} onChange={(event) => setProductType(event.target.value)}>
              <option>Heavyweight Tee</option>
              <option>Premium Hoodie</option>
              <option>Oversized Tee</option>
              <option>Embroidered Hat</option>
              <option>Sticker</option>
            </select>
          </label>

          <label>
            Describe the product
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Create a heavyweight tee for electricians..."
            />
          </label>

          <div className="promptIdeas">
            {ideas.map((idea) => (
              <button
                className="promptChip"
                type="button"
                key={idea}
                onClick={() => setPrompt(idea)}
              >
                {idea}
              </button>
            ))}
          </div>

          <button onClick={generate} disabled={loading || prompt.trim().length < 10}>
            {loading ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {loading ? "Building concept and artwork…" : "Generate product concept"}
          </button>

          <p className="aiCostNote">
            Each run uses both a text-model request and an image-generation request.
          </p>

          {error && <div className="managerNotice error">{error}</div>}
        </div>

        <div className="aiLiveOutput">
          {loading ? (
            <div className="generationState">
              <LoaderCircle className="spin" size={34} />
              <strong>Building with Brand DNA…</strong>
              <span>Writing the product plan, generating transparent artwork, and saving it to your library.</span>
            </div>
          ) : result ? (
            <>
              <div className="generatedArtwork">
                <img src={result.image.dataUrl} alt={result.concept.concept_name} />
              </div>

              <div className="generatedHeader">
                <div>
                  <small>{result.concept.collection_name}</small>
                  <h3>{result.concept.concept_name}</h3>
                </div>
                <span className={result.image.savedToSupabase ? "savedPill" : "previewPill"}>
                  {result.image.savedToSupabase ? "SAVED TO LIBRARY" : "PREVIEW ONLY"}
                </span>
              </div>

              <blockquote>{result.concept.headline}</blockquote>

              <div className="copyGrid">
                <article>
                  <small>PRODUCT TITLE</small>
                  <strong>{result.concept.product_title}</strong>
                </article>
                <article>
                  <small>RETAIL PRICE</small>
                  <strong>${Number(result.concept.retail_price).toFixed(2)}</strong>
                </article>
              </div>

              <p className="generatedDescription">{result.concept.product_description}</p>

              <div className="generatedTags">
                {result.concept.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className="generatedActions">
                <button onClick={downloadArtwork}>
                  <Download size={16} /> Download PNG
                </button>
                {result.image.publicUrl && (
                  <a href={result.image.publicUrl} target="_blank" rel="noreferrer">
                    Public artwork URL <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </>
          ) : (
            <div className="emptyOutput">
              <Sparkles size={32} />
              <strong>Your first generated product will appear here.</strong>
              <span>The result includes transparent artwork, title, description, SEO copy, tags, and pricing.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
