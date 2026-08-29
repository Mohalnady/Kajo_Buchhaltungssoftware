// Zusammenstellung des Monatspakets für den Steuerberater. Siehe SPEC.md
// Abschnitt 7 "Monatspaket". Reine Auswahl- und Benennungslogik — das
// eigentliche ZIP-Packen (Bytes) passiert in main.ts mit fflate, das braucht
// keinen eigenen Test.

import type { Buchung, Dokument } from "./types.ts";

/** Dokumente, deren Datum in den Monat "JJJJ-MM" fällt. */
export function dokumenteDesMonats(dokumente: Dokument[], monat: string): Dokument[] {
  return dokumente.filter((d) => d.datum.startsWith(monat));
}

/** Buchungen, deren Datum in den Monat "JJJJ-MM" fällt und die nicht storniert sind. */
export function buchungenDesMonats(buchungen: Buchung[], monat: string): Buchung[] {
  return buchungen.filter((b) => !b.storniert && b.datum.startsWith(monat));
}

export interface PaketEintrag {
  dokument: Dokument;
  zipPfad: string; // Ordner + eindeutiger Dateiname innerhalb des ZIPs
}

const TYP_ORDNER: Record<Dokument["typ"], string> = {
  kassenbericht: "Kassenberichte",
  rechnung: "Rechnungen",
  beleg: "Belege",
  sonstiges: "Sonstiges",
};

/**
 * Ordnet jedes Dokument des Monats einem Ordner nach Typ zu und macht den
 * Dateinamen im ZIP eindeutig (Datum vorangestellt, laufende Nummer bei
 * Namensgleichheit), damit nichts überschrieben wird.
 */
export function paketEintraege(dokumente: Dokument[], monat: string): PaketEintrag[] {
  const vergeben = new Set<string>();
  return dokumenteDesMonats(dokumente, monat).map((dokument) => {
    const ordner = TYP_ORDNER[dokument.typ];
    let name = `${dokument.datum}_${dokument.dateiname}`;
    let versuch = 1;
    while (vergeben.has(`${ordner}/${name}`)) {
      versuch += 1;
      name = `${dokument.datum}_${versuch}_${dokument.dateiname}`;
    }
    vergeben.add(`${ordner}/${name}`);
    return { dokument, zipPfad: `${ordner}/${name}` };
  });
}
