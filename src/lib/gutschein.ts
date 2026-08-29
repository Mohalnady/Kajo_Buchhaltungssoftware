// Gutschein-Rechenkern. Siehe SPEC.md Abschnitt 5.3.
//
// Ein Mehrzweckgutschein erzeugt bei Ausgabe keinen Umsatz, sondern eine
// Verbindlichkeit auf Konto 1700. Erst beim Einlösen entsteht steuerpflichtiger
// Erlös mit dem Satz der gekauften Ware.

import { round2 } from "./numbers.ts";

export type GutscheinStatus = "offen" | "teilweise_eingeloest" | "eingeloest";

export interface Gutschein {
  nummer: string;
  betrag: number;
  eingeloest_betrag: number;
  status: GutscheinStatus;
}

/** Noch nicht eingelöster Restbetrag eines einzelnen Gutscheins. */
export function offenerBetrag(g: Gutschein): number {
  return round2(g.betrag - g.eingeloest_betrag);
}

/** Summe der offenen Verbindlichkeit aus allen nicht vollständig eingelösten Gutscheinen. */
export function offeneGutscheinSumme(gutscheine: Gutschein[]): number {
  return round2(
    gutscheine
      .filter((g) => g.status !== "eingeloest")
      .reduce((summe, g) => summe + offenerBetrag(g), 0),
  );
}
