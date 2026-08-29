// Summen- und Saldenliste sowie Kontenblätter. Siehe SPEC.md Abschnitt 10 (P2).
// Das Journal braucht keinen eigenen Rechenkern — es ist die chronologische
// Buchungsliste selbst.
//
// Soll/Haben werden aus konto + gegenkonto abgeleitet, da das Datenmodell kein
// eigenes Vorzeichen führt (Beträge sind immer brutto-positiv, siehe
// CLAUDE.md). Ein Erlöskonto ist von Natur aus ein Haben-Konto — sein
// Gegenkonto (die Kasse/Bank, die den Gegenwert empfängt) steht dann im Soll.
// Bei allen anderen Kontotypen (Aufwand, Privat, Finanzumbuchung) trägt das
// Konto selbst die Soll-Seite und das Gegenkonto die Haben-Seite — siehe die
// Beispielbuchungen in repo/vorschau.ts.

import type { Buchung, Konto } from "./types.ts";
import { round2 } from "./numbers.ts";

export function sollHabenSeite(b: Buchung, kontoVon: (nr: string) => Konto | undefined): { soll: string; haben: string } {
  const istErloes = kontoVon(b.konto)?.typ === "erloes";
  return istErloes ? { soll: b.gegenkonto, haben: b.konto } : { soll: b.konto, haben: b.gegenkonto };
}

export interface SaldenZeile {
  konto: string;
  name: string;
  soll: number;
  haben: number;
  saldo: number; // Soll − Haben; positiv = Sollsaldo, negativ = Habensaldo
}

/** Summen- und Saldenliste über alle Konten, die in mindestens einer Buchung vorkommen. */
export function summenUndSalden(buchungen: Buchung[], kontoVon: (nr: string) => Konto | undefined): SaldenZeile[] {
  const summen = new Map<string, { soll: number; haben: number }>();
  const zubuchen = (nr: string, seite: "soll" | "haben", betrag: number) => {
    const eintrag = summen.get(nr) ?? { soll: 0, haben: 0 };
    eintrag[seite] = round2(eintrag[seite] + betrag);
    summen.set(nr, eintrag);
  };
  for (const b of buchungen) {
    if (b.storniert) continue;
    const { soll, haben } = sollHabenSeite(b, kontoVon);
    zubuchen(soll, "soll", b.betrag_brutto);
    zubuchen(haben, "haben", b.betrag_brutto);
  }
  const zeilen: SaldenZeile[] = [];
  for (const [nr, { soll, haben }] of summen) {
    zeilen.push({ konto: nr, name: kontoVon(nr)?.name ?? nr, soll, haben, saldo: round2(soll - haben) });
  }
  return zeilen.sort((a, b) => a.konto.localeCompare(b.konto));
}

export interface KontenblattZeile {
  datum: string;
  belegnr: string;
  text: string;
  gegenkonto: string;
  soll: number;
  haben: number;
  saldo: number; // laufender Saldo nach dieser Zeile
}

/** Alle Buchungen eines Kontos, chronologisch, mit laufendem Saldo. */
export function kontenblatt(buchungen: Buchung[], kontoVon: (nr: string) => Konto | undefined, kontoNr: string): KontenblattZeile[] {
  const relevante = buchungen
    .filter((b) => !b.storniert && (b.konto === kontoNr || b.gegenkonto === kontoNr))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  let saldo = 0;
  return relevante.map((b) => {
    const { soll } = sollHabenSeite(b, kontoVon);
    const istSoll = soll === kontoNr;
    const sollBetrag = istSoll ? b.betrag_brutto : 0;
    const habenBetrag = istSoll ? 0 : b.betrag_brutto;
    saldo = round2(saldo + sollBetrag - habenBetrag);
    return {
      datum: b.datum,
      belegnr: b.belegnr ?? "",
      text: b.text,
      gegenkonto: b.konto === kontoNr ? b.gegenkonto : b.konto,
      soll: sollBetrag,
      haben: habenBetrag,
      saldo,
    };
  });
}
