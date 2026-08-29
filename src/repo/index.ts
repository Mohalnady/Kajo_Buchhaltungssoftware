// Wählt die passende Datenquelle: echtes SQLite im Tauri-Fenster, sonst die
// In-Memory-Vorschau (z. B. `npm run dev` im Browser oder eine Artifact-Vorschau).

import { erstelleVorschauDatenquelle } from "./vorschau.ts";
import { erstelleTauriDatenquelle } from "./tauri.ts";
import type { Datenquelle } from "./typen.ts";
import { mandantenListe } from "../db/zentral.ts";
import { mandantAnlegen, mandantDbOeffnen } from "../db/mandant.ts";
import { uid } from "../lib/uid.ts";

export function istTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Öffnet die Datenquelle. In der Desktop-App wird beim allerersten Start ein
 * Mandant "Meine Firma" mit den SKR03-Startkonten angelegt (siehe
 * db/mandant.ts); danach wird immer der erste Mandant im Register geöffnet.
 * Mehrere Mandanten nebeneinander verwalten kommt mit der Firmenverwaltung.
 */
export async function erstelleDatenquelle(): Promise<Datenquelle> {
  if (!istTauri()) {
    return erstelleVorschauDatenquelle();
  }
  const mandanten = await mandantenListe();
  let mandantId = mandanten[0]?.id;
  if (!mandantId) {
    mandantId = uid();
    await mandantAnlegen(mandantId, "Meine Firma");
  }
  const db = await mandantDbOeffnen(mandantId);
  return erstelleTauriDatenquelle(db, mandantId);
}
