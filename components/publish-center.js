import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";

const stages = [
  ["Brand assets approved", "ready"],
  ["Artwork hosted publicly", "waiting"],
  ["Printful product created", "waiting"],
  ["Shopify draft verified", "waiting"],
  ["Merch page linked", "waiting"]
];

export default function PublishCenter() {
  return (
    <section className="panel" id="publish">
      <div className="panelHead">
        <div>
          <span className="eyebrow">PUBLISH CENTER</span>
          <h2>From artwork to thebrokie.com/merch</h2>
        </div>
        <span className="approval">MANUAL APPROVAL ON</span>
      </div>

      <div className="publishGrid">
        <div className="launchChecklist">
          {stages.map(([label, state], index) => (
            <div key={label}>
              {state === "ready" ? <CheckCircle2 /> : <CircleDashed />}
              <span><b>{String(index + 1).padStart(2, "0")}</b>{label}</span>
            </div>
          ))}
        </div>

        <article className="merchDestination">
          <small>PUBLIC DESTINATION</small>
          <h3>thebrokie.com/merch</h3>
          <p>Your existing merch page remains the customer-facing storefront. Brokie OS manages product creation behind the scenes.</p>
          <a href="https://thebrokie.com/merch" target="_blank" rel="noreferrer">
            Open merch page <ExternalLink size={15} />
          </a>
        </article>
      </div>
    </section>
  );
}
