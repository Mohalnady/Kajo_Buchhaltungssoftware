import { describe, expect, it } from "vitest";
import { zeileZuKandidat } from "./importkandidaten.ts";
import { standardImportRegeln } from "./standardimportregeln.ts";
import type { ImportFeld } from "./import-parser.ts";

const regeln = standardImportRegeln();

describe("zeileZuKandidat", () => {
  it("erkennt eine Ausgabe über Stichwort und Zahlart", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = { datum: 0, betrag: 1, text: 2, zahlart: 3 };
    const k = zeileZuKandidat(["05.08.2026", "-950", "Miete August", "Überweisung"], zuordnung, regeln, []);
    expect(k.datum).toBe("2026-08-05");
    expect(k.betrag_brutto).toBe(950);
    expect(k.konto).toBe("4210");
    expect(k.gegenkonto).toBe("1200");
    expect(k.dublette).toBe(false);
    expect(k.uebernehmen).toBe(true);
  });

  it("erkennt eine Einnahme mit Kartenzahlung", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = { datum: 0, betrag: 1, text: 2, zahlart: 3 };
    const k = zeileZuKandidat(["06.08.2026", "340.10", "SumUp Kartenumsatz", "Karte"], zuordnung, regeln, []);
    expect(k.konto).toBe("1360");
    expect(k.gegenkonto).toBe("1210");
  });

  it("nutzt ohne Regeltreffer das Standardkonto je nach Vorzeichen", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = { datum: 0, betrag: 1, text: 2 };
    const einnahme = zeileZuKandidat(["01.08.2026", "10", "Sonstiges", ""], zuordnung, [], []);
    expect(einnahme.konto).toBe("8300");
    const ausgabe = zeileZuKandidat(["01.08.2026", "-10", "Sonstiges", ""], zuordnung, [], []);
    expect(ausgabe.konto).toBe("4980");
  });

  it("übernimmt Konto/Gegenkonto direkt beim Reimport der eigenen CSV", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = {
      datum: 0,
      betrag: 1,
      text: 2,
      konto: 3,
      gegenkonto: 4,
      ust: 5,
    };
    const k = zeileZuKandidat(["2026-08-01", "19.99", "Bonbons", "8300", "1000", "19"], zuordnung, [], []);
    expect(k.konto).toBe("8300");
    expect(k.gegenkonto).toBe("1000");
    expect(k.ust_satz).toBe(19);
  });

  it("erkennt Dubletten über Datum, Betrag und Text", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = { datum: 0, betrag: 1, text: 2 };
    const bestehende = [{ datum: "2026-08-01", betrag: 19.99, text: "Bonbons" }];
    const k = zeileZuKandidat(["01.08.2026", "19.99", "Bonbons"], zuordnung, [], bestehende);
    expect(k.dublette).toBe(true);
    expect(k.uebernehmen).toBe(false);
  });

  it("verbindet zwei Textspalten mit einem Trennzeichen", () => {
    const zuordnung: Partial<Record<ImportFeld, number>> = { datum: 0, betrag: 1, text: 2, text2: 3 };
    const k = zeileZuKandidat(["01.08.2026", "5", "Kartenzahlung", "Max Mustermann"], zuordnung, [], []);
    expect(k.text).toBe("Kartenzahlung — Max Mustermann");
  });
});
