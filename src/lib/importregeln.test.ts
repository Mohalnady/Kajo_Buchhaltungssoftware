import { describe, expect, it } from "vitest";
import { regelKonto } from "./importregeln.ts";

const REGELN = [
  { stichwoerter: "sumup,kartenumsatz", konto: "1360" },
  { stichwoerter: "miete,pacht", konto: "4210" },
];

describe("regelKonto", () => {
  it("findet das Konto über ein Stichwort, unabhängig von Groß-/Kleinschreibung", () => {
    expect(regelKonto("SumUp Kartenabrechnung", REGELN, 1)).toBe("1360");
  });

  it("prüft mehrere Stichwörter je Regel", () => {
    expect(regelKonto("Pacht Ladenlokal August", REGELN, -1)).toBe("4210");
  });

  it("fällt bei positivem Betrag auf 8300 zurück, wenn keine Regel greift", () => {
    expect(regelKonto("Unbekannter Text", REGELN, 1)).toBe("8300");
  });

  it("fällt bei negativem Betrag auf 4980 zurück, wenn keine Regel greift", () => {
    expect(regelKonto("Unbekannter Text", REGELN, -1)).toBe("4980");
  });

  it("nimmt die erste passende Regel bei mehreren Treffern", () => {
    const regeln = [
      { stichwoerter: "shop", konto: "AAAA" },
      { stichwoerter: "shop,kasse", konto: "BBBB" },
    ];
    expect(regelKonto("Shop Kasse Tageseinnahme", regeln, 1)).toBe("AAAA");
  });
});
