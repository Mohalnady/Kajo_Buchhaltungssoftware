import { describe, expect, it } from "vitest";
import {
  auswertungenZugriff,
  buchungenZugriff,
  darfEigeneStundenErfassen,
  darfFirmenUndBackupVerwalten,
  darfFremdeStundenSehen,
  darfStundenFreigeben,
  mitarbeiterUndLoehneZugriff,
  standardTab,
  stammdatenZugriff,
} from "./rechte.ts";
import type { Rolle } from "./types.ts";

const ALLE_ROLLEN: Rolle[] = ["inhaber", "buchhalter", "mitarbeiter", "steuerberater"];

describe("Rechtetabelle nach SPEC.md Abschnitt 8", () => {
  it("Buchungen: Inhaber und Buchhalter voll, Mitarbeiter kein, Steuerberater nur lesen", () => {
    expect(buchungenZugriff("inhaber")).toBe("voll");
    expect(buchungenZugriff("buchhalter")).toBe("voll");
    expect(buchungenZugriff("mitarbeiter")).toBe("kein");
    expect(buchungenZugriff("steuerberater")).toBe("lesen");
  });

  it("Auswertungen und Export: dieselbe Verteilung wie Buchungen", () => {
    expect(auswertungenZugriff("inhaber")).toBe("voll");
    expect(auswertungenZugriff("buchhalter")).toBe("voll");
    expect(auswertungenZugriff("mitarbeiter")).toBe("kein");
    expect(auswertungenZugriff("steuerberater")).toBe("lesen");
  });

  it("Stammdaten und Konten: nur Inhaber und Buchhalter, auch nicht lesend für die anderen", () => {
    expect(stammdatenZugriff("inhaber")).toBe("voll");
    expect(stammdatenZugriff("buchhalter")).toBe("voll");
    expect(stammdatenZugriff("mitarbeiter")).toBe("kein");
    expect(stammdatenZugriff("steuerberater")).toBe("kein");
  });

  it("Mitarbeiter und Löhne: ausschließlich der Inhaber, auch der Buchhalter nicht", () => {
    for (const rolle of ALLE_ROLLEN) {
      expect(mitarbeiterUndLoehneZugriff(rolle)).toBe(rolle === "inhaber" ? "voll" : "kein");
    }
  });

  it("Eigene Stunden erfassen: Inhaber und Mitarbeiter, nicht Buchhalter oder Steuerberater", () => {
    expect(darfEigeneStundenErfassen("inhaber")).toBe(true);
    expect(darfEigeneStundenErfassen("mitarbeiter")).toBe(true);
    expect(darfEigeneStundenErfassen("buchhalter")).toBe(false);
    expect(darfEigeneStundenErfassen("steuerberater")).toBe(false);
  });

  it("Fremde Stunden sehen und Stunden freigeben: ausschließlich der Inhaber", () => {
    for (const rolle of ALLE_ROLLEN) {
      expect(darfFremdeStundenSehen(rolle)).toBe(rolle === "inhaber");
      expect(darfStundenFreigeben(rolle)).toBe(rolle === "inhaber");
    }
  });

  it("Firmen anlegen und Backup: ausschließlich der Inhaber", () => {
    for (const rolle of ALLE_ROLLEN) {
      expect(darfFirmenUndBackupVerwalten(rolle)).toBe(rolle === "inhaber");
    }
  });

  it("Standard-Tab: Rollen mit Buchungseinblick landen auf dem Dashboard, reine Mitarbeiter auf der Zeiterfassung", () => {
    expect(standardTab("inhaber")).toBe("dashboard");
    expect(standardTab("buchhalter")).toBe("dashboard");
    expect(standardTab("steuerberater")).toBe("dashboard");
    expect(standardTab("mitarbeiter")).toBe("stunden");
  });
});
