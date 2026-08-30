// Datenquelle: eine Abstraktion über den eigentlichen Speicherort.
//
// In der echten Desktop-App liegt das in der SQLite-Datenbank des Mandanten
// (siehe repo/tauri.ts). Im Browser — etwa für die Vorschau ohne Tauri-Fenster —
// gibt es keine SQLite-Anbindung; dort hält repo/vorschau.ts die Daten nur im
// Arbeitsspeicher. Die Oberfläche in main.ts kennt nur dieses Interface und
// muss zwischen beidem nicht unterscheiden.

import type {
  Beleg,
  Buchung,
  Dokument,
  DokumentTyp,
  ImportFormat,
  Importlauf,
  Importregel,
  Konto,
  Kostenstelle,
  Mitarbeiter,
  Zeiteintrag,
  Zuschlagsregel,
} from "../lib/types.ts";
import type { Gutschein } from "../lib/gutschein.ts";

export interface LoeschErgebnis {
  ok: boolean;
  grund?: string;
}

export interface MandantEinstellungen {
  firma: string;
  inhaber: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  stnr: string;
  ustid: string;
  tel: string;
  mail: string;
  logoPfad: string | null;
  kassenAnfangsbestand: number;
  kleinunternehmer: boolean;
  versteuerung: "ist" | "soll";
  voranmeldung: "monatlich" | "quartalsweise" | "jaehrlich";
}

export interface NeuesLogo {
  dateiname: string;
  mime: string;
  inhalt: Uint8Array;
}

export interface GutscheinAusgabe {
  nummer: string;
  ausgabe_datum: string;
  betrag: number;
  zahlungskonto: string; // Finanzkonto, das den Gegenwert erhält (Kasse/Bank/Karte)
}

export interface GutscheinEinloesung {
  id: string;
  betrag: number;
  datum: string;
  erloesKonto: string; // Erlöskonto mit dem Steuersatz der gekauften Ware
}

export interface NeuerBeleg {
  buchung_id: string;
  dateiname: string;
  mime: string;
  inhalt: Uint8Array;
}

export interface ImportUebernahme {
  buchungen: Buchung[];
  datei: string;
  format: ImportFormat;
  zeilen: number;
}

export interface NeuesDokument {
  typ: DokumentTyp;
  datum: string;
  dateiname: string;
  mime: string;
  inhalt: Uint8Array;
}

export interface Datenquelle {
  modus: "tauri" | "vorschau";

  mandantEinstellungen(): Promise<MandantEinstellungen>;
  mandantEinstellungenSpeichern(profil: MandantEinstellungen): Promise<void>;
  logoSpeichern(logo: NeuesLogo): Promise<void>;
  logoEntfernen(): Promise<void>;
  logoInhalt(): Promise<Blob | null>;
  erstinbetriebnahmeAbgeschlossen(): Promise<boolean>;
  erstinbetriebnahmeAbschliessen(): Promise<void>;
  gutscheine(): Promise<Gutschein[]>;
  gutscheinAusgeben(eingabe: GutscheinAusgabe): Promise<void>;
  gutscheinEinloesen(eingabe: GutscheinEinloesung): Promise<LoeschErgebnis>;

  konten(): Promise<Konto[]>;
  kontoSpeichern(konto: Konto): Promise<void>;
  kontoLoeschen(nr: string): Promise<LoeschErgebnis>;

  kostenstellen(): Promise<Kostenstelle[]>;
  kostenstelleSpeichern(kostenstelle: Kostenstelle): Promise<void>;
  kostenstelleLoeschen(id: string): Promise<LoeschErgebnis>;

  buchungen(): Promise<Buchung[]>;
  buchungSpeichern(buchung: Buchung): Promise<void>;
  buchungLoeschen(id: string): Promise<void>;

  belegeVon(buchungId: string): Promise<Beleg[]>;
  belegAnhaengen(neuerBeleg: NeuerBeleg): Promise<void>;
  belegLoeschen(id: string): Promise<void>;
  belegInhalt(beleg: Beleg): Promise<Blob>;

  importregeln(): Promise<Importregel[]>;
  importregelSpeichern(regel: Importregel): Promise<void>;
  importregelLoeschen(id: string): Promise<void>;

  importlaeufe(): Promise<Importlauf[]>;
  buchungenUebernehmen(eingabe: ImportUebernahme): Promise<void>;
  importRueckgaengig(importlaufId: string): Promise<void>;

  dokumente(): Promise<Dokument[]>;
  dokumentHinzufuegen(neuesDokument: NeuesDokument): Promise<void>;
  dokumentLoeschen(id: string): Promise<void>;
  dokumentInhalt(dokument: Dokument): Promise<Blob>;

  mitarbeiterListe(): Promise<Mitarbeiter[]>;
  mitarbeiterSpeichern(mitarbeiter: Mitarbeiter): Promise<void>;
  mitarbeiterLoeschen(id: string): Promise<LoeschErgebnis>;

  zeiteintraege(): Promise<Zeiteintrag[]>;
  zeiteintragSpeichern(eintrag: Zeiteintrag): Promise<void>;
  zeiteintragLoeschen(id: string): Promise<void>;
  zeiteintragEinreichen(id: string): Promise<void>;
  zeiteintragFreigeben(id: string): Promise<void>;
  zeiteintragAblehnen(id: string): Promise<void>;

  zuschlagsregeln(): Promise<Zuschlagsregel[]>;
  zuschlagsregelSpeichern(regel: Zuschlagsregel): Promise<void>;
  zuschlagsregelLoeschen(id: string): Promise<void>;
}
