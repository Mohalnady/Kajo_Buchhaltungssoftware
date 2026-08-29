// CSV-Export der Buchungen ("das ganze Buchung oder mehrere Buchungen als CSV",
// siehe SPEC.md Abschnitt 7). Die Kopfzeilennamen "Konto"/"Gegenkonto" werden
// beim Reimport von import-parser.ts direkt erkannt (siehe importkandidaten.ts).

import type { Buchung } from "./types.ts";

const KOPFZEILE = ["Datum", "Belegnr", "Text", "Konto", "Gegenkonto", "Betrag_Brutto", "USt_Satz", "Quelle"];

function feldEscapen(wert: string): string {
  if (/[;"\n]/.test(wert)) return `"${wert.replace(/"/g, '""')}"`;
  return wert;
}

/** Wandelt eine oder mehrere Buchungen in eine Semikolon-getrennte CSV-Zeichenkette um. */
export function buchungenZuCsv(buchungen: Buchung[]): string {
  const zeilen = buchungen.map((b) =>
    [
      b.datum,
      b.belegnr ?? "",
      b.text,
      b.konto,
      b.gegenkonto,
      b.betrag_brutto.toFixed(2),
      String(b.ust_satz),
      b.quelle,
    ]
      .map(feldEscapen)
      .join(";"),
  );
  return [KOPFZEILE.join(";"), ...zeilen].join("\r\n");
}
