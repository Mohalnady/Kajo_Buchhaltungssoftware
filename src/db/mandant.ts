// Zugriff auf eine Mandanten-Datenbank unter $APPDATA/kontor/mandanten/<id>.db,
// verschlüsselt mit demselben Schlüssel wie die zentrale Datenbank (siehe
// db/sitzungsschluessel.ts). Schema: src-tauri/migrations/mandant/0001_init.sql,
// ausgeführt über den Rust-Befehl "db_mandant_anlegen" (siehe src-tauri/src/db.rs).

import { mkdir } from "@tauri-apps/plugin-fs";
import { dirname } from "@tauri-apps/api/path";
import VerschluesselteDatenbank from "./verschluesselt.ts";
import { mandantDbPfad } from "./pfade.ts";
import { mandantRegistrieren } from "./zentral.ts";
import { schluesselLesen } from "./sitzungsschluessel.ts";
import { skr03Startkonten } from "../lib/skr03.ts";

const geoeffnet = new Map<string, VerschluesselteDatenbank>();

export async function mandantDbOeffnen(mandantId: string): Promise<VerschluesselteDatenbank> {
  const vorhanden = geoeffnet.get(mandantId);
  if (vorhanden) return vorhanden;
  const pfad = await mandantDbPfad(mandantId);
  const verbindung = await VerschluesselteDatenbank.laden(pfad, schluesselLesen());
  geoeffnet.set(mandantId, verbindung);
  return verbindung;
}

/**
 * Legt eine neue Mandanten-Datenbank an: Schema ausführen, Stammdatensatz und
 * SKR03-Startkonten einfügen, im zentralen Mandantenregister eintragen.
 */
export async function mandantAnlegen(id: string, name: string): Promise<void> {
  const pfad = await mandantDbPfad(id);
  await mkdir(await dirname(pfad), { recursive: true });
  const verbindung = await VerschluesselteDatenbank.mandantAnlegen(pfad, schluesselLesen());
  geoeffnet.set(id, verbindung);

  await verbindung.execute("INSERT INTO mandant (id, name, firma) VALUES ($1, $2, $2)", [id, name]);

  for (const konto of skr03Startkonten()) {
    await verbindung.execute(
      "INSERT INTO konto (nr, name, typ, ust_satz, bwa_gruppe, aktiv, sortierung) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [konto.nr, konto.name, konto.typ, konto.ust_satz, konto.bwa_gruppe, konto.aktiv ? 1 : 0, konto.sortierung ?? 0],
    );
  }

  await mandantRegistrieren(id, name, pfad);
}

/**
 * Verschlüsselt alle gerade offenen Mandanten-Datenbanken mit einem neuen
 * Schlüssel neu — zusammen mit zentraleDbUmschluesseln() für die
 * Passwortänderung des Inhabers, dessen Passwort laut SPEC.md Abschnitt 8
 * den gemeinsamen Datenbankschlüssel bildet.
 */
export async function alleOffenenMandantenUmschluesseln(neuerSchluessel: string): Promise<void> {
  for (const verbindung of geoeffnet.values()) {
    await verbindung.umschluesseln(neuerSchluessel);
  }
}
