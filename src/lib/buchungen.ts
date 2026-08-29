// Summenbildung über eine Liste von Buchungen. Siehe SPEC.md Abschnitt 5.1 und 5.5.

import type { Buchung, Konto } from "./types.ts";
import { split } from "./steuer.ts";
import { round2 } from "./numbers.ts";

export interface KontoSumme {
  netto: number;
  anzahl: number;
}

export interface Auswertung {
  ein: number; // Erlöse netto
  einBrutto: number;
  ust: number; // Umsatzsteuer
  aus: number; // Aufwand netto
  ausBrutto: number;
  vst: number; // Vorsteuer
  ergebnis: number;
  zahllast: number; // USt - VSt
  proKonto: Record<string, KontoSumme>;
}

export function calc(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
): Auswertung {
  const r: Auswertung = {
    ein: 0,
    einBrutto: 0,
    ust: 0,
    aus: 0,
    ausBrutto: 0,
    vst: 0,
    ergebnis: 0,
    zahllast: 0,
    proKonto: {},
  };

  for (const b of buchungen) {
    if (b.storniert) continue;
    const konto = kontoVon(b.konto);
    if (!konto) continue;
    const s = split(b.betrag_brutto, b.ust_satz, kleinunternehmer);

    const summe = r.proKonto[b.konto] ?? { netto: 0, anzahl: 0 };
    summe.netto = round2(summe.netto + s.netto);
    summe.anzahl += 1;
    r.proKonto[b.konto] = summe;

    if (konto.typ === "erloes") {
      r.ein = round2(r.ein + s.netto);
      r.einBrutto = round2(r.einBrutto + s.brutto);
      r.ust = round2(r.ust + s.steuer);
    } else if (konto.typ === "aufwand") {
      r.aus = round2(r.aus + s.netto);
      r.ausBrutto = round2(r.ausBrutto + s.brutto);
      r.vst = round2(r.vst + s.steuer);
    }
  }

  r.ergebnis = round2(r.ein - r.aus);
  r.zahllast = round2(r.ust - r.vst);
  return r;
}
