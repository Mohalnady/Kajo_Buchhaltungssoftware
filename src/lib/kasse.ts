// Kassenbuch-Rechenkern. Siehe SPEC.md Abschnitt 5.4.
//
// Alle Buchungen mit Gegenkonto 1000 (bzw. 1210 für Kartenzahlung), chronologisch,
// mit laufendem Bestand ab Anfangsbestand. Der Bestand darf rechnerisch nie negativ
// werden — das ist ein sicheres Zeichen für einen Fehler und muss deutlich markiert
// werden. Bar- und Kartenzahlung laufen getrennt.

import type { Buchung, Konto } from "./types.ts";
import { round2 } from "./numbers.ts";

export interface KassenZeile {
  buchung: Buchung;
  bewegung: number; // + Zugang, - Abgang
  bestand: number; // laufender Bestand nach dieser Buchung
  negativ: boolean;
}

/** Vorzeichen der Kassenbewegung: Erlöse und Privateinlage füllen die Kasse, alles andere entnimmt ihr. */
function bewegungsVorzeichen(gegenseite: Konto | undefined): 1 | -1 {
  if (!gegenseite) return -1;
  if (gegenseite.typ === "erloes" || gegenseite.nr === "1890") return 1;
  return -1;
}

export function kassenverlauf(
  buchungen: Buchung[],
  anfangsbestand: number,
  kassenKontoNr: string,
  kontoVon: (nr: string) => Konto | undefined,
): KassenZeile[] {
  const relevante = buchungen
    .filter((b) => !b.storniert && b.gegenkonto === kassenKontoNr)
    .slice()
    .sort((a, b) => a.datum.localeCompare(b.datum));

  let bestand = round2(anfangsbestand);
  return relevante.map((buchung) => {
    const vorzeichen = bewegungsVorzeichen(kontoVon(buchung.konto));
    const bewegung = round2(vorzeichen * (Number(buchung.betrag_brutto) || 0));
    bestand = round2(bestand + bewegung);
    return { buchung, bewegung, bestand, negativ: bestand < 0 };
  });
}

/** Kassenbestand zu einem Stichtag (inklusive), z. B. für die Dashboard-Kennzahl. */
export function kassenstand(
  buchungen: Buchung[],
  anfangsbestand: number,
  kassenKontoNr: string,
  kontoVon: (nr: string) => Konto | undefined,
  bis?: string,
): number {
  const gefiltert = bis
    ? buchungen.filter((b) => b.datum <= bis)
    : buchungen;
  const verlauf = kassenverlauf(gefiltert, anfangsbestand, kassenKontoNr, kontoVon);
  return verlauf.length ? verlauf[verlauf.length - 1].bestand : round2(anfangsbestand);
}
