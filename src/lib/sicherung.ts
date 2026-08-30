// Reine Logik rund um die Sicherung (SPEC.md Abschnitt 9): Dateibenennung,
// welche der letzten zehn Sicherungen erhalten bleiben, und ob laut Intervall
// eine neue Sicherung fällig ist. Das eigentliche Packen/Verschlüsseln/
// Schreiben ist Tauri-spezifisch und lebt in repo/tauri.ts.

export type BackupIntervall = "taeglich" | "woechentlich" | "monatlich";

const DATEI_MUSTER = /^kontor-sicherung_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.kontorbackup$/;

/** Erzeugt den Dateinamen für eine neue Sicherung aus einem Zeitpunkt. */
export function sicherungsdateiname(datum: Date): string {
  const iso = datum.toISOString().slice(0, 19).replace(/:/g, "-");
  return `kontor-sicherung_${iso}.kontorbackup`;
}

/** Liest den Zeitstempel (ISO, mit Doppelpunkten) aus einem Sicherungsdateinamen, oder null bei Nichtübereinstimmung. */
export function zeitstempelAusDateiname(dateiname: string): string | null {
  const treffer = dateiname.match(DATEI_MUSTER);
  if (!treffer) return null;
  return treffer[1].replace(/T(\d{2})-(\d{2})-(\d{2})$/, "T$1:$2:$3");
}

/** Von den vorhandenen Sicherungsdateien: welche sollen gelöscht werden, wenn nur die letzten `behalten` bleiben sollen? */
export function zuLoeschendeSicherungen(dateinamen: string[], behalten = 10): string[] {
  const erkannt = dateinamen
    .map((name) => ({ name, zeitstempel: zeitstempelAusDateiname(name) }))
    .filter((x): x is { name: string; zeitstempel: string } => x.zeitstempel !== null)
    .sort((a, b) => b.zeitstempel.localeCompare(a.zeitstempel));
  return erkannt.slice(behalten).map((x) => x.name);
}

/** Ob laut Intervall eine neue Sicherung fällig ist (grobe Tagesdifferenz, keine exakte Kalenderlogik). */
export function sicherungFaellig(letzteSicherung: string | null, intervall: BackupIntervall, jetzt: Date = new Date()): boolean {
  if (!letzteSicherung) return true;
  const diffTage = (jetzt.getTime() - new Date(letzteSicherung).getTime()) / (1000 * 60 * 60 * 24);
  if (intervall === "taeglich") return diffTage >= 1;
  if (intervall === "woechentlich") return diffTage >= 7;
  return diffTage >= 30;
}
