import { describe, expect, it } from "vitest";
import { DATEV_SPALTEN, datevBuchungsstapel, datevKontonummer } from "./datev.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true, datev_konto: "3300" },
  { nr: "1000", name: "Kasse", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(teile: Partial<Buchung> & Pick<Buchung, "datum" | "konto" | "gegenkonto" | "betrag_brutto">): Buchung {
  return {
    id: `${teile.datum}-${teile.konto}-${teile.gegenkonto}`,
    text: "Test",
    ust_satz: 19,
    quelle: "manuell",
    storniert: false,
    ...teile,
  };
}

const daten = {
  beraterNr: 1001,
  mandantNr: 2,
  wjBeginn: "2026-01-01",
  kontoLaenge: 4,
  von: "2026-08-01",
  bis: "2026-08-31",
  bezeichnung: "Kontor-Export August 2026",
};

describe("datevBuchungsstapel", () => {
  it("hat zwei Kopfzeilen vor den Buchungszeilen", () => {
    const text = datevBuchungsstapel([], kontoVon, daten);
    const zeilen = text.trim().split("\r\n");
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toContain('"EXTF"');
    expect(zeilen[0]).toContain("700");
    expect(zeilen[1]).toBe(DATEV_SPALTEN.map((s) => `"${s}"`).join(";"));
  });

  it("jede Datenzeile hat exakt so viele Spalten wie die Kopfzeile", () => {
    const buchungen = [buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 100 })];
    const text = datevBuchungsstapel(buchungen, kontoVon, daten);
    const zeilen = text.trim().split("\r\n");
    expect(zeilen[2].split(";")).toHaveLength(DATEV_SPALTEN.length);
  });

  it("bucht bei einer Erlösbuchung das Gegenkonto als Soll-Konto und das Erlöskonto als Haben-Gegenkonto", () => {
    const buchungen = [buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 100 })];
    const zeilen = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n");
    const felder = zeilen[2].split(";");
    // Umsatz;S/H;WKZ;Konto;Gegenkonto;...
    expect(felder[0]).toBe("100,00");
    expect(felder[1]).toBe("S");
    expect(felder[3]).toBe("1000"); // Soll: Kasse (Gegenkonto der Buchung)
    expect(felder[4]).toBe("8400"); // Haben: Erlöskonto
  });

  it("bucht bei einer Aufwandsbuchung das Konto selbst als Soll-Konto", () => {
    const buchungen = [buchung({ datum: "2026-08-05", konto: "3300", gegenkonto: "1000", betrag_brutto: 50, text: "Wareneinkauf" })];
    const zeilen = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n");
    const felder = zeilen[2].split(";");
    expect(felder[3]).toBe("3300");
    expect(felder[4]).toBe("1000");
  });

  it("nutzt datev_konto als Kontonummer, wenn hinterlegt", () => {
    expect(datevKontonummer(konten[1], "3300")).toBe("3300");
    expect(datevKontonummer(undefined, "9999")).toBe("9999");
  });

  it("lässt stornierte Buchungen aus", () => {
    const buchungen = [
      buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 100 }),
      buchung({ datum: "2026-08-04", konto: "8400", gegenkonto: "1000", betrag_brutto: 200, storniert: true }),
    ];
    const zeilen = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n");
    expect(zeilen).toHaveLength(3); // 2 Kopfzeilen + 1 Buchung
  });

  it("sortiert Buchungszeilen chronologisch", () => {
    const buchungen = [
      buchung({ datum: "2026-08-10", konto: "8400", gegenkonto: "1000", betrag_brutto: 20, text: "Zweite" }),
      buchung({ datum: "2026-08-01", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, text: "Erste" }),
    ];
    const zeilen = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n");
    expect(zeilen[2]).toContain('"Erste"');
    expect(zeilen[3]).toContain('"Zweite"');
  });

  it("formatiert das Belegdatum als TTMM ohne Jahr", () => {
    const buchungen = [buchung({ datum: "2026-03-07", konto: "8400", gegenkonto: "1000", betrag_brutto: 10 })];
    const felder = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n")[2].split(";");
    expect(felder[6]).toBe("0703");
  });

  it("escaped Anführungszeichen im Buchungstext", () => {
    const buchungen = [buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, text: 'Verkauf "Sonderposten"' })];
    const zeile = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n")[2];
    expect(zeile).toContain('"Verkauf ""Sonderposten"""');
  });

  it("verwendet Komma als Dezimaltrennzeichen und immer positive Beträge", () => {
    const buchungen = [buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 1234.5 })];
    const felder = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n")[2].split(";");
    expect(felder[0]).toBe("1234,50");
  });

  it("überträgt die Kostenstelle in KOST1, falls vorhanden", () => {
    const buchungen = [buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, kostenstelle_id: "ks-laden" })];
    const felder = datevBuchungsstapel(buchungen, kontoVon, daten).trim().split("\r\n")[2].split(";");
    expect(felder[12]).toBe('"ks-laden"');
  });
});
