import { brandDna } from "@/lib/brand-dna";

export default function BrandDnaPanel() {
  return (
    <section className="panel dnaPanel" id="brand-dna">
      <div className="panelHead">
        <div>
          <span className="eyebrow">BRAND DNA</span>
          <h2>The rules behind every drop</h2>
        </div>
        <span className="livePill">ACTIVE SYSTEM</span>
      </div>

      <div className="dnaGrid">
        <article className="dnaStatement">
          <small>MISSION</small>
          <h3>{brandDna.mission}</h3>
          <p>{brandDna.manifesto}</p>
        </article>

        <article>
          <small>VOICE</small>
          <div className="chipWrap">
            {brandDna.voice.map((item) => <span className="chip" key={item}>{item}</span>)}
          </div>
        </article>

        <article>
          <small>CORE COLORS</small>
          <div className="swatches">
            {brandDna.colors.map((color) => (
              <div key={color.hex}>
                <span style={{ background: color.hex }} />
                <b>{color.name}</b>
                <small>{color.hex}</small>
              </div>
            ))}
          </div>
        </article>

        <article>
          <small>APPROVED PHRASES</small>
          <div className="phraseList">
            {brandDna.approvedPhrases.map((phrase) => <span key={phrase}>{phrase}</span>)}
          </div>
        </article>
      </div>
    </section>
  );
}
