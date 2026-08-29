import { describe, expect, it } from "vitest";
import { bwaBericht, monatVerschieben, summenNachGruppe } from "./bwa.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true },
  { nr: "4210", name: "Miete", typ: "aufwand", ust_satz: 0, bwa_gruppe: "raum", aktiv: true },
  { nr: "1200", name: "Bank", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
  { nr: "2700", name: "Sonstige Erträge", typ: "erloes", ust_satz: 0, bwa_gruppe: "neutral", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(datum: string, konto: string, gegenkonto: string, betrag: number, ust = 19): Buchung {
  return { id: `${datum}-${konto}-${betrag}`, datum, text: "Test", konto, gegenkonto, betrag_brutto: betrag, ust_satz: ust, quelle: "manuell", storniert: false };
}

describe("monatVerschieben", () => {
  it("geht über Jahresgrenzen zurück", () => {
    expect(monatVerschieben("2026-01", -1)).toBe("2025-12");
    expect(monatVerschieben("2026-08", -12)).toBe("2025-08");
  });
});

describe("summenNachGruppe", () => {
  it("zählt Erlöse positiv und Aufwand negativ, jeweils netto", () => {
    const buchungen = [buchung("2026-08-01", "8400", "1200", 1190, 19), buchung("2026-08-02", "3300", "1200", 107, 7)];
    const summen = summenNachGruppe(buchungen, kontoVon, false);
    expect(summen.umsatz).toBe(1000);
    expect(summen.ware).toBe(-100);
  });

  it("ignoriert stornierte Buchungen und Konten ohne bwa_gruppe", () => {
    const buchungen = [
      { ...buchung("2026-08-01", "8400", "1200", 1190, 19), storniert: true },
      buchung("2026-08-01", "1200", "8400", 50, 0),
    ];
    const summen = summenNachGruppe(buchungen, kontoVon, false);
    expect(summen.umsatz).toBeUndefined();
  });
});

describe("bwaBericht", () => {
  const buchungen: Buchung[] = [
    buchung("2026-08-05", "8400", "1200", 1190, 19), // Umsatz August: 1000 netto
    buchung("2026-08-06", "3300", "1200", 107, 7), // Ware August: -100 netto
    buchung("2026-08-07", "4210", "1200", 200, 0), // Miete August: -200
    buchung("2026-07-05", "8400", "1200", 595, 19), // Vormonat Umsatz: 500 netto
    buchung("2025-08-05", "8400", "1200", 238, 19), // Vorjahresmonat Umsatz: 200 netto
    buchung("2026-01-10", "8400", "1200", 119, 19), // Jahresanfang Umsatz: 100 netto
  ];

  it("berechnet Rohertrag als Umsatz plus Wareneinsatz", () => {
    const bericht = bwaBericht(buchungen, kontoVon, false, "2026-08");
    expect(bericht.rohertrag.monat).toBe(900); // 1000 - 100
    expect(bericht.rohertrag.vormonat).toBe(500);
    expect(bericht.rohertrag.vorjahresmonat).toBe(200);
  });

  it("berechnet Betriebsergebnis nach Abzug der Miete", () => {
    const bericht = bwaBericht(buchungen, kontoVon, false, "2026-08");
    expect(bericht.betriebsergebnis.monat).toBe(700); // 900 - 200
  });

  it("kumuliert das Jahr bis einschließlich des gewählten Monats", () => {
    const bericht = bwaBericht(buchungen, kontoVon, false, "2026-08");
    const umsatzZeile = bericht.zeilen.find((z) => z.gruppe === "umsatz")!;
    expect(umsatzZeile.jahrKumuliert).toBe(1600); // 100 (Januar) + 500 (Juli) + 1000 (August)
  });

  it("berechnet Prozent vom Umsatz je Zeile", () => {
    const bericht = bwaBericht(buchungen, kontoVon, false, "2026-08");
    const wareZeile = bericht.zeilen.find((z) => z.gruppe === "ware")!;
    expect(wareZeile.prozentUmsatz).toBe(-10); // -100 / 1000 * 100
  });

  it("liefert 0 Prozent, wenn im Monat kein Umsatz anfiel", () => {
    const bericht = bwaBericht([], kontoVon, false, "2026-08");
    expect(bericht.zeilen[0].prozentUmsatz).toBe(0);
  });
});
