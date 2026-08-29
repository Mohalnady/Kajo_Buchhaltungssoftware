import { describe, expect, it } from "vitest";
import { skr03Startkonten } from "./skr03.ts";

describe("skr03Startkonten", () => {
  it("hat keine doppelten Kontonummern", () => {
    const konten = skr03Startkonten();
    const nummern = new Set(konten.map((k) => k.nr));
    expect(nummern.size).toBe(konten.length);
  });

  it("enthält die für Geldtransit und Gutscheine zentralen Konten", () => {
    const nummern = skr03Startkonten().map((k) => k.nr);
    expect(nummern).toContain("1360"); // Geldtransit
    expect(nummern).toContain("1700"); // Verbindlichkeit aus Gutscheinen
    expect(nummern).toContain("8195"); // Erlöse Kleinunternehmer § 19
  });

  it("sind alle Konten aktiv und haben nur gültige Steuersätze", () => {
    for (const k of skr03Startkonten()) {
      expect(k.aktiv).toBe(true);
      expect([0, 7, 19]).toContain(k.ust_satz);
    }
  });
});
