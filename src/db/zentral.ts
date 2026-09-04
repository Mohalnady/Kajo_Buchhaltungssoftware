// Zugriff auf die zentrale, SQLCipher-verschlüsselte Datei kontor.db unter
// $APPDATA/kontor/kontor.db (siehe db/pfade.ts). Schema und Migration:
// src-tauri/migrations/zentral/0001_init.sql, ausgeführt über den
// Rust-Befehl "db_zentral_anlegen" (siehe src-tauri/src/db.rs).
//
// Die Verbindung wird bewusst NICHT mehr träge beim ersten Zugriff
// aufgebaut (wie früher mit dem unverschlüsselten Plugin), sondern über
// zentraleDbAnlegen()/zentraleDbOeffnen() explizit hergestellt — dafür wird
// erst das Datenbank-Passwort benötigt (SPEC.md Abschnitt 8: "Schlüssel aus
// dem Passwort des Inhabers"), siehe die Entsperren-/Ersteinrichtung-Schritte
// in main.ts.

import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { dirname } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import VerschluesselteDatenbank from "./verschluesselt.ts";
import { zentraleDbPfad } from "./pfade.ts";
import type { Benutzer, Rolle } from "../lib/types.ts";
import { uid } from "../lib/uid.ts";

let verbindung: VerschluesselteDatenbank | null = null;

function db(): VerschluesselteDatenbank {
  if (!verbindung) {
    throw new Error("Zentrale Datenbank ist noch nicht entsperrt.");
  }
  return verbindung;
}

/** Ob schon eine Installation existiert (Ersteinrichtung vs. Entsperren-Bildschirm). */
export async function zentraleDbVorhanden(): Promise<boolean> {
  return exists(await zentraleDbPfad());
}

/** Erstellt die zentrale Datenbank neu und verschlüsselt sie mit dem übergebenen Schlüssel. */
export async function zentraleDbAnlegen(schluessel: string): Promise<void> {
  const pfad = await zentraleDbPfad();
  await mkdir(await dirname(pfad), { recursive: true });
  verbindung = await VerschluesselteDatenbank.zentralAnlegen(pfad, schluessel);
}

/** Öffnet die bestehende zentrale Datenbank mit dem Datenbank-Passwort. Wirft bei falschem Passwort. */
export async function zentraleDbOeffnen(schluessel: string): Promise<void> {
  const pfad = await zentraleDbPfad();
  verbindung = await VerschluesselteDatenbank.laden(pfad, schluessel);
}

/** Verschlüsselt die zentrale Datenbank mit einem neuen Schlüssel neu (Passwortänderung des Inhabers). */
export async function zentraleDbUmschluesseln(neuerSchluessel: string): Promise<void> {
  await db().umschluesseln(neuerSchluessel);
}

export interface MandantEintrag {
  id: string;
  name: string;
  db_pfad: string;
  angelegt_am: string;
}

export async function mandantenListe(): Promise<MandantEintrag[]> {
  return db().select<MandantEintrag[]>("SELECT * FROM mandant ORDER BY name");
}

export async function mandantRegistrieren(id: string, name: string, dbPfad: string): Promise<void> {
  await db().execute("INSERT INTO mandant (id, name, db_pfad) VALUES ($1, $2, $3)", [id, name, dbPfad]);
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
  const zeilen = await db().select<{ anzahl: number }[]>("SELECT COUNT(*) as anzahl FROM benutzer");
  return zeilen[0]?.anzahl ?? 0;
}

export async function benutzerListe(): Promise<Benutzer[]> {
  const zeilen = await db().select<BenutzerZeile[]>("SELECT id, name, rolle, aktiv, letzter_login FROM benutzer ORDER BY name");
  return zeilen.map(zeileZuBenutzer);
}

/** Legt einen Benutzer mit gehashtem Passwort an (Argon2, siehe Rust-Command "passwort_hashen"). */
export async function benutzerAnlegen(name: string, rolle: Rolle, passwort: string): Promise<Benutzer> {
  const hash = await invoke<{ hash: string; salt: string }>("passwort_hashen", { passwort });
  const id = uid();
  await db().execute("INSERT INTO benutzer (id, name, rolle, passwort_hash, salt, aktiv) VALUES ($1,$2,$3,$4,$5,1)", [
    id,
    name,
    rolle,
    hash.hash,
    hash.salt,
  ]);
  return { id, name, rolle, aktiv: true };
}

/** Erste Einrichtung: legt den ersten Benutzer als Inhaber an (siehe SPEC.md Abschnitt 8). */
export async function ersteBenutzerAnlegen(name: string, passwort: string): Promise<Benutzer> {
  return benutzerAnlegen(name, "inhaber", passwort);
}

export async function benutzerRolleUndAktivSpeichern(id: string, rolle: Rolle, aktiv: boolean): Promise<void> {
  await db().execute("UPDATE benutzer SET rolle = $2, aktiv = $3 WHERE id = $1", [id, rolle, aktiv ? 1 : 0]);
}

export async function benutzerPasswortAendern(id: string, neuesPasswort: string): Promise<void> {
  const hash = await invoke<{ hash: string; salt: string }>("passwort_hashen", { passwort: neuesPasswort });
  await db().execute("UPDATE benutzer SET passwort_hash = $2, salt = $3 WHERE id = $1", [id, hash.hash, hash.salt]);
}

/** Prüft Name+Passwort gegen die gespeicherten Hashes und meldet bei Erfolg den letzten Login-Zeitpunkt an. */
export async function benutzerAnmelden(name: string, passwort: string): Promise<Benutzer | null> {
  const zeilen = await db().select<(BenutzerZeile & { passwort_hash: string })[]>(
    "SELECT id, name, rolle, aktiv, letzter_login, passwort_hash FROM benutzer WHERE name = $1",
    [name],
  );
  const zeile = zeilen[0];
  if (!zeile || zeile.aktiv !== 1) return null;
  const gueltig = await invoke<boolean>("passwort_pruefen", { passwort, hash: zeile.passwort_hash });
  if (!gueltig) return null;
  await db().execute("UPDATE benutzer SET letzter_login = datetime('now') WHERE id = $1", [zeile.id]);
  return zeileZuBenutzer(zeile);
}

/** Schlüssel/Wert-Einstellungen, z. B. für die Sicherung (backup_ordner, backup_intervall, backup_letzte). */
export async function einstellungLesen(schluessel: string): Promise<string | null> {
  const zeilen = await db().select<{ wert: string | null }[]>("SELECT wert FROM einstellung WHERE schluessel = $1", [schluessel]);
  return zeilen[0]?.wert ?? null;
}

export async function einstellungSchreiben(schluessel: string, wert: string): Promise<void> {
  await db().execute("INSERT INTO einstellung (schluessel, wert) VALUES ($1, $2) ON CONFLICT (schluessel) DO UPDATE SET wert = $2", [
    schluessel,
    wert,
  ]);
}
