// Importparser-Grundfunktionen. Siehe SPEC.md Abschnitt 6.

import { parseNumber } from "./numbers.ts";

/** Erkennt TT.MM.JJJJ, JJJJ-MM-TT und Excel-Serienzahl (ab 1899-12-30) und liefert JJJJ-MM-TT. */
export function parseDatum(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30 + v));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();

  let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) {
    const jahr = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${jahr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return "";
}

/** Rät den Steuersatz aus einem Prozentwert in der Importdatei (0, 7 oder 19). */
export function parseSteuersatz(v: unknown): number {
  const n = parseNumber(v);
  if (n >= 15) return 19;
  if (n >= 5) return 7;
  return 0;
}

/** Zielfelder für die Spaltenzuordnung beim Import, siehe Abschnitt 6 "Ablauf". */
export type ImportFeld =
  | "datum"
  | "betrag"
  | "text"
  | "text2"
  | "belegnr"
  | "ust"
  | "zahlart"
  | "kostenstelle";

const SPALTEN_MUSTER: Record<ImportFeld, RegExp> = {
  datum: /datum|buchungstag|date|tag$|wertstell/i,
  belegnr: /beleg|bon|rechnungsnr|dokument|^nr$|_id/i,
  text: /verwendung|zweck|text|artikel|beschreib|description|bezeichnung/i,
  text2: /empf|auftraggeber|name|kassierer|kategorie|payee/i,
  betrag: /betrag|gesamt|summe|amount|brutto|wert$|preis/i,
  ust: /mwst|ust|steuer|tax|vat/i,
  zahlart: /zahlart|zahlung|payment/i,
  kostenstelle: /kostenstelle|filiale|standort|cost.?cent/i,
};

/** Automatischer Vorschlag der Spaltenzuordnung anhand der Kopfzeile (Regex auf Überschriften). */
export function spaltenErkennen(kopfzeile: string[]): Partial<Record<ImportFeld, number>> {
  const treffer: Partial<Record<ImportFeld, number>> = {};
  for (const [feld, muster] of Object.entries(SPALTEN_MUSTER) as [ImportFeld, RegExp][]) {
    const i = kopfzeile.findIndex((h) => muster.test(String(h)));
    if (i >= 0) treffer[feld] = i;
  }
  return treffer;
}

/** Erkennt das wahrscheinlichste Trennzeichen einer CSV/TSV-Datei anhand der ersten nicht-leeren Zeile. */
export function delimiterErkennen(text: string): ";" | "\t" | "," {
  const zeile = text.split(/\r?\n/).find((z) => z.trim()) ?? "";
  const anzahl: Record<string, number> = {
    ";": (zeile.match(/;/g) ?? []).length,
    "\t": (zeile.match(/\t/g) ?? []).length,
    ",": (zeile.match(/,/g) ?? []).length,
  };
  const [bestes] = Object.entries(anzahl).sort((a, b) => b[1] - a[1]);
  return bestes[0] as ";" | "\t" | ",";
}

/** Zerlegt eine CSV-Zeile unter Berücksichtigung von Anführungszeichen. */
export function csvZeileSplit(zeile: string, trenner: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') {
      if (inQuotes && zeile[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === trenner && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Zahlart-Konvention aus Abschnitt 6: Bar -> 1000, EC/Karte -> 1210, sonst -> 1200. */
export function zahlartZuGegenkonto(zahlart: string): "1000" | "1210" | "1200" {
  const s = zahlart.toLowerCase();
  if (/bar|cash|kasse/.test(s)) return "1000";
  if (/karte|ec|sumup|card/.test(s)) return "1210";
  return "1200";
}

export interface DublettenKandidat {
  datum: string;
  betrag: number;
  text: string;
}

/** Dublettenerkennung über Datum, Betrag (auf 1 Cent genau) und Text. */
export function istDublette(
  kandidat: DublettenKandidat,
  bestehende: DublettenKandidat[],
): boolean {
  return bestehende.some(
    (b) =>
      b.datum === kandidat.datum &&
      Math.abs(Math.abs(b.betrag) - Math.abs(kandidat.betrag)) < 0.005 &&
      b.text === kandidat.text,
  );
}
