// Zugriff auf die zentrale Datei $APPDATA/kontor/kontor.db.
// Schema und Migration: src-tauri/migrations/zentral/0001_init.sql.

import Database from "@tauri-apps/plugin-sql";

let verbindung: Database | null = null;

async function db(): Promise<Database> {
  if (!verbindung) {
    verbindung = await Database.load("sqlite:kontor.db");
  }
  return verbindung;
}

export interface MandantEintrag {
  id: string;
  name: string;
  db_pfad: string;
  angelegt_am: string;
}

export async function mandantenListe(): Promise<MandantEintrag[]> {
  return (await db()).select<MandantEintrag[]>("SELECT * FROM mandant ORDER BY name");
}

export async function mandantRegistrieren(id: string, name: string, dbPfad: string): Promise<void> {
  await (await db()).execute("INSERT INTO mandant (id, name, db_pfad) VALUES ($1, $2, $3)", [id, name, dbPfad]);
}
