// USt-Voranmeldung-Rechenkern. Siehe SPEC.md Abschnitt 5.1 und Abschnitt 10 (P2).
//
// Die SPEC nennt nur die Kennzahlen 81, 86, 66 und 83 ohne genauere Definition.
// Für einen Betrieb mit ausschließlich inländischen Umsätzen zu 0/7/19 % (siehe
// skr03.ts) ist die naheliegende, in sich stimmige Zuordnung:
//   Kz 81 = Bemessungsgrundlage Umsätze zu 19 %
//   Kz 86 = Bemessungsgrundlage Umsätze zu 7 %
//   Kz 83 = Bemessungsgrundlage Umsätze zu 0 % (u. a. Kleinunternehmerregelung)
//   Kz 66 = abziehbare Vorsteuerbeträge insgesamt
// Vor der tatsächlichen Abgabe müssen die Kennziffern gegen das aktuelle
// amtliche Formular geprüft werden — Kontor ersetzt keine Steuerberatung
// (siehe CLAUDE.md "Was das Programm nicht ist").

import type { Buchung, Konto } from "./types.ts";
import { split } from "./steuer.ts";
import { round2 } from "./numbers.ts";

export interface UstVaBericht {
  kz81: number;
  kz86: number;
  kz83: number;
  kz66: number;
  ustAus81: number;
  ustAus86: number;
  umsatzsteuerGesamt: number;
  zahllast: number; // positiv = Zahllast ans Finanzamt, negativ = Erstattung
}

/** Berechnet die USt-Voranmeldung für den Zeitraum [von, bis] (inklusiv), je nach Ist-/Soll-Versteuerung. */
export function ustVoranmeldung(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
  versteuerung: "ist" | "soll",
  von: string,
  bis: string,
): UstVaBericht {
  const stichtag = (b: Buchung) => (versteuerung === "ist" ? (b.wertstellung ?? b.datum) : b.datum);
  const relevante = buchungen.filter((b) => {
    if (b.storniert) return false;
    const d = stichtag(b);
    return d >= von && d <= bis;
  });

  let kz81 = 0;
  let kz86 = 0;
  let kz83 = 0;
  let kz66 = 0;

  for (const b of relevante) {
    const konto = kontoVon(b.konto);
    if (!konto) continue;
    const s = split(b.betrag_brutto, b.ust_satz, kleinunternehmer);
    if (konto.typ === "erloes") {
      if (s.satz === 19) kz81 = round2(kz81 + s.netto);
      else if (s.satz === 7) kz86 = round2(kz86 + s.netto);
      else kz83 = round2(kz83 + s.netto);
    } else if (konto.typ === "aufwand") {
      kz66 = round2(kz66 + s.steuer);
    }
  }

  const ustAus81 = round2(kz81 * 0.19);
  const ustAus86 = round2(kz86 * 0.07);
  const umsatzsteuerGesamt = round2(ustAus81 + ustAus86);

  return { kz81, kz86, kz83, kz66, ustAus81, ustAus86, umsatzsteuerGesamt, zahllast: round2(umsatzsteuerGesamt - kz66) };
}
