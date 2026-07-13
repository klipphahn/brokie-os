"use client";

import dynamic from "next/dynamic";

const DesignFactory = dynamic(
  () => import("@/components/design-factory"),
  {
    ssr: false,
    loading: () => (
      <section className="panel" id="factory">
        <div className="panelHead">
          <div>
            <span className="eyebrow">DESIGN FACTORY V2.2</span>
            <h2>Loading Design Factory…</h2>
          </div>
        </div>
      </section>
    )
  }
);

export default function DesignFactoryLoader() {
  return <DesignFactory />;
}
