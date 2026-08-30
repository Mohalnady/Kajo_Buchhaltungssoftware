// Rechtetabelle nach SPEC.md Abschnitt 8. Reine Nachschlagelogik — die
// Oberfläche in main.ts blendet Nav-Einträge und Aktionen anhand dieser
// Funktionen ein oder aus, statt eigene Rollenprüfungen zu verstreuen.

import type { Rolle } from "./types.ts";

export type Zugriff = "kein" | "lesen" | "voll";

const BUCHUNGEN: Record<Rolle, Zugriff> = {
  inhaber: "voll",
  buchhalter: "voll",
  mitarbeiter: "kein",
  steuerberater: "lesen",
};

const AUSWERTUNGEN: Record<Rolle, Zugriff> = {
  inhaber: "voll",
  buchhalter: "voll",
  mitarbeiter: "kein",
  steuerberater: "lesen",
};

const STAMMDATEN: Record<Rolle, Zugriff> = {
  inhaber: "voll",
  buchhalter: "voll",
  mitarbeiter: "kein",
  steuerberater: "kein",
};

const MITARBEITER_UND_LOEHNE: Record<Rolle, Zugriff> = {
  inhaber: "voll",
  buchhalter: "kein",
  mitarbeiter: "kein",
  steuerberater: "kein",
};

export function buchungenZugriff(rolle: Rolle): Zugriff {
  return BUCHUNGEN[rolle];
}

export function auswertungenZugriff(rolle: Rolle): Zugriff {
  return AUSWERTUNGEN[rolle];
}

export function stammdatenZugriff(rolle: Rolle): Zugriff {
  return STAMMDATEN[rolle];
}

export function mitarbeiterUndLoehneZugriff(rolle: Rolle): Zugriff {
  return MITARBEITER_UND_LOEHNE[rolle];
}

export function darfEigeneStundenErfassen(rolle: Rolle): boolean {
  return rolle === "inhaber" || rolle === "mitarbeiter";
}

export function darfFremdeStundenSehen(rolle: Rolle): boolean {
  return rolle === "inhaber";
}

export function darfStundenFreigeben(rolle: Rolle): boolean {
  return rolle === "inhaber";
}

export function darfFirmenUndBackupVerwalten(rolle: Rolle): boolean {
  return rolle === "inhaber";
}

/** Passendes Standard-Tab beim Anmelden — Rollen ohne Finanzeinblick landen nicht auf dem Dashboard. */
export function standardTab(rolle: Rolle): string {
  if (buchungenZugriff(rolle) !== "kein") return "dashboard";
  if (darfEigeneStundenErfassen(rolle)) return "stunden";
  return "dashboard";
}
