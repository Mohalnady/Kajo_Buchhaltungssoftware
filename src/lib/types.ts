// Kerntypen des Datenmodells, siehe SPEC.md Abschnitt 4.

export type KontoTyp = "erloes" | "aufwand" | "finanz" | "privat" | "bestand";

export interface Konto {
  nr: string;
  name: string;
  typ: KontoTyp;
  ust_satz: number;
  bwa_gruppe: string;
  euer_zeile?: number;
  datev_konto?: string;
  aktiv: boolean;
  sortierung?: number;
}

export type BuchungsQuelle =
  | "manuell"
  | "import_bank"
  | "import_kasse"
  | "import_excel"
  | "dauerbuchung";

export interface Buchung {
  id: string;
  datum: string; // JJJJ-MM-TT, Rechnungs-/Leistungsdatum
  wertstellung?: string; // JJJJ-MM-TT, Zahlungsdatum (für Ist-Versteuerung)
  belegnr?: string;
  text: string;
  konto: string;
  gegenkonto: string;
  betrag_brutto: number;
  ust_satz: number;
  kostenstelle_id?: string;
  quelle: BuchungsQuelle;
  import_id?: string;
  storniert: boolean;
}

export interface Kostenstelle {
  id: string;
  name: string;
  notiz: string;
  aktiv: boolean;
}

export interface Beleg {
  id: string;
  buchung_id: string;
  dateiname: string;
  pfad: string; // Tauri: realer Dateipfad; Vorschau: interner Objekt-URL-Schlüssel
  mime: string;
  groesse: number;
  hinzugefuegt_am: string;
}

// Unabhängig von einzelnen Buchungen: Kassenberichte, Rechnungen und sonstige
// Unterlagen, laufend abgelegt und später als Monatspaket für den
// Steuerberater gebündelt. Siehe SPEC.md Abschnitt 7 "Monatspaket".
export type DokumentTyp = "kassenbericht" | "rechnung" | "beleg" | "sonstiges";

export interface Dokument {
  id: string;
  typ: DokumentTyp;
  datum: string; // JJJJ-MM-TT, der Tag, zu dem die Unterlage gehört (nicht der Uploadzeitpunkt)
  dateiname: string;
  pfad: string; // Tauri: realer Dateipfad; Vorschau: interner Objekt-URL-Schlüssel
  mime: string;
  groesse: number;
  hinzugefuegt_am: string;
}

export type ImportFormat = "csv" | "tsv" | "json" | "markdown" | "excel";

export interface Importlauf {
  id: string;
  datei: string;
  format: ImportFormat;
  zeilen: number;
  uebernommen: number;
  datum: string;
}

export interface Importregel {
  id: string;
  stichwoerter: string; // kommagetrennt
  konto: string;
  prioritaet: number;
  aktiv: boolean;
}

export interface BetragSplit {
  brutto: number;
  netto: number;
  steuer: number;
  satz: number;
}

export interface Mandant {
  kleinunternehmer: boolean;
  versteuerung: "ist" | "soll";
  kassen_anfangsbestand: number;
}

// Personal, siehe SPEC.md Abschnitt 5.7.

export type Beschaeftigungsart = "minijob" | "teilzeit" | "vollzeit" | "aushilfe";

export interface Mitarbeiter {
  id: string;
  name: string;
  personalnr?: string;
  rolle: string;
  beschaeftigungsart: Beschaeftigungsart;
  eintritt: string; // JJJJ-MM-TT
  austritt?: string;
  stundenlohn: number;
  wochenstunden: number;
  urlaubstage_jahr: number;
  aktiv: boolean;
  benutzer_id?: string; // verknüpft mit benutzer.id in der zentralen kontor.db, für "eigene Stunden erfassen"
}

export type ZeiteintragArt = "arbeit" | "urlaub" | "krank" | "feiertag" | "frei";
export type ZeiteintragStatus = "entwurf" | "eingereicht" | "freigegeben" | "abgelehnt";

export interface Zeiteintrag {
  id: string;
  mitarbeiter_id: string;
  datum: string; // JJJJ-MM-TT
  von?: string; // "HH:MM"
  bis?: string; // "HH:MM"
  pause_min: number;
  stunden: number; // berechneter Wert, siehe lib/stunden.ts
  art: ZeiteintragArt;
  notiz: string;
  status: ZeiteintragStatus;
  freigegeben_von?: string;
  freigegeben_am?: string;
}

export interface Zuschlagsregel {
  id: string;
  art: "nacht" | "sonntag" | "feiertag";
  von_uhrzeit?: string; // "HH:MM", nur bei art "nacht"
  bis_uhrzeit?: string;
  prozent: number;
  aktiv: boolean;
}

// Zugang, siehe SPEC.md Abschnitt 8. Passwort-Hash/Salt bleiben Interna des
// Datenzugriffs (db/zentral.ts) und tauchen in diesem Typ bewusst nicht auf,
// damit sie nicht versehentlich durch die Oberfläche gereicht werden.
export type Rolle = "inhaber" | "buchhalter" | "mitarbeiter" | "steuerberater";

export interface Benutzer {
  id: string;
  name: string;
  rolle: Rolle;
  aktiv: boolean;
  letzter_login?: string;
}
