// Datenquelle: eine Abstraktion über den eigentlichen Speicherort.
//
// In der echten Desktop-App liegt das in der SQLite-Datenbank des Mandanten
// (siehe repo/tauri.ts). Im Browser — etwa für die Vorschau ohne Tauri-Fenster —
// gibt es keine SQLite-Anbindung; dort hält repo/vorschau.ts die Daten nur im
// Arbeitsspeicher. Die Oberfläche in main.ts kennt nur dieses Interface und
// muss zwischen beidem nicht unterscheiden.

import type { Buchung, Konto, Kostenstelle } from "../lib/types.ts";
import type { Gutschein } from "../lib/gutschein.ts";

export interface LoeschErgebnis {
  ok: boolean;
  grund?: string;
}

export interface MandantEinstellungen {
  kassenAnfangsbestand: number;
  kleinunternehmer: boolean;
}

export interface Datenquelle {
  modus: "tauri" | "vorschau";

  mandantEinstellungen(): Promise<MandantEinstellungen>;
  gutscheine(): Promise<Gutschein[]>;

  konten(): Promise<Konto[]>;
  kontoSpeichern(konto: Konto): Promise<void>;
  kontoLoeschen(nr: string): Promise<LoeschErgebnis>;

  kostenstellen(): Promise<Kostenstelle[]>;
  kostenstelleSpeichern(kostenstelle: Kostenstelle): Promise<void>;
  kostenstelleLoeschen(id: string): Promise<LoeschErgebnis>;

  buchungen(): Promise<Buchung[]>;
  buchungSpeichern(buchung: Buchung): Promise<void>;
  buchungLoeschen(id: string): Promise<void>;
}
