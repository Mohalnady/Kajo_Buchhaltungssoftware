// Erzeugen und Wiederherstellen der Vollsicherung (SPEC.md Abschnitt 9).
// Anders als die übrige Datenquelle ist das nicht mandantenspezifisch — eine
// Sicherung umfasst die zentrale kontor.db und alle Mandanten samt ihrer
// Belege und Belegablage-Dokumente. Deshalb lebt das hier als eigenes Modul
// statt in repo/tauri.ts.

import { exists, mkdir, readDir, readFile, writeFile, remove } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { zipSync, unzipSync, type Zippable } from "fflate";
import { verschluesseln, entschluesseln } from "../lib/krypto.ts";
import { sicherungsdateiname, zuLoeschendeSicherungen } from "../lib/sicherung.ts";
import { mandantenListe } from "../db/zentral.ts";

export interface SicherungsManifest {
  erstellt_am: string;
  mandanten: { id: string; name: string; db_pfad: string }[];
}

async function zentraleDbPfad(): Promise<string> {
  // "sqlite:kontor.db" liegt relativ zu BaseDirectory::App, siehe tauri-plugin-sql.
  return join(await appDataDir(), "kontor.db");
}

async function alleDateienRekursiv(ordner: string): Promise<string[]> {
  if (!(await exists(ordner))) return [];
  const ergebnis: string[] = [];
  for (const eintrag of await readDir(ordner)) {
    if (!eintrag.name) continue;
    const pfad = await join(ordner, eintrag.name);
    if (eintrag.isDirectory) {
      ergebnis.push(...(await alleDateienRekursiv(pfad)));
    } else {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

/** Baut das Zip-Archiv (unverschlüsselt) mit zentraler DB, allen Mandanten-DBs sowie Belegen und Dokumenten. */
async function archivZusammenstellen(): Promise<Uint8Array> {
  const mandanten = await mandantenListe();
  const dateien: Zippable = {};

  const zentralPfad = await zentraleDbPfad();
  if (await exists(zentralPfad)) {
    dateien["kontor.db"] = await readFile(zentralPfad);
  }

  const basis = await appDataDir();
  for (const mandant of mandanten) {
    dateien[`mandanten/${mandant.id}.db`] = await readFile(mandant.db_pfad);
  }
  for (const unterordner of ["belege", "dokumente"]) {
    const ordner = await join(basis, "kontor", unterordner);
    for (const dateipfad of await alleDateienRekursiv(ordner)) {
      const relativ = dateipfad.slice(ordner.length).replace(/^[/\\]/, "");
      dateien[`${unterordner}/${relativ.split("\\").join("/")}`] = await readFile(dateipfad);
    }
  }

  const manifest: SicherungsManifest = {
    erstellt_am: new Date().toISOString(),
    mandanten: mandanten.map((m) => ({ id: m.id, name: m.name, db_pfad: m.db_pfad })),
  };
  dateien["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

  return zipSync(dateien);
}

/** Erstellt eine verschlüsselte Sicherung im gewählten Ordner und entfernt alte Sicherungen über dem Limit. */
export async function sicherungErstellen(zielOrdner: string, passphrase: string, behalten = 10): Promise<string> {
  const archiv = await archivZusammenstellen();
  const verschluesselt = await verschluesseln(archiv, passphrase);
  const dateiname = sicherungsdateiname(new Date());
  const zielPfad = await join(zielOrdner, dateiname);
  await mkdir(zielOrdner, { recursive: true });
  await writeFile(zielPfad, verschluesselt);

  const vorhandene = await sicherungenAuflisten(zielOrdner);
  for (const alteDatei of zuLoeschendeSicherungen(vorhandene, behalten)) {
    await remove(await join(zielOrdner, alteDatei));
  }

  return dateiname;
}

/** Listet die Sicherungsdateien in einem Ordner (nur Dateinamen, neueste zuerst behandelt der Aufrufer). */
export async function sicherungenAuflisten(ordner: string): Promise<string[]> {
  if (!(await exists(ordner))) return [];
  return (await readDir(ordner))
    .filter((e) => !e.isDirectory && e.name?.endsWith(".kontorbackup"))
    .map((e) => e.name!)
    .sort()
    .reverse();
}

/** Entschlüsselt eine Sicherung und liefert das Manifest zur Vorschau, ohne etwas zu überschreiben. */
export async function sicherungVorschau(pfad: string, passphrase: string): Promise<SicherungsManifest> {
  const verschluesselt = await readFile(pfad);
  const archiv = await entschluesseln(verschluesselt, passphrase);
  const dateien = unzipSync(archiv);
  const manifestBytes = dateien["manifest.json"];
  if (!manifestBytes) throw new Error("Kein gültiges Sicherungsarchiv (manifest.json fehlt).");
  return JSON.parse(new TextDecoder().decode(manifestBytes)) as SicherungsManifest;
}

/** Spielt eine Sicherung ein: überschreibt die zentrale DB, alle Mandanten-DBs sowie Belege und Dokumente. */
export async function sicherungEinspielen(pfad: string, passphrase: string): Promise<void> {
  const verschluesselt = await readFile(pfad);
  const archiv = await entschluesseln(verschluesselt, passphrase);
  const dateien = unzipSync(archiv);
  const basis = await appDataDir();

  for (const [zipPfad, inhalt] of Object.entries(dateien)) {
    if (zipPfad === "manifest.json") continue;
    if (zipPfad === "kontor.db") {
      await writeFile(await zentraleDbPfad(), inhalt);
      continue;
    }
    const teile = zipPfad.split("/");
    const dateiname = teile.pop()!;
    const ordner = teile[0] === "mandanten" ? await join(basis, "kontor", "mandanten") : await join(basis, "kontor", ...teile);
    await mkdir(ordner, { recursive: true });
    await writeFile(await join(ordner, dateiname), inhalt);
  }
}
