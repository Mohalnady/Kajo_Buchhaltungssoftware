// EÜR-Rechenkern. Siehe SPEC.md Abschnitt 5.6.
//
// Betriebseinnahmen und -ausgaben zählen nach Zahlungszeitpunkt (Zufluss-
// /Abflussprinzip), unabhängig von der Ist-/Soll-Einstellung der laufenden
// Buchhaltung — die EÜR ist als Anlage EÜR immer eine Ist-Rechnung. Zeilen
// werden über konto.euer_zeile sortiert; ist keine Zeile vergeben, landet das
// Konto am Ende ("nicht zugeordnet"), ohne die Summen zu verfälschen.
//
// Privatentnahmen und -einlagen sind nicht ergebniswirksam. Da "privat"-Konten
// frei anlegbar sind (nichts fest verdrahten), wird nicht anhand fester
// Kontonummern zwischen Entnahme und Einlage unterschieden, sondern jedes
// privat-Konto einzeln mit seinem eigenen Namen und seiner Summe ausgewiesen.

import type { Buchung, Konto } from "./types.ts";
import { split } from "./steuer.ts";
import { round2 } from "./numbers.ts";

export interface EuerZeile {
  euer_zeile?: number;
  konto: string;
  name: string;
  typ: "erloes" | "aufwand";
  netto: number;
}

export interface EuerPrivatZeile {
  konto: string;
  name: string;
  betrag: number;
}

export interface EuerBericht {
  zeilen: EuerZeile[];
  privatZeilen: EuerPrivatZeile[];
  summeEinnahmen: number;
  summeAusgaben: number;
  gewinn: number;
}

function zahlungsdatum(b: Buchung): string {
  return b.wertstellung ?? b.datum;
}

/** Baut den EÜR-Bericht für den Zeitraum [von, bis] (beide "JJJJ-MM-TT", inklusiv), nach Zahlungsdatum. */
export function euerBericht(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
  von: string,
  bis: string,
): EuerBericht {
  const relevante = buchungen.filter((b) => {
    if (b.storniert) return false;
    const d = zahlungsdatum(b);
    return d >= von && d <= bis;
  });

  const nettoProKonto = new Map<string, number>();
  const privatProKonto = new Map<string, number>();

  for (const b of relevante) {
    const konto = kontoVon(b.konto);
    if (!konto) continue;
    if (konto.typ === "privat") {
      privatProKonto.set(b.konto, round2((privatProKonto.get(b.konto) ?? 0) + b.betrag_brutto));
      continue;
    }
    if (konto.typ !== "erloes" && konto.typ !== "aufwand") continue;
    const s = split(b.betrag_brutto, b.ust_satz, kleinunternehmer);
    nettoProKonto.set(b.konto, round2((nettoProKonto.get(b.konto) ?? 0) + s.netto));
  }

  const zeilen: EuerZeile[] = [];
  for (const [nr, netto] of nettoProKonto) {
    const konto = kontoVon(nr);
    if (!konto) continue;
    zeilen.push({ euer_zeile: konto.euer_zeile, konto: nr, name: konto.name, typ: konto.typ as "erloes" | "aufwand", netto });
  }
  zeilen.sort((a, b) => {
    if (a.euer_zeile == null && b.euer_zeile == null) return a.konto.localeCompare(b.konto);
    if (a.euer_zeile == null) return 1;
    if (b.euer_zeile == null) return -1;
    return a.euer_zeile - b.euer_zeile || a.konto.localeCompare(b.konto);
  });

  const privatZeilen: EuerPrivatZeile[] = [...privatProKonto.entries()]
    .map(([nr, betrag]) => ({ konto: nr, name: kontoVon(nr)?.name ?? nr, betrag }))
    .sort((a, b) => a.konto.localeCompare(b.konto));

  const summeEinnahmen = round2(zeilen.filter((z) => z.typ === "erloes").reduce((s, z) => s + z.netto, 0));
  const summeAusgaben = round2(zeilen.filter((z) => z.typ === "aufwand").reduce((s, z) => s + z.netto, 0));

  return {
    zeilen,
    privatZeilen,
    summeEinnahmen,
    summeAusgaben,
    gewinn: round2(summeEinnahmen - summeAusgaben),
  };
}
