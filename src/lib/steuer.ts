// Umsatzsteuer-Rechenkern. Siehe SPEC.md Abschnitt 5.1.
//
// Beträge werden brutto erfasst, netto und Steuer werden gerechnet:
//   netto = brutto / (1 + satz/100)
//   steuer = brutto - netto
// Bei aktivem Kleinunternehmerstatus (§ 19 UStG) rechnet die App mit 0 %
// unabhängig vom am Konto hinterlegten Satz.

import type { BetragSplit } from "./types.ts";
import { round2 } from "./numbers.ts";

export function split(
  betragBrutto: number,
  ustSatz: number,
  kleinunternehmer: boolean,
): BetragSplit {
  const brutto = round2(Number(betragBrutto) || 0);
  const satz = kleinunternehmer ? 0 : Number(ustSatz) || 0;
  const netto = round2(brutto / (1 + satz / 100));
  const steuer = round2(brutto - netto);
  return { brutto, netto, steuer, satz };
}
