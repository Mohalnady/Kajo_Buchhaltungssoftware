// Gesetzliche Feiertage. Startwert Nordrhein-Westfalen, siehe SPEC.md
// Abschnitt 5.7 ("Feiertage: nach Bundesland, Startwert Nordrhein-Westfalen").
// Das bewegliche Osterdatum kommt aus der Gaußschen Osterformel (gregorianischer
// Kalender), alle anderen beweglichen Feiertage sind relativ dazu definiert.

export interface Feiertag {
  datum: string; // JJJJ-MM-TT
  name: string;
}

function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function tageAddieren(datum: Date, tage: number): Date {
  const kopie = new Date(datum);
  kopie.setUTCDate(kopie.getUTCDate() + tage);
  return kopie;
}

function alsIsoDatum(datum: Date): string {
  return datum.toISOString().slice(0, 10);
}

/** Die elf gesetzlichen Feiertage Nordrhein-Westfalens für ein Kalenderjahr. */
export function feiertageNrw(jahr: number): Feiertag[] {
  const ostern = ostersonntag(jahr);
  return [
    { datum: `${jahr}-01-01`, name: "Neujahr" },
    { datum: alsIsoDatum(tageAddieren(ostern, -2)), name: "Karfreitag" },
    { datum: alsIsoDatum(tageAddieren(ostern, 1)), name: "Ostermontag" },
    { datum: `${jahr}-05-01`, name: "Tag der Arbeit" },
    { datum: alsIsoDatum(tageAddieren(ostern, 39)), name: "Christi Himmelfahrt" },
    { datum: alsIsoDatum(tageAddieren(ostern, 50)), name: "Pfingstmontag" },
    { datum: alsIsoDatum(tageAddieren(ostern, 60)), name: "Fronleichnam" },
    { datum: `${jahr}-10-03`, name: "Tag der Deutschen Einheit" },
    { datum: `${jahr}-11-01`, name: "Allerheiligen" },
    { datum: `${jahr}-12-25`, name: "1. Weihnachtstag" },
    { datum: `${jahr}-12-26`, name: "2. Weihnachtstag" },
  ].sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Ob "JJJJ-MM-TT" ein Feiertag ist, gegen eine vorab berechnete Liste geprüft. */
export function istFeiertag(datum: string, feiertage: Feiertag[]): boolean {
  return feiertage.some((f) => f.datum === datum);
}
