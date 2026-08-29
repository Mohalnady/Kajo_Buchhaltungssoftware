import { describe, expect, it } from "vitest";
import {
  berechneStunden,
  bruttolohnFuerEintrag,
  standardZuschlagsregeln,
  warnungZehnStunden,
  zuschlagsDetails,
  type Zuschlagsregel,
} from "./stunden.ts";

const regeln: Zuschlagsregel[] = standardZuschlagsregeln().map((r, i) => ({ ...r, id: String(i) }));
const keinFeiertag = () => false;

describe("berechneStunden", () => {
  it("berechnet eine normale Schicht abzüglich Pause", () => {
    expect(berechneStunden({ datum: "2026-08-10", von: "08:00", bis: "16:30", pause_min: 30, art: "arbeit" })).toBe(8);
  });

  it("verlängert eine Schicht über Mitternacht korrekt", () => {
    expect(berechneStunden({ datum: "2026-08-10", von: "22:00", bis: "06:00", pause_min: 0, art: "arbeit" })).toBe(8);
  });

  it("nutzt die direkt angegebene Stundenzahl, wenn keine Kommen/Gehen-Zeiten vorliegen", () => {
    expect(berechneStunden({ datum: "2026-08-10", pause_min: 0, stunden: 6.5, art: "arbeit" })).toBe(6.5);
  });

  it("zählt Urlaub/Krank/Feiertag/Frei nicht als Arbeitszeit", () => {
    expect(berechneStunden({ datum: "2026-08-10", pause_min: 0, stunden: 8, art: "urlaub" })).toBe(0);
  });
});

describe("warnungZehnStunden", () => {
  it("warnt ab genau 10 Stunden, nicht darunter", () => {
    expect(warnungZehnStunden(9.99)).toBe(false);
    expect(warnungZehnStunden(10)).toBe(true);
  });
});

describe("zuschlagsDetails", () => {
  it("erkennt den Sonntagszuschlag für die volle Schicht", () => {
    // 2024-01-07 ist ein Sonntag
    const eintrag = { datum: "2024-01-07", von: "10:00", bis: "14:00", pause_min: 0, art: "arbeit" as const };
    const details = zuschlagsDetails(eintrag, regeln, keinFeiertag);
    const sonntag = details.find((d) => d.regel.art === "sonntag");
    expect(sonntag?.stunden).toBe(4);
  });

  it("erkennt den Feiertagszuschlag über die übergebene Prüffunktion", () => {
    const eintrag = { datum: "2026-01-01", von: "10:00", bis: "14:00", pause_min: 0, art: "arbeit" as const };
    const details = zuschlagsDetails(eintrag, regeln, () => true);
    expect(details.find((d) => d.regel.art === "feiertag")?.stunden).toBe(4);
  });

  it("berechnet den Nachtzuschlag nur für den tatsächlichen Überlapp (Schicht über Mitternacht)", () => {
    // Montag, kein Sonntag/Feiertag: nur Nachtzuschlag relevant
    const eintrag = { datum: "2024-01-08", von: "20:00", bis: "04:00", pause_min: 0, art: "arbeit" as const };
    const details = zuschlagsDetails(eintrag, regeln, keinFeiertag);
    const nacht = details.find((d) => d.regel.art === "nacht");
    // Nachtfenster 22:00-06:00 überlappt mit 20:00-04:00 von 22:00 bis 04:00 = 6 Stunden
    expect(nacht?.stunden).toBe(6);
  });

  it("liefert keinen Nachtzuschlag ohne Kommen/Gehen-Zeiten", () => {
    const eintrag = { datum: "2024-01-08", pause_min: 0, stunden: 8, art: "arbeit" as const };
    const details = zuschlagsDetails(eintrag, regeln, keinFeiertag);
    expect(details.find((d) => d.regel.art === "nacht")).toBeUndefined();
  });

  it("kombiniert mehrere Zuschläge (Nachtschicht an einem Sonntag)", () => {
    const eintrag = { datum: "2024-01-07", von: "22:00", bis: "06:00", pause_min: 0, art: "arbeit" as const };
    const details = zuschlagsDetails(eintrag, regeln, keinFeiertag);
    expect(details.find((d) => d.regel.art === "sonntag")?.stunden).toBe(8);
    expect(details.find((d) => d.regel.art === "nacht")?.stunden).toBe(8);
  });

  it("ignoriert deaktivierte Regeln", () => {
    const deaktiviert = regeln.map((r) => ({ ...r, aktiv: false }));
    const eintrag = { datum: "2024-01-07", von: "10:00", bis: "14:00", pause_min: 0, art: "arbeit" as const };
    expect(zuschlagsDetails(eintrag, deaktiviert, keinFeiertag)).toEqual([]);
  });
});

describe("bruttolohnFuerEintrag", () => {
  it("berechnet Grundlohn ohne Zuschläge an einem gewöhnlichen Werktag", () => {
    const eintrag = { datum: "2024-01-08", von: "08:00", bis: "16:00", pause_min: 0, art: "arbeit" as const };
    expect(bruttolohnFuerEintrag(eintrag, 15, regeln, keinFeiertag)).toBe(120); // 8h * 15€
  });

  it("addiert den Sonntagszuschlag zum Grundlohn", () => {
    const eintrag = { datum: "2024-01-07", von: "08:00", bis: "16:00", pause_min: 0, art: "arbeit" as const };
    // Grundlohn 8h*15=120, Zuschlag 8h*15*0.5=60 -> 180
    expect(bruttolohnFuerEintrag(eintrag, 15, regeln, keinFeiertag)).toBe(180);
  });

  it("liefert 0 für einen Urlaubstag", () => {
    const eintrag = { datum: "2024-01-08", pause_min: 0, art: "urlaub" as const };
    expect(bruttolohnFuerEintrag(eintrag, 15, regeln, keinFeiertag)).toBe(0);
  });
});
