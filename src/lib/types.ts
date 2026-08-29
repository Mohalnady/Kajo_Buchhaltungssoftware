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
