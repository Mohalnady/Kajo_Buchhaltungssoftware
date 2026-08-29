// Gutschein-Rechenkern. Siehe SPEC.md Abschnitt 5.3.
//
// Ein Mehrzweckgutschein erzeugt bei Ausgabe keinen Umsatz, sondern eine
// Verbindlichkeit auf Konto 1700. Erst beim Einlösen entsteht steuerpflichtiger
// Erlös mit dem Satz der gekauften Ware.

import { round2 } from "./numbers.ts";

export type GutscheinStatus = "offen" | "teilweise_eingeloest" | "eingeloest";

export interface Gutschein {
  id?: string;
  nummer: string;
  ausgabe_datum?: string;
  betrag: number;
  eingeloest_betrag: number;
  eingeloest_datum?: string;
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

/** Neuer Status, nachdem ein weiterer Betrag eingelöst wurde (rundungssicher gegen den Restbetrag geprüft). */
export function statusNachEinloesung(g: Gutschein, zusatzBetrag: number): GutscheinStatus {
  const neu = round2(g.eingeloest_betrag + zusatzBetrag);
  if (neu >= g.betrag) return "eingeloest";
  if (neu > 0) return "teilweise_eingeloest";
  return "offen";
}
