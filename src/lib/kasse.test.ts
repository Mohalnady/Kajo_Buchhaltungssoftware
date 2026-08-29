import { describe, expect, it } from "vitest";
import { kassenstand, kassenverlauf } from "./kasse.ts";
import type { Buchung, Konto } from "./types.ts";

const KONTEN: Konto[] = [
  { nr: "8400", name: "Erlöse", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneingang", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true },
  { nr: "1890", name: "Privateinlage", typ: "privat", ust_satz: 0, bwa_gruppe: "", aktiv: true },
  { nr: "1800", name: "Privatentnahme", typ: "privat", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => KONTEN.find((k) => k.nr === nr);

function buchung(overrides: Partial<Buchung>): Buchung {
  return {
    id: "1",
    datum: "2026-07-01",
    text: "Test",
    konto: "8400",
    gegenkonto: "1000",
    betrag_brutto: 100,
    ust_satz: 19,
    quelle: "manuell",
    storniert: false,
    ...overrides,
  };
}

describe("kassenverlauf / kassenstand (Kassenbuch)", () => {
  it("erhöht den Bestand bei Erlösen und Privateinlage, senkt ihn sonst", () => {
    const list = [
      buchung({ id: "1", datum: "2026-07-01", konto: "8400", betrag_brutto: 100 }),
      buchung({ id: "2", datum: "2026-07-02", konto: "3300", betrag_brutto: 30 }),
      buchung({ id: "3", datum: "2026-07-03", konto: "1890", betrag_brutto: 20 }),
      buchung({ id: "4", datum: "2026-07-04", konto: "1800", betrag_brutto: 10 }),
    ];
    const verlauf = kassenverlauf(list, 0, "1000", kontoVon);
    expect(verlauf.map((z) => z.bestand)).toEqual([100, 70, 90, 80]);
  });

  it("markiert einen rechnerisch negativen Bestand deutlich", () => {
    const list = [buchung({ id: "1", konto: "3300", betrag_brutto: 200 })];
    const verlauf = kassenverlauf(list, 50, "1000", kontoVon);
    expect(verlauf[0].bestand).toBe(-150);
    expect(verlauf[0].negativ).toBe(true);
  });

  it("sortiert chronologisch unabhängig von der Eingabereihenfolge", () => {
    const list = [
      buchung({ id: "2", datum: "2026-07-02", konto: "3300", betrag_brutto: 10 }),
      buchung({ id: "1", datum: "2026-07-01", konto: "8400", betrag_brutto: 100 }),
    ];
    const verlauf = kassenverlauf(list, 0, "1000", kontoVon);
    expect(verlauf[0].buchung.id).toBe("1");
    expect(verlauf[1].buchung.id).toBe("2");
  });

  it("ignoriert Buchungen auf ein anderes Gegenkonto (Bar/Karte getrennt)", () => {
    const list = [
      buchung({ id: "1", gegenkonto: "1210", konto: "8400", betrag_brutto: 500 }),
      buchung({ id: "2", gegenkonto: "1000", konto: "8400", betrag_brutto: 20 }),
    ];
    const verlauf = kassenverlauf(list, 0, "1000", kontoVon);
    expect(verlauf).toHaveLength(1);
    expect(verlauf[0].bestand).toBe(20);
  });

  it("ignoriert stornierte Buchungen", () => {
    const list = [buchung({ id: "1", konto: "8400", betrag_brutto: 100, storniert: true })];
    const verlauf = kassenverlauf(list, 0, "1000", kontoVon);
    expect(verlauf).toHaveLength(0);
  });

  it("kassenstand liefert den Bestand zu einem Stichtag inklusive", () => {
    const list = [
      buchung({ id: "1", datum: "2026-07-01", konto: "8400", betrag_brutto: 100 }),
      buchung({ id: "2", datum: "2026-07-15", konto: "3300", betrag_brutto: 40 }),
      buchung({ id: "3", datum: "2026-08-01", konto: "3300", betrag_brutto: 1000 }),
    ];
    expect(kassenstand(list, 0, "1000", kontoVon, "2026-07-31")).toBe(60);
  });

  it("liefert den Anfangsbestand, wenn keine Buchungen vorliegen", () => {
    expect(kassenstand([], 42, "1000", kontoVon)).toBe(42);
  });
});
