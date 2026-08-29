import { describe, expect, it } from "vitest";
import { geldtransitGebuehrVorschlag } from "./geldtransit.ts";

describe("geldtransitGebuehrVorschlag", () => {
  it("berechnet die Dienstleistergebühr als Differenz von Kassen- und Bankseite", () => {
    const v = geldtransitGebuehrVorschlag(500, 490.25);
    expect(v.gebuehr).toBe(9.75);
  });

  it("liefert 0 Gebühr, wenn Kasse und Bank exakt übereinstimmen", () => {
    const v = geldtransitGebuehrVorschlag(300, 300);
    expect(v.gebuehr).toBe(0);
  });
});
