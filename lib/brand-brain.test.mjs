import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBrandBrain } from "./brand-brain.js";

describe("buildBrandBrain", () => {
  it("counts embroidery hats as headwear using their full product identity", () => {
    const brain = buildBrandBrain({
      products: [
        {
          title: "The Brokie Together We Win Tee",
          productType: "T-SHIRT"
        },
        {
          title: "Brokie Signature Embroidered Snapback",
          productType: "EMBROIDERY"
        },
        {
          title: "Trucker Cap",
          productType: "EMBROIDERY"
        }
      ]
    });

    assert.deepEqual(brain.signals.familyCounts, {
      apparel: 1,
      headwear: 2
    });
  });
});
