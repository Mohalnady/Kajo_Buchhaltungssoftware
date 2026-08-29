import { describe, expect, it } from "vitest";
import { calc } from "./buchungen.ts";
import type { Buchung, Konto } from "./types.ts";

const KONTEN: Konto[] = [
  { nr: "8400", name: "Erlöse 19 % USt", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneingang 7 %", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true },
  { nr: "1000", name: "Kasse", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => KONTEN.find((k) => k.nr === nr);

function buchung(overrides: Partial<Buchung>): Buchung {
  return {
    id: "1",
    datum: "2026-07-01",
    text: "Test",
    konto: "8400",
    gegenkonto: "1000",
    betrag_brutto: 119,
    ust_satz: 19,
    quelle: "manuell",
    storniert: false,
    ...overrides,
  };
}

describe("calc (Summenbildung)", () => {
  it("summiert Erlöse und Aufwand getrennt und bildet das Ergebnis", () => {
    const list = [
      buchung({ id: "1", konto: "8400", betrag_brutto: 119, ust_satz: 19 }),
      buchung({ id: "2", konto: "3300", gegenkonto: "1000", betrag_brutto: 107, ust_satz: 7 }),
    ];
    const r = calc(list, kontoVon, false);
    expect(r.ein).toBe(100);
    expect(r.ust).toBe(19);
    expect(r.aus).toBe(100);
    expect(r.vst).toBe(7);
    expect(r.ergebnis).toBe(0);
    expect(r.zahllast).toBe(12);
  });

  it("ignoriert stornierte Buchungen", () => {
    const list = [buchung({ id: "1", storniert: true })];
    const r = calc(list, kontoVon, false);
    expect(r.ein).toBe(0);
    expect(r.proKonto["8400"]).toBeUndefined();
  });

  it("ignoriert Buchungen auf unbekannte oder Finanzkonten für Ein/Aus, zählt aber Finanzbuchungen nicht doppelt", () => {
    const list = [buchung({ id: "1", konto: "1000", gegenkonto: "8400", betrag_brutto: 50 })];
    const r = calc(list, kontoVon, false);
    expect(r.ein).toBe(0);
    expect(r.aus).toBe(0);
  });

  it("rechnet bei Kleinunternehmerstatus mit 0 % und weist keine USt aus", () => {
    const list = [buchung({ id: "1", konto: "8400", betrag_brutto: 119, ust_satz: 19 })];
    const r = calc(list, kontoVon, true);
    expect(r.ein).toBe(119);
    expect(r.ust).toBe(0);
  });

  it("führt eine Summe je Konto", () => {
    const list = [
      buchung({ id: "1", konto: "8400", betrag_brutto: 119 }),
      buchung({ id: "2", konto: "8400", betrag_brutto: 238 }),
    ];
    const r = calc(list, kontoVon, false);
    expect(r.proKonto["8400"].anzahl).toBe(2);
    expect(r.proKonto["8400"].netto).toBe(300);
  });
});
