// Wandelt eine eingelesene Importzeile in einen Buchungskandidaten um.
// Siehe SPEC.md Abschnitt 6 "Ablauf" (Schritte 2-4) und "Konventionen".

import type { ImportFeld, DublettenKandidat } from "./import-parser.ts";
import { istDublette, parseDatum, parseSteuersatz, zahlartZuGegenkonto } from "./import-parser.ts";
import { parseNumber, round2 } from "./numbers.ts";
import { regelKonto, type RegelEintrag } from "./importregeln.ts";

export interface ImportKandidat {
  datum: string;
  text: string;
  belegnr: string;
  betrag_brutto: number;
  ust_satz: number;
  konto: string;
  gegenkonto: string;
  dublette: boolean;
  uebernehmen: boolean;
}

/**
 * Baut aus einer Zeile + Spaltenzuordnung einen Buchungskandidaten.
 *
 * Sind die Spalten "Konto" und "Gegenkonto" zugeordnet (Reimport eines eigenen
 * Kontor-CSV-Exports), werden sie direkt übernommen. Sonst wird das Konto über
 * die Importregeln aus dem Buchungstext ermittelt (Stichwort → Konto, siehe
 * importregeln.ts) und das Gegenkonto über die Zahlart (Bar → 1000, Karte →
 * 1210, sonst → 1200, siehe zahlartZuGegenkonto in import-parser.ts).
 */
export function zeileZuKandidat(
  zeile: (string | number)[],
  zuordnung: Partial<Record<ImportFeld, number>>,
  regeln: RegelEintrag[],
  bestehende: DublettenKandidat[],
): ImportKandidat {
  const wert = (feld: ImportFeld): string | number | undefined =>
    zuordnung[feld] != null ? zeile[zuordnung[feld]!] : undefined;

  const datum = parseDatum(wert("datum"));
  const textteile = [wert("text"), wert("text2")].filter((t) => t != null && t !== "");
  const text = textteile.map(String).join(" — ");
  const belegnr = String(wert("belegnr") ?? "");
  const betragRoh = parseNumber(wert("betrag"));
  const betrag_brutto = round2(Math.abs(betragRoh));
  const ust_satz = zuordnung.ust != null ? parseSteuersatz(wert("ust")) : 19;

  let konto: string;
  let gegenkonto: string;
  if (zuordnung.konto != null && zuordnung.gegenkonto != null) {
    konto = String(wert("konto") ?? "");
    gegenkonto = String(wert("gegenkonto") ?? "");
  } else {
    const finanzkonto = zuordnung.zahlart != null ? zahlartZuGegenkonto(String(wert("zahlart") ?? "")) : "1200";
    konto = regelKonto(text, regeln, betragRoh >= 0 ? 1 : -1);
    gegenkonto = finanzkonto;
  }

  const dublette = istDublette({ datum, betrag: betrag_brutto, text }, bestehende);

  return { datum, text, belegnr, betrag_brutto, ust_satz, konto, gegenkonto, dublette, uebernehmen: !dublette };
}
