// Geldtransit-Rechenkern. Siehe SPEC.md Abschnitt 5.2 — "die wichtigste Falle".
//
// Kartengutschriften und Bareinzahlungen sind kein Umsatz, sondern Geldbewegung
// auf 1360 Geldtransit. Die Differenz zwischen Kassen-Kartenumsatz und Bankgutschrift
// ist die Gebühr des Zahlungsdienstleisters (Konto 4970).

import { round2 } from "./numbers.ts";

export interface GeldtransitVorschlag {
  kartenumsatzKasse: number;
  bankgutschrift: number;
  gebuehr: number;
}

/** Schlägt die Dienstleister-Gebühr vor, sobald Kassen- und Bankseite vorliegen. */
export function geldtransitGebuehrVorschlag(
  kartenumsatzKasse: number,
  bankgutschrift: number,
): GeldtransitVorschlag {
  const gebuehr = round2(kartenumsatzKasse - bankgutschrift);
  return { kartenumsatzKasse: round2(kartenumsatzKasse), bankgutschrift: round2(bankgutschrift), gebuehr };
}
