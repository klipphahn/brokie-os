import Image from "next/image";
import { FoundersBuilder } from "@/components/founders-builder";

export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="brandLockup">
          <Image src="/brokie-wordmark.png" width={520} height={210} alt="The Brokie" priority />
        </div>
        <div>
          <span className="kicker">BROKIE OS / FOUNDERS COLLECTION 001</span>
          <h1>Build the first drop.</h1>
          <p className="heroCopy">Start with the manifesto tee, validate it, then create the remaining Founders products.</p>
        </div>
        <div className="manifesto">
          <span>WE DON'T NEED MONEY</span>
          <strong>TO BE DANGEROUS.</strong>
        </div>
      </header>

      <section className="section">
        <div className="sectionHead">
          <div>
            <span className="kicker">COLLECTION BUILDER</span>
            <h2>Printful starter products</h2>
          </div>
          <div className="badge">APPROVAL REQUIRED</div>
        </div>
        <FoundersBuilder />
      </section>
    </main>
  );
}
