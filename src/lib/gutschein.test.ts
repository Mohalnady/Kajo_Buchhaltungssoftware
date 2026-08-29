import { describe, expect, it } from "vitest";
import { offenerBetrag, offeneGutscheinSumme } from "./gutschein.ts";
import type { Gutschein } from "./gutschein.ts";

describe("Gutschein", () => {
  it("berechnet den offenen Restbetrag", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 50, eingeloest_betrag: 20, status: "teilweise_eingeloest" };
    expect(offenerBetrag(g)).toBe(30);
  });

  it("summiert nur nicht vollständig eingelöste Gutscheine", () => {
    const gutscheine: Gutschein[] = [
      { nummer: "G-1", betrag: 50, eingeloest_betrag: 0, status: "offen" },
      { nummer: "G-2", betrag: 30, eingeloest_betrag: 30, status: "eingeloest" },
      { nummer: "G-3", betrag: 20, eingeloest_betrag: 5, status: "teilweise_eingeloest" },
    ];
    expect(offeneGutscheinSumme(gutscheine)).toBe(65);
  });
});
