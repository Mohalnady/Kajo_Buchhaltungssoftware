// Belegnummernkreis: automatischer Vorschlag, manuelle Änderung bleibt möglich.
// Siehe SPEC.md Abschnitt 10 (P1: "Belegnummernkreis automatisch und manuell").
// Format: <Präfix>-<Jahr>-<laufende Nummer, dreistellig>, z. B. RE-2026-014.

const MUSTER = /^([A-ZÄÖÜ]+)-(\d{4})-(\d+)$/i;

/** Schlägt die nächste freie Belegnummer für Präfix und Jahr vor, ausgehend von den vorhandenen. */
export function naechsteBelegnummer(
  vorhandeneBelegnummern: string[],
  jahr: string,
  praefix = "RE",
): string {
  let hoechste = 0;
  for (const belegnr of vorhandeneBelegnummern) {
    const treffer = belegnr.match(MUSTER);
    if (!treffer) continue;
    if (treffer[1].toUpperCase() !== praefix.toUpperCase() || treffer[2] !== jahr) continue;
    hoechste = Math.max(hoechste, Number(treffer[3]));
  }
  return `${praefix}-${jahr}-${String(hoechste + 1).padStart(3, "0")}`;
}
