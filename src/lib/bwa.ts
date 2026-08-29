// BWA-Rechenkern. Siehe SPEC.md Abschnitt 5.5.
//
// Die Zeilenreihenfolge entspricht der detaillierten BWA aus der SPEC und
// summiert sich fortlaufend zu Rohertrag, Betriebsergebnis und Vorläufigem
// Ergebnis. Erlöskonten zählen positiv, alle anderen Konten mit einer
// bwa_gruppe (Aufwand oder "neutral") negativ — dadurch ist jede Zwischensumme
// einfach die laufende Summe der Gruppenwerte in der festen Reihenfolge.

import type { Buchung, Konto } from "./types.ts";
import { split } from "./steuer.ts";
import { round2 } from "./numbers.ts";

export interface BwaSpalten {
  monat: number;
  vormonat: number;
  vorjahresmonat: number;
  jahrKumuliert: number;
}

export interface BwaZeile extends BwaSpalten {
  gruppe: string;
  label: string;
  prozentUmsatz: number;
}

export interface BwaBericht {
  zeilen: BwaZeile[];
  rohertrag: BwaSpalten;
  betriebsergebnis: BwaSpalten;
  vorlaeufigesErgebnis: BwaSpalten;
}

/** Reihenfolge und Beschriftung exakt wie in SPEC.md Abschnitt 5.5. */
export const BWA_GRUPPEN: { gruppe: string; label: string }[] = [
  { gruppe: "umsatz", label: "bwa_umsatz" },
  { gruppe: "ware", label: "bwa_ware" },
  { gruppe: "personal", label: "bwa_personal" },
  { gruppe: "raum", label: "bwa_raum" },
  { gruppe: "steuern", label: "bwa_steuern" },
  { gruppe: "vers", label: "bwa_vers" },
  { gruppe: "kfz", label: "bwa_kfz" },
  { gruppe: "werbung", label: "bwa_werbung" },
  { gruppe: "warenabgabe", label: "bwa_warenabgabe" },
  { gruppe: "afa", label: "bwa_afa" },
  { gruppe: "rep", label: "bwa_rep" },
  { gruppe: "sonst", label: "bwa_sonst" },
  { gruppe: "neutral", label: "bwa_neutral" },
];

/** Verschiebt "JJJJ-MM" um `delta` Monate (negativ = zurück). */
export function monatVerschieben(monat: string, delta: number): string {
  const [jahr, m] = monat.split("-").map(Number);
  const datum = new Date(Date.UTC(jahr, m - 1 + delta, 1));
  return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Summiert Nettobeträge je bwa_gruppe: Erlöse positiv, alles andere negativ. */
export function summenNachGruppe(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
): Record<string, number> {
  const summen: Record<string, number> = {};
  for (const b of buchungen) {
    if (b.storniert) continue;
    const konto = kontoVon(b.konto);
    if (!konto || !konto.bwa_gruppe) continue;
    const s = split(b.betrag_brutto, b.ust_satz, kleinunternehmer);
    const vorzeichen = konto.typ === "erloes" ? 1 : -1;
    summen[konto.bwa_gruppe] = round2((summen[konto.bwa_gruppe] ?? 0) + vorzeichen * s.netto);
  }
  return summen;
}

function laufendeSumme(gruppen: Record<string, number>, biszuGruppe: string): number {
  let summe = 0;
  for (const { gruppe } of BWA_GRUPPEN) {
    summe += gruppen[gruppe] ?? 0;
    if (gruppe === biszuGruppe) break;
  }
  return round2(summe);
}

/** Baut den vollständigen BWA-Bericht für den angegebenen Monat ("JJJJ-MM"). */
export function bwaBericht(
  alleBuchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  kleinunternehmer: boolean,
  monat: string,
): BwaBericht {
  const vormonat = monatVerschieben(monat, -1);
  const vorjahresmonat = monatVerschieben(monat, -12);

  const filterMonat = (m: string) => alleBuchungen.filter((b) => b.datum.startsWith(m));
  const filterJahrKumuliert = (bisMonat: string) =>
    alleBuchungen.filter((b) => b.datum.slice(0, 4) === bisMonat.slice(0, 4) && b.datum.slice(0, 7) <= bisMonat);

  const gMonat = summenNachGruppe(filterMonat(monat), kontoVon, kleinunternehmer);
  const gVormonat = summenNachGruppe(filterMonat(vormonat), kontoVon, kleinunternehmer);
  const gVorjahresmonat = summenNachGruppe(filterMonat(vorjahresmonat), kontoVon, kleinunternehmer);
  const gJahr = summenNachGruppe(filterJahrKumuliert(monat), kontoVon, kleinunternehmer);

  const umsatzMonat = gMonat.umsatz ?? 0;

  const zeilen: BwaZeile[] = BWA_GRUPPEN.map(({ gruppe, label }) => {
    const betragMonat = gMonat[gruppe] ?? 0;
    return {
      gruppe,
      label,
      monat: betragMonat,
      vormonat: gVormonat[gruppe] ?? 0,
      vorjahresmonat: gVorjahresmonat[gruppe] ?? 0,
      jahrKumuliert: gJahr[gruppe] ?? 0,
      prozentUmsatz: umsatzMonat !== 0 ? round2((betragMonat / umsatzMonat) * 100) : 0,
    };
  });

  const spalten = (biszuGruppe: string): BwaSpalten => ({
    monat: laufendeSumme(gMonat, biszuGruppe),
    vormonat: laufendeSumme(gVormonat, biszuGruppe),
    vorjahresmonat: laufendeSumme(gVorjahresmonat, biszuGruppe),
    jahrKumuliert: laufendeSumme(gJahr, biszuGruppe),
  });

  return {
    zeilen,
    rohertrag: spalten("ware"),
    betriebsergebnis: spalten("sonst"),
    vorlaeufigesErgebnis: spalten("neutral"),
  };
}
