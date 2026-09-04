// Eigene, SQLCipher-verschlüsselte Datenbankanbindung als Ersatz für
// @tauri-apps/plugin-sql — siehe src-tauri/src/db.rs für die Begründung
// (das Plugin bietet keinen Weg, vor der ersten Abfrage einen
// Verschlüsselungsschlüssel zu setzen). Dieselben Methodennamen und
// -formen wie die bisherige Database-Klasse, damit sich repo/tauri.ts und
// die restliche Datenzugriffsschicht nicht ändern mussten.

import { invoke } from "@tauri-apps/api/core";

export interface AusfuehrenErgebnis {
  rowsAffected: number;
  lastInsertId: number;
}

export default class VerschluesselteDatenbank {
  private constructor(private readonly pfad: string) {}

  /** Öffnet eine bereits bestehende, verschlüsselte Datenbank. */
  static async laden(pfad: string, schluessel: string): Promise<VerschluesselteDatenbank> {
    await invoke("db_oeffnen", { pfad, schluessel });
    return new VerschluesselteDatenbank(pfad);
  }

  /** Legt die zentrale Datenbank (Mandantenregister, Benutzer, Einstellungen) neu an. */
  static async zentralAnlegen(pfad: string, schluessel: string): Promise<VerschluesselteDatenbank> {
    await invoke("db_zentral_anlegen", { pfad, schluessel });
    return new VerschluesselteDatenbank(pfad);
  }

  /** Legt eine neue Mandanten-Datenbank mit dem Standardschema an. */
  static async mandantAnlegen(pfad: string, schluessel: string): Promise<VerschluesselteDatenbank> {
    await invoke("db_mandant_anlegen", { pfad, schluessel });
    return new VerschluesselteDatenbank(pfad);
  }

  async select<T>(sql: string, werte: unknown[] = []): Promise<T> {
    return invoke<T>("db_auswaehlen", { pfad: this.pfad, sql, werte });
  }

  async execute(sql: string, werte: unknown[] = []): Promise<AusfuehrenErgebnis> {
    return invoke<AusfuehrenErgebnis>("db_ausfuehren", { pfad: this.pfad, sql, werte });
  }

  /** SQLCipher PRAGMA rekey — verschlüsselt diese Datenbank mit einem neuen Schlüssel neu. */
  async umschluesseln(neuerSchluessel: string): Promise<void> {
    await invoke("db_umschluesseln", { pfad: this.pfad, neuerSchluessel });
  }
}
