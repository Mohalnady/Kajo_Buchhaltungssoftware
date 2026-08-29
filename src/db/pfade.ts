// Pfadaufbau gemäß SPEC.md Abschnitt 2 und 4.

import { appDataDir, join } from "@tauri-apps/api/path";

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
