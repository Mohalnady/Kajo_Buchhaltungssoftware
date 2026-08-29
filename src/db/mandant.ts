// Zugriff auf eine Mandanten-Datenbank unter $APPDATA/kontor/mandanten/<id>.db.
// Schema: src-tauri/migrations/mandant/0001_init.sql, ausgeliefert über den
// Tauri-Befehl `mandant_schema_sql` (siehe src-tauri/src/lib.rs für die
// Begründung, warum das nicht über das Migrationsregister des SQL-Plugins läuft).

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { mandantDbPfad } from "./pfade.ts";
import { mandantRegistrieren } from "./zentral.ts";
import { skr03Startkonten } from "../lib/skr03.ts";

const geoeffnet = new Map<string, Database>();

export async function mandantDbOeffnen(mandantId: string): Promise<Database> {
  const vorhanden = geoeffnet.get(mandantId);
  if (vorhanden) return vorhanden;
  const pfad = await mandantDbPfad(mandantId);
  const verbindung = await Database.load(`sqlite:${pfad}`);
  geoeffnet.set(mandantId, verbindung);
  return verbindung;
}

function zerlegeSchema(schema: string): string[] {
  return schema
    .split(";")
    .map((anweisung) => anweisung.trim())
    .filter((anweisung) => anweisung.length > 0 && !anweisung.startsWith("--"));
}

/**
 * Legt eine neue Mandanten-Datenbank an: Schema ausführen, Stammdatensatz und
 * SKR03-Startkonten einfügen, im zentralen Mandantenregister eintragen.
 */
export async function mandantAnlegen(id: string, name: string): Promise<void> {
  const pfad = await mandantDbPfad(id);
  const verbindung = await Database.load(`sqlite:${pfad}`);
  geoeffnet.set(id, verbindung);

  const schema = await invoke<string>("mandant_schema_sql");
  for (const anweisung of zerlegeSchema(schema)) {
    await verbindung.execute(anweisung);
  }

  await verbindung.execute("INSERT INTO mandant (id, name, firma) VALUES ($1, $2, $2)", [id, name]);

  for (const konto of skr03Startkonten()) {
    await verbindung.execute(
      "INSERT INTO konto (nr, name, typ, ust_satz, bwa_gruppe, aktiv, sortierung) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [konto.nr, konto.name, konto.typ, konto.ust_satz, konto.bwa_gruppe, konto.aktiv ? 1 : 0, konto.sortierung ?? 0],
    );
  }

  await mandantRegistrieren(id, name, pfad);
}
