import { describe, expect, it } from "vitest";
import { split } from "./steuer.ts";

describe("split (Umsatzsteuer-Aufteilung)", () => {
  it("teilt brutto 119,00 bei 19 % in netto 100,00 und Steuer 19,00", () => {
    const s = split(119, 19, false);
    expect(s.netto).toBe(100);
    expect(s.steuer).toBe(19);
    expect(s.brutto).toBe(119);
  });

  it("teilt brutto 107,00 bei 7 % in netto 100,00 und Steuer 7,00", () => {
    const s = split(107, 7, false);
    expect(s.netto).toBe(100);
    expect(s.steuer).toBe(7);
  });

  it("lässt bei 0 % netto gleich brutto", () => {
    const s = split(50, 0, false);
    expect(s.netto).toBe(50);
    expect(s.steuer).toBe(0);
  });

  it("erzwingt 0 % bei Kleinunternehmerstatus, unabhängig vom Kontosatz", () => {
    const s = split(119, 19, true);
    expect(s.satz).toBe(0);
    expect(s.netto).toBe(119);
    expect(s.steuer).toBe(0);
  });

  it("rundet auf zwei Nachkommastellen (kein Fließkomma-Rauschen)", () => {
    const s = split(10, 19, false);
    expect(s.netto).toBe(8.4);
    expect(s.steuer).toBe(1.6);
    expect(Number.isInteger(s.netto * 100)).toBe(true);
  });

  it("behandelt negative Beträge (Stornos/Gutschriften) spiegelbildlich", () => {
    const s = split(-119, 19, false);
    expect(s.netto).toBe(-100);
    expect(s.steuer).toBe(-19);
  });
});
