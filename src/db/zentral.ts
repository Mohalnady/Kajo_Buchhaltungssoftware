// Zugriff auf die zentrale Datei $APPDATA/kontor/kontor.db.
// Schema und Migration: src-tauri/migrations/zentral/0001_init.sql.

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import type { Benutzer, Rolle } from "../lib/types.ts";
import { uid } from "../lib/uid.ts";

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

interface BenutzerZeile {
  id: string;
  name: string;
  rolle: Rolle;
  aktiv: number;
  letzter_login: string | null;
}

function zeileZuBenutzer(z: BenutzerZeile): Benutzer {
  return { id: z.id, name: z.name, rolle: z.rolle, aktiv: z.aktiv === 1, letzter_login: z.letzter_login ?? undefined };
}

export async function benutzerAnzahl(): Promise<number> {
  const zeilen = await (await db()).select<{ anzahl: number }[]>("SELECT COUNT(*) as anzahl FROM benutzer");
  return zeilen[0]?.anzahl ?? 0;
}

export async function benutzerListe(): Promise<Benutzer[]> {
  const zeilen = await (await db()).select<BenutzerZeile[]>(
    "SELECT id, name, rolle, aktiv, letzter_login FROM benutzer ORDER BY name",
  );
  return zeilen.map(zeileZuBenutzer);
}

/** Legt einen Benutzer mit gehashtem Passwort an (Argon2, siehe Rust-Command "passwort_hashen"). */
export async function benutzerAnlegen(name: string, rolle: Rolle, passwort: string): Promise<Benutzer> {
  const hash = await invoke<{ hash: string; salt: string }>("passwort_hashen", { passwort });
  const id = uid();
  await (await db()).execute(
    "INSERT INTO benutzer (id, name, rolle, passwort_hash, salt, aktiv) VALUES ($1,$2,$3,$4,$5,1)",
    [id, name, rolle, hash.hash, hash.salt],
  );
  return { id, name, rolle, aktiv: true };
}

/** Erste Einrichtung: legt den ersten Benutzer als Inhaber an (siehe SPEC.md Abschnitt 8). */
export async function ersteBenutzerAnlegen(name: string, passwort: string): Promise<Benutzer> {
  return benutzerAnlegen(name, "inhaber", passwort);
}

export async function benutzerRolleUndAktivSpeichern(id: string, rolle: Rolle, aktiv: boolean): Promise<void> {
  await (await db()).execute("UPDATE benutzer SET rolle = $2, aktiv = $3 WHERE id = $1", [id, rolle, aktiv ? 1 : 0]);
}

export async function benutzerPasswortAendern(id: string, neuesPasswort: string): Promise<void> {
  const hash = await invoke<{ hash: string; salt: string }>("passwort_hashen", { passwort: neuesPasswort });
  await (await db()).execute("UPDATE benutzer SET passwort_hash = $2, salt = $3 WHERE id = $1", [id, hash.hash, hash.salt]);
}

/** Prüft Name+Passwort gegen die gespeicherten Hashes und meldet bei Erfolg den letzten Login-Zeitpunkt an. */
export async function benutzerAnmelden(name: string, passwort: string): Promise<Benutzer | null> {
  const zeilen = await (await db()).select<(BenutzerZeile & { passwort_hash: string })[]>(
    "SELECT id, name, rolle, aktiv, letzter_login, passwort_hash FROM benutzer WHERE name = $1",
    [name],
  );
  const zeile = zeilen[0];
  if (!zeile || zeile.aktiv !== 1) return null;
  const gueltig = await invoke<boolean>("passwort_pruefen", { passwort, hash: zeile.passwort_hash });
  if (!gueltig) return null;
  await (await db()).execute("UPDATE benutzer SET letzter_login = datetime('now') WHERE id = $1", [zeile.id]);
  return zeileZuBenutzer(zeile);
}
