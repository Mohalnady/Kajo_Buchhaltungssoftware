// Hält den Datenbank-Entschlüsselungsschlüssel für die laufende Sitzung im
// Speicher (SPEC.md Abschnitt 8: "Schlüssel aus dem Passwort des Inhabers").
// Wird einmal beim Entsperren bzw. bei der Ersteinrichtung gesetzt und dann
// von der zentralen wie von jeder Mandanten-Datenbank verwendet — ein
// gemeinsamer Kassenrechner wird morgens einmal entsperrt, das Ab-/Anmelden
// einzelner Benutzer über den Tag ändert daran nichts.

let schluessel: string | null = null;

export function schluesselSetzen(neu: string): void {
  schluessel = neu;
}

export function schluesselLesen(): string {
  if (!schluessel) throw new Error("Kein Datenbank-Schlüssel gesetzt — die Datenbank wurde noch nicht entsperrt.");
  return schluessel;
}

export function schluesselVorhanden(): boolean {
  return schluessel !== null;
}

export function schluesselLoeschen(): void {
  schluessel = null;
}
