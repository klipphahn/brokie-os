"use client";

import { useState } from "react";
import { Sparkles, WandSparkles } from "lucide-react";

const ideas = [
  "Electrician drop built around power, current, and working overtime",
  "Creator collection for people building after midnight",
  "Blue-collar loyalty collection with understated front marks",
  "Dangerous collection centered on discipline instead of wealth"
];

export default function AiStudio() {
  const [prompt, setPrompt] = useState(ideas[0]);
  const [output, setOutput] = useState(null);

  function generate() {
    const clean = prompt.trim();
    if (!clean) return;
    setOutput({
      collection: clean.toLowerCase().includes("electric")
        ? "LIVE WIRE 001"
        : "STILL BUILDING 001",
      hero: clean.toLowerCase().includes("electric")
        ? "POWER IS EARNED."
        : "THE WORK CONTINUES.",
      products: [
        "Heavyweight statement tee",
        "Premium back-print hoodie",
        "Embroidered mascot hat",
        "Die-cut sticker pack",
        "Black insulated tumbler"
      ],
      voice: "Direct, gritty, focused, and consistent with The Brokie Brand DNA."
    });
  }

  return (
    <section className="panel" id="ai">
      <div className="panelHead">
        <div>
          <span className="eyebrow">AI STUDIO</span>
          <h2>Turn a concept into a collection plan</h2>
        </div>
        <WandSparkles className="orangeIcon" />
      </div>

      <div className="aiLayout">
        <div>
          <label>
            Collection prompt
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <div className="promptIdeas">
            {ideas.map((idea) => (
              <button className="promptChip" key={idea} onClick={() => setPrompt(idea)}>
                {idea}
              </button>
            ))}
          </div>
          <button onClick={generate}><Sparkles size={17} /> Generate collection plan</button>
        </div>

        <div className="aiOutput">
          {output ? (
            <>
              <small>PROPOSED COLLECTION</small>
              <h3>{output.collection}</h3>
              <blockquote>{output.hero}</blockquote>
              <p>{output.voice}</p>
              <div className="generatedList">
                {output.products.map((product, index) => (
                  <span key={product}><b>{String(index + 1).padStart(2, "0")}</b>{product}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="emptyOutput">
              <Sparkles size={30} />
              <strong>Your generated collection plan will appear here.</strong>
              <span>This version creates the strategy locally. Live AI generation comes next.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
