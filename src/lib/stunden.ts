// Stunden-, Zuschlags- und Bruttolohnberechnung. Siehe SPEC.md Abschnitt 5.7.

import { round2 } from "./numbers.ts";

export type ZeiteintragArt = "arbeit" | "urlaub" | "krank" | "feiertag" | "frei";

export interface ZeiteintragEingabe {
  datum: string; // JJJJ-MM-TT
  von?: string; // "HH:MM"
  bis?: string; // "HH:MM"
  pause_min: number;
  stunden?: number; // direkt angegeben, Alternative zu von/bis
  art: ZeiteintragArt;
}

export interface Zuschlagsregel {
  id: string;
  art: "nacht" | "sonntag" | "feiertag";
  von_uhrzeit?: string; // "HH:MM", nur bei art "nacht"
  bis_uhrzeit?: string;
  prozent: number;
  aktiv: boolean;
}

/** Startwerte aus SPEC.md 5.7: Nacht 25 %, Sonntag 50 %, Feiertag 125 %. */
export function standardZuschlagsregeln(): Omit<Zuschlagsregel, "id">[] {
  return [
    { art: "nacht", von_uhrzeit: "22:00", bis_uhrzeit: "06:00", prozent: 25, aktiv: true },
    { art: "sonntag", prozent: 50, aktiv: true },
    { art: "feiertag", prozent: 125, aktiv: true },
  ];
}

/**
 * Arbeitsstunden aus Kommen/Gehen/Pause ODER direkter Stundenzahl (SPEC.md:
 * "wahlweise als Kommen, Gehen, Pause oder als reine Stundenzahl"). Eine Schicht
 * über Mitternacht (bis-Uhrzeit kleiner als von-Uhrzeit) wird korrekt verlängert.
 * Nur "arbeit"-Einträge zählen als Arbeitszeit.
 */
export function berechneStunden(eintrag: ZeiteintragEingabe): number {
  if (eintrag.art !== "arbeit") return 0;
  if (eintrag.stunden != null) return round2(eintrag.stunden);
  if (!eintrag.von || !eintrag.bis) return 0;
  const [vonH, vonM] = eintrag.von.split(":").map(Number);
  const [bisH, bisM] = eintrag.bis.split(":").map(Number);
  let minuten = bisH * 60 + bisM - (vonH * 60 + vonM);
  if (minuten <= 0) minuten += 24 * 60;
  minuten -= eintrag.pause_min;
  return round2(Math.max(0, minuten) / 60);
}

/** Warnung ab 10 Stunden an einem Tag (SPEC.md: "Keine automatische Umverteilung"). */
export function warnungZehnStunden(stunden: number): boolean {
  return stunden >= 10;
}

function wochentag(datum: string): number {
  const [jahr, monat, tag] = datum.split("-").map(Number);
  return new Date(Date.UTC(jahr, monat - 1, tag)).getUTCDay(); // 0 = Sonntag
}

function minutenSeitMitternacht(uhrzeit: string): number {
  const [h, m] = uhrzeit.split(":").map(Number);
  return h * 60 + m;
}

function intervallUeberlapp(aStart: number, aEnde: number, bStart: number, bEnde: number): number {
  return Math.max(0, Math.min(aEnde, bEnde) - Math.max(aStart, bStart));
}

/** Wie viele Minuten der Schicht [von,bis] in das (täglich wiederkehrende) Nachtfenster fallen. */
function nachtMinuten(von: string, bis: string, nachtVon: string, nachtBis: string): number {
  const t0 = minutenSeitMitternacht(von);
  let t1 = minutenSeitMitternacht(bis);
  if (t1 <= t0) t1 += 24 * 60;

  const nVon = minutenSeitMitternacht(nachtVon);
  let nDauer = minutenSeitMitternacht(nachtBis) - nVon;
  if (nDauer <= 0) nDauer += 24 * 60;

  let summe = 0;
  for (const tag of [-1, 0, 1]) {
    const start = tag * 24 * 60 + nVon;
    summe += intervallUeberlapp(t0, t1, start, start + nDauer);
  }
  return summe;
}

export interface ZuschlagsDetail {
  regel: Zuschlagsregel;
  stunden: number;
}

/**
 * Welche Zuschlagsregeln greifen und mit wie vielen Stunden. Feiertag und
 * Sonntag gelten für die volle Schicht (der Tag ist als Ganzes ein
 * Feiertag/Sonntag), Nacht nur für den tatsächlichen Überlapp mit dem
 * Nachtfenster der Regel.
 */
export function zuschlagsDetails(
  eintrag: ZeiteintragEingabe,
  regeln: Zuschlagsregel[],
  istFeiertagFn: (datum: string) => boolean,
): ZuschlagsDetail[] {
  const arbeitsstunden = berechneStunden(eintrag);
  if (arbeitsstunden <= 0) return [];

  const istSonntag = wochentag(eintrag.datum) === 0;
  const feiertag = istFeiertagFn(eintrag.datum);

  const details: ZuschlagsDetail[] = [];
  for (const regel of regeln) {
    if (!regel.aktiv) continue;
    if (regel.art === "feiertag" && feiertag) {
      details.push({ regel, stunden: arbeitsstunden });
    } else if (regel.art === "sonntag" && istSonntag) {
      details.push({ regel, stunden: arbeitsstunden });
    } else if (regel.art === "nacht" && eintrag.von && eintrag.bis && regel.von_uhrzeit && regel.bis_uhrzeit) {
      const stunden = round2(Math.min(arbeitsstunden, nachtMinuten(eintrag.von, eintrag.bis, regel.von_uhrzeit, regel.bis_uhrzeit) / 60));
      if (stunden > 0) details.push({ regel, stunden });
    }
  }
  return details;
}

/** Bruttolohn = Arbeitsstunden × Stundenlohn + Zuschläge (SPEC.md 5.7). */
export function bruttolohnFuerEintrag(
  eintrag: ZeiteintragEingabe,
  stundenlohn: number,
  regeln: Zuschlagsregel[],
  istFeiertagFn: (datum: string) => boolean,
): number {
  const arbeitsstunden = berechneStunden(eintrag);
  const grundlohn = round2(arbeitsstunden * stundenlohn);
  const zuschlaege = zuschlagsDetails(eintrag, regeln, istFeiertagFn).reduce(
    (summe, d) => round2(summe + d.stunden * stundenlohn * (d.regel.prozent / 100)),
    0,
  );
  return round2(grundlohn + zuschlaege);
}
