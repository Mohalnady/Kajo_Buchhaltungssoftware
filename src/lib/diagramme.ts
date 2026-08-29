// Monatsreihen für die Diagramme. Siehe SPEC.md Abschnitt 10 (P2): Umsatzverlauf,
// Ergebnis pro Monat, Personalkosten und Umsatzsteuer greifen alle auf dieselbe
// Monatsreihe zurück. Kostenverteilung nutzt summenNachGruppe (bwa.ts) direkt für
// einen einzelnen Zeitraum, Kasse und Bank nutzen kassenstand (kasse.ts) direkt
// für einen Verlauf — beide brauchen keine eigene Aggregation hier.

import type { Buchung, Konto } from "./types.ts";
import { split } from "./steuer.ts";
import { round2 } from "./numbers.ts";
import { monatVerschieben } from "./bwa.ts";
import { ustVoranmeldung } from "./ustva.ts";

export interface MonatsWert {
  monat: string; // "JJJJ-MM"
  umsatz: number; // netto Erlöse
  kosten: number; // netto Aufwand insgesamt
  ergebnis: number; // umsatz − kosten
  personalkosten: number; // netto, bwa_gruppe "personal"
  ustZahllast: number; // positiv = Zahllast, negativ = Erstattung
}

function letzterTagDesMonats(monat: string): string {
  const [jahr, m] = monat.split("-").map(Number);
  const tag = new Date(Date.UTC(jahr, m, 0)).getUTCDate();
  return `${monat}-${String(tag).padStart(2, "0")}`;
}

/** Baut eine Reihe von `anzahlMonate` Monaten bis einschließlich `bisMonat` ("JJJJ-MM"). */
export function monatsReihe(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
  versteuerung: "ist" | "soll",
  bisMonat: string,
  anzahlMonate: number,
): MonatsWert[] {
  const ergebnisse: MonatsWert[] = [];
  for (let i = anzahlMonate - 1; i >= 0; i--) {
    const monat = monatVerschieben(bisMonat, -i);
    const zeilenDesMonats = buchungen.filter((b) => !b.storniert && b.datum.startsWith(monat));

    let umsatz = 0;
    let kosten = 0;
    let personalkosten = 0;
    for (const b of zeilenDesMonats) {
      const konto = kontoVon(b.konto);
      if (!konto) continue;
      const s = split(b.betrag_brutto, b.ust_satz, kleinunternehmer);
      if (konto.typ === "erloes") {
        umsatz = round2(umsatz + s.netto);
      } else if (konto.typ === "aufwand") {
        kosten = round2(kosten + s.netto);
        if (konto.bwa_gruppe === "personal") personalkosten = round2(personalkosten + s.netto);
      }
    }

    const ust = ustVoranmeldung(buchungen, kontoVon, kleinunternehmer, versteuerung, `${monat}-01`, letzterTagDesMonats(monat));

    ergebnisse.push({ monat, umsatz, kosten, ergebnis: round2(umsatz - kosten), personalkosten, ustZahllast: ust.zahllast });
  }
  return ergebnisse;
}
