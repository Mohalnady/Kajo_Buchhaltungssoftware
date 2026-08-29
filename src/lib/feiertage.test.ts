import { describe, expect, it } from "vitest";
import { feiertageNrw, istFeiertag } from "./feiertage.ts";

describe("feiertageNrw", () => {
  it("berechnet das bewegliche Osterdatum korrekt (bekannte Referenzjahre)", () => {
    const finde = (jahr: number, name: string) => feiertageNrw(jahr).find((f) => f.name === name)?.datum;
    expect(finde(2024, "Ostermontag")).toBe("2024-04-01"); // Ostersonntag 2024: 31.03.
    expect(finde(2025, "Ostermontag")).toBe("2025-04-21"); // Ostersonntag 2025: 20.04.
    expect(finde(2026, "Ostermontag")).toBe("2026-04-06"); // Ostersonntag 2026: 05.04.
  });

  it("leitet Karfreitag, Himmelfahrt, Pfingstmontag und Fronleichnam korrekt vom Ostersonntag ab", () => {
    const zeilen = feiertageNrw(2026);
    const finde = (name: string) => zeilen.find((f) => f.name === name)?.datum;
    expect(finde("Karfreitag")).toBe("2026-04-03");
    expect(finde("Christi Himmelfahrt")).toBe("2026-05-14");
    expect(finde("Pfingstmontag")).toBe("2026-05-25");
    expect(finde("Fronleichnam")).toBe("2026-06-04");
  });

  it("enthält die festen Feiertage mit korrektem Datum", () => {
    const zeilen = feiertageNrw(2026);
    const finde = (name: string) => zeilen.find((f) => f.name === name)?.datum;
    expect(finde("Neujahr")).toBe("2026-01-01");
    expect(finde("Tag der Arbeit")).toBe("2026-05-01");
    expect(finde("Tag der Deutschen Einheit")).toBe("2026-10-03");
    expect(finde("Allerheiligen")).toBe("2026-11-01");
    expect(finde("1. Weihnachtstag")).toBe("2026-12-25");
    expect(finde("2. Weihnachtstag")).toBe("2026-12-26");
  });

  it("liefert genau elf Feiertage, aufsteigend sortiert", () => {
    const zeilen = feiertageNrw(2026);
    expect(zeilen).toHaveLength(11);
    const daten = zeilen.map((f) => f.datum);
    expect(daten).toEqual([...daten].sort());
  });
});

describe("istFeiertag", () => {
  it("erkennt einen Feiertag und einen gewöhnlichen Tag", () => {
    const zeilen = feiertageNrw(2026);
    expect(istFeiertag("2026-01-01", zeilen)).toBe(true);
    expect(istFeiertag("2026-01-02", zeilen)).toBe(false);
  });
});
