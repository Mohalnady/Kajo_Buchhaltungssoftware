// DATEV-Buchungsstapel-Export (EXTF-Format, Version 700). Siehe SPEC.md
// Abschnitt 7: "DATEV | EXTF-Buchungsstapel, Version 700, Semikolon,
// Windows-1252, mit Kopfzeile".
//
// Soll/Haben wird über sollHabenSeite() aus berichte.ts abgeleitet, damit
// DATEV-Export und Summen-/Saldenliste immer dieselbe Buchungsrichtung
// zeigen. "Konto" trägt hier immer die Soll-Seite, "Gegenkonto" immer die
// Haben-Seite — das Soll/Haben-Kennzeichen ist deshalb immer "S". Das ist
// eine bewusste Vereinfachung: jede doppelte Buchführung lässt sich so
// verlustfrei darstellen, unabhängig davon, welche Seite man "Konto" nennt.
//
// Hinweis: Das exakte byteweise Format hängt von der DATEV-Version der
// Kanzleisoftware ab. Vor dem ersten produktiven Einsatz sollte ein
// Testimport mit dem Steuerberater erfolgen (siehe HANDBUCH.md).

import type { Buchung, Konto } from "./types.ts";
import { sollHabenSeite } from "./berichte.ts";

export interface DatevMandantendaten {
  beraterNr: number;
  mandantNr: number;
  wjBeginn: string; // JJJJ-MM-TT, Beginn des Wirtschaftsjahres
  kontoLaenge: number; // Sachkontenlänge, meist 4
  von: string; // JJJJ-MM-TT
  bis: string; // JJJJ-MM-TT
  bezeichnung: string; // Name des Buchungsstapels, z. B. "Kontor-Export August 2026"
}

export const DATEV_SPALTEN = [
  "Umsatz (ohne Soll/Haben-Kz)",
  "Soll/Haben-Kennzeichen",
  "WKZ Umsatz",
  "Konto",
  "Gegenkonto (ohne BU-Schlüssel)",
  "BU-Schlüssel",
  "Belegdatum",
  "Belegfeld 1",
  "Belegfeld 2",
  "Skonto",
  "Buchungstext",
  "Postensperre",
  "KOST1 - Kostenstelle",
] as const;

function datevDatumJJJJMMTT(jjjjMmTt: string): string {
  return jjjjMmTt.replaceAll("-", "");
}

/** Belegdatum im DATEV-Buchungsstapel ist TTMM, ohne Jahr (Jahr ergibt sich aus dem Buchungszeitraum). */
function datevBelegdatum(jjjjMmTt: string): string {
  const [, monat, tag] = jjjjMmTt.split("-");
  return `${tag}${monat}`;
}

function datevZeitstempel(jetzt: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${jetzt.getFullYear()}${p(jetzt.getMonth() + 1)}${p(jetzt.getDate())}${p(jetzt.getHours())}${p(jetzt.getMinutes())}${p(jetzt.getSeconds())}${p(0, 3)}`;
}

function datevZahl(betrag: number): string {
  // DATEV erwartet Komma als Dezimaltrennzeichen; der Betrag ist immer
  // positiv, das Vorzeichen steckt im Soll/Haben-Kennzeichen.
  return Math.abs(betrag).toFixed(2).replace(".", ",");
}

function datevText(feld: string): string {
  return `"${feld.replaceAll('"', '""')}"`;
}

export function datevKontonummer(konto: Konto | undefined, kontoNrFallback: string): string {
  return konto?.datev_konto?.trim() || kontoNrFallback;
}

function kopfzeile1(daten: DatevMandantendaten, jetzt: Date): string {
  return [
    datevText("EXTF"),
    "700",
    "21",
    datevText("Buchungsstapel"),
    "12",
    datevZeitstempel(jetzt),
    "",
    datevText(""),
    datevText(""),
    String(daten.beraterNr),
    String(daten.mandantNr),
    datevDatumJJJJMMTT(daten.wjBeginn),
    String(daten.kontoLaenge),
    datevDatumJJJJMMTT(daten.von),
    datevDatumJJJJMMTT(daten.bis),
    datevText(daten.bezeichnung),
    "",
    "1",
    "0",
    "0",
    datevText("EUR"),
  ].join(";");
}

function kopfzeile2(): string {
  return DATEV_SPALTEN.map(datevText).join(";");
}

function buchungszeile(b: Buchung, kontoVon: (nr: string) => Konto | undefined): string {
  const { soll, haben } = sollHabenSeite(b, kontoVon);
  const sollNr = soll === b.konto ? b.konto : b.gegenkonto;
  const habenNr = haben === b.konto ? b.konto : b.gegenkonto;
  return [
    datevZahl(b.betrag_brutto),
    "S",
    datevText("EUR"),
    datevKontonummer(kontoVon(sollNr), sollNr),
    datevKontonummer(kontoVon(habenNr), habenNr),
    "",
    datevBelegdatum(b.datum),
    datevText(b.belegnr ?? ""),
    datevText(""),
    "",
    datevText(b.text),
    "",
    b.kostenstelle_id ? datevText(b.kostenstelle_id) : datevText(""),
  ].join(";");
}

/** Baut den vollständigen EXTF-Buchungsstapel (zwei Kopfzeilen + eine Zeile je Buchung). Stornierte Buchungen werden ausgelassen. */
export function datevBuchungsstapel(
  buchungen: Buchung[],
  kontoVon: (nr: string) => Konto | undefined,
  daten: DatevMandantendaten,
  jetzt: Date = new Date(),
): string {
  const zeilen = buchungen
    .filter((b) => !b.storniert)
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map((b) => buchungszeile(b, kontoVon));
  return [kopfzeile1(daten, jetzt), kopfzeile2(), ...zeilen].join("\r\n") + "\r\n";
}
