import { describe, expect, it } from "vitest";
import { monatsReihe } from "./diagramme.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true },
  { nr: "4100", name: "Löhne", typ: "aufwand", ust_satz: 0, bwa_gruppe: "personal", aktiv: true },
  { nr: "1200", name: "Bank", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(datum: string, konto: string, betrag: number, ust = 19): Buchung {
  return { id: `${datum}-${konto}-${betrag}`, datum, text: "Test", konto, gegenkonto: "1200", betrag_brutto: betrag, ust_satz: ust, quelle: "manuell", storniert: false };
}

describe("monatsReihe", () => {
  it("liefert genau anzahlMonate Einträge in aufsteigender Reihenfolge, bis einschließlich bisMonat", () => {
    const reihe = monatsReihe([], kontoVon, false, "soll", "2026-08", 3);
    expect(reihe.map((r) => r.monat)).toEqual(["2026-06", "2026-07", "2026-08"]);
  });

  it("summiert Umsatz, Kosten und Personalkosten je Monat netto", () => {
    const buchungen = [
      buchung("2026-08-01", "8400", 1190, 19), // 1000 netto Umsatz
      buchung("2026-08-02", "3300", 107, 7), // 100 netto Kosten
      buchung("2026-08-03", "4100", 500, 0), // 500 netto Personalkosten (auch Kosten)
    ];
    const reihe = monatsReihe(buchungen, kontoVon, false, "soll", "2026-08", 1);
    expect(reihe[0].umsatz).toBe(1000);
    expect(reihe[0].kosten).toBe(600);
    expect(reihe[0].personalkosten).toBe(500);
    expect(reihe[0].ergebnis).toBe(400);
  });

  it("liefert 0-Werte für Monate ohne Buchungen", () => {
    const buchungen = [buchung("2026-08-01", "8400", 1190, 19)];
    const reihe = monatsReihe(buchungen, kontoVon, false, "soll", "2026-08", 2);
    expect(reihe[0].monat).toBe("2026-07");
    expect(reihe[0].umsatz).toBe(0);
    expect(reihe[1].umsatz).toBe(1000);
  });

  it("berechnet die USt-Zahllast je Monat korrekt", () => {
    const buchungen = [buchung("2026-08-01", "8400", 1190, 19)];
    const reihe = monatsReihe(buchungen, kontoVon, false, "soll", "2026-08", 1);
    expect(reihe[0].ustZahllast).toBe(190);
  });

  it("ignoriert stornierte Buchungen", () => {
    const buchungen = [{ ...buchung("2026-08-01", "8400", 1190, 19), storniert: true }];
    const reihe = monatsReihe(buchungen, kontoVon, false, "soll", "2026-08", 1);
    expect(reihe[0].umsatz).toBe(0);
  });
});
