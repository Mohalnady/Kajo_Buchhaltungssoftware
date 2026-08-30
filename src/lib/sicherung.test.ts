import { describe, expect, it } from "vitest";
import { sicherungFaellig, sicherungsdateiname, zeitstempelAusDateiname, zuLoeschendeSicherungen } from "./sicherung.ts";

describe("sicherungsdateiname/zeitstempelAusDateiname", () => {
  it("baut einen Dateinamen und liest ihn wieder korrekt aus", () => {
    const datum = new Date("2026-08-30T14:05:22.000Z");
    const name = sicherungsdateiname(datum);
    expect(name).toBe("kontor-sicherung_2026-08-30T14-05-22.kontorbackup");
    expect(zeitstempelAusDateiname(name)).toBe("2026-08-30T14:05:22");
  });

  it("liefert null für Dateinamen, die nicht dem Muster entsprechen", () => {
    expect(zeitstempelAusDateiname("irgendeine-datei.txt")).toBeNull();
  });
});

describe("zuLoeschendeSicherungen", () => {
  it("behält die zehn neuesten und markiert den Rest zum Löschen", () => {
    const dateien = Array.from({ length: 12 }, (_, i) => sicherungsdateiname(new Date(2026, 0, i + 1)));
    const geloescht = zuLoeschendeSicherungen(dateien, 10);
    expect(geloescht).toHaveLength(2);
    // Die beiden ältesten (1. und 2. Januar) müssen gelöscht werden.
    expect(geloescht).toContain(sicherungsdateiname(new Date(2026, 0, 1)));
    expect(geloescht).toContain(sicherungsdateiname(new Date(2026, 0, 2)));
  });

  it("löscht nichts, wenn weniger Dateien vorhanden sind als das Limit", () => {
    const dateien = [sicherungsdateiname(new Date(2026, 0, 1)), sicherungsdateiname(new Date(2026, 0, 2))];
    expect(zuLoeschendeSicherungen(dateien, 10)).toEqual([]);
  });

  it("ignoriert fremde Dateien im selben Ordner", () => {
    const dateien = [sicherungsdateiname(new Date(2026, 0, 1)), "readme.txt"];
    expect(zuLoeschendeSicherungen(dateien, 0)).toEqual([sicherungsdateiname(new Date(2026, 0, 1))]);
  });
});

describe("sicherungFaellig", () => {
  it("ist fällig, wenn noch nie gesichert wurde", () => {
    expect(sicherungFaellig(null, "woechentlich")).toBe(true);
  });

  it("berücksichtigt das tägliche Intervall", () => {
    const jetzt = new Date("2026-08-30T12:00:00Z");
    expect(sicherungFaellig("2026-08-29T11:00:00Z", "taeglich", jetzt)).toBe(true);
    expect(sicherungFaellig("2026-08-30T06:00:00Z", "taeglich", jetzt)).toBe(false);
  });

  it("berücksichtigt das wöchentliche Intervall", () => {
    const jetzt = new Date("2026-08-30T12:00:00Z");
    expect(sicherungFaellig("2026-08-22T12:00:00Z", "woechentlich", jetzt)).toBe(true);
    expect(sicherungFaellig("2026-08-25T12:00:00Z", "woechentlich", jetzt)).toBe(false);
  });
});
