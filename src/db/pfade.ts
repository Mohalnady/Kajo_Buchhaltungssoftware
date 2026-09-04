// Pfadaufbau gemäß SPEC.md Abschnitt 2 und 4.
//
// Alles liegt unter $APPDATA/kontor/ — auch die zentrale kontor.db selbst.
// (Frühere Fassungen legten sie über tauri-plugin-sql unter $APPCONFIG ab,
// ein Detail der damaligen Plugin-Implementierung. Seit der eigenen
// SQLCipher-Anbindung in src-tauri/src/db.rs bestimmt die Oberfläche den
// Pfad selbst, deshalb die Vereinheitlichung.)

import { appDataDir, join } from "@tauri-apps/api/path";

export async function zentraleDbPfad(): Promise<string> {
  const basis = await appDataDir();
  return join(basis, "kontor", "kontor.db");
}

export async function mandantDbPfad(mandantId: string): Promise<string> {
  const basis = await appDataDir();
  return join(basis, "kontor", "mandanten", `${mandantId}.db`);
}

export async function belegeOrdner(mandantId: string, jahr: number): Promise<string> {
  const basis = await appDataDir();
  return join(basis, "kontor", "belege", mandantId, String(jahr));
}

export async function dokumenteOrdner(mandantId: string, jahr: number): Promise<string> {
  const basis = await appDataDir();
  return join(basis, "kontor", "dokumente", mandantId, String(jahr));
}

export async function logoOrdner(mandantId: string): Promise<string> {
  const basis = await appDataDir();
  return join(basis, "kontor", "logo", mandantId);
}
