import { describe, expect, it } from "vitest";
import { euerBericht } from "./euer.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true, euer_zeile: 14 },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true, euer_zeile: 23 },
  { nr: "4980", name: "Sonstiger Bedarf", typ: "aufwand", ust_satz: 19, bwa_gruppe: "sonst", aktiv: true },
  { nr: "1200", name: "Bank", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
  { nr: "1800", name: "Privatentnahme", typ: "privat", ust_satz: 0, bwa_gruppe: "", aktiv: true },
  { nr: "1890", name: "Privateinlage", typ: "privat", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(datum: string, konto: string, gegenkonto: string, betrag: number, ust = 19, wertstellung?: string): Buchung {
  return { id: `${datum}-${konto}-${betrag}`, datum, wertstellung, text: "Test", konto, gegenkonto, betrag_brutto: betrag, ust_satz: ust, quelle: "manuell", storniert: false };
}

describe("euerBericht", () => {
  it("summiert Einnahmen und Ausgaben netto und berechnet den Gewinn", () => {
    const buchungen = [
      buchung("2026-08-01", "8400", "1200", 1190, 19), // 1000 netto
      buchung("2026-08-02", "3300", "1200", 107, 7), // 100 netto
      buchung("2026-08-03", "4980", "1200", 119, 19), // 100 netto, ohne euer_zeile
    ];
    const bericht = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    expect(bericht.summeEinnahmen).toBe(1000);
    expect(bericht.summeAusgaben).toBe(200);
    expect(bericht.gewinn).toBe(800);
  });

  it("sortiert nach euer_zeile und schiebt unzugeordnete Konten ans Ende", () => {
    const buchungen = [
      buchung("2026-08-02", "3300", "1200", 107, 7),
      buchung("2026-08-03", "4980", "1200", 119, 19),
      buchung("2026-08-01", "8400", "1200", 1190, 19),
    ];
    const bericht = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    expect(bericht.zeilen.map((z) => z.konto)).toEqual(["8400", "3300", "4980"]);
  });

  it("richtet sich nach dem Zahlungsdatum (wertstellung), nicht dem Rechnungsdatum", () => {
    const buchungen = [buchung("2026-07-28", "8400", "1200", 1190, 19, "2026-08-02")];
    const imJuli = euerBericht(buchungen, kontoVon, false, "2026-07-01", "2026-07-31");
    const imAugust = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    expect(imJuli.summeEinnahmen).toBe(0);
    expect(imAugust.summeEinnahmen).toBe(1000);
  });

  it("weist Privatentnahme und -einlage getrennt aus, ohne den Gewinn zu beeinflussen", () => {
    const buchungen = [
      buchung("2026-08-01", "8400", "1200", 1190, 19),
      buchung("2026-08-05", "1800", "1200", 300, 0),
      buchung("2026-08-06", "1890", "1200", 150, 0),
    ];
    const bericht = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    expect(bericht.gewinn).toBe(1000);
    expect(bericht.privatZeilen).toEqual([
      { konto: "1800", name: "Privatentnahme", betrag: 300 },
      { konto: "1890", name: "Privateinlage", betrag: 150 },
    ]);
  });

  it("ignoriert stornierte Buchungen", () => {
    const buchungen = [{ ...buchung("2026-08-01", "8400", "1200", 1190, 19), storniert: true }];
    const bericht = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    expect(bericht.summeEinnahmen).toBe(0);
  });
});
