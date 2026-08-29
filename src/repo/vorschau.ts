// In-Memory-Datenquelle für die Vorschau im Browser (kein Tauri-Fenster,
// keine SQLite-Anbindung möglich). Änderungen bleiben nur für die laufende
// Sitzung erhalten und gehen beim Neuladen der Seite verloren.

import type { Buchung, Konto, Kostenstelle } from "../lib/types.ts";
import type { Gutschein } from "../lib/gutschein.ts";
import { skr03Startkonten } from "../lib/skr03.ts";
import type { Datenquelle, LoeschErgebnis } from "./typen.ts";

function anfangsGutscheine(): Gutschein[] {
  return [
    { nummer: "G-2026-014", betrag: 25, eingeloest_betrag: 0, status: "offen" },
    { nummer: "G-2026-018", betrag: 50, eingeloest_betrag: 20, status: "teilweise_eingeloest" },
  ];
}

function anfangsBuchungen(): Buchung[] {
  const heute = new Date().toISOString().slice(0, 10);
  const monat = heute.slice(0, 7);
  return [
    { id: "d1", datum: `${monat}-03`, text: "Tageseinnahmen Bar", konto: "8400", gegenkonto: "1000", betrag_brutto: 892.5, ust_satz: 19, quelle: "manuell", storniert: false },
    { id: "d2", datum: `${monat}-03`, text: "Tageseinnahmen Karte", konto: "8300", gegenkonto: "1210", betrag_brutto: 340.1, ust_satz: 7, quelle: "manuell", storniert: false },
    { id: "d3", datum: `${monat}-05`, text: "Wareneinkauf Großhandel", konto: "3300", gegenkonto: "1200", betrag_brutto: 610.4, ust_satz: 7, quelle: "manuell", storniert: false },
    { id: "d4", datum: `${monat}-07`, text: "Miete Ladenlokal", konto: "4210", gegenkonto: "1200", betrag_brutto: 950, ust_satz: 0, quelle: "manuell", storniert: false },
    { id: "d5", datum: `${monat}-10`, text: "Strom und Wasser", konto: "4240", gegenkonto: "1200", betrag_brutto: 180.2, ust_satz: 19, quelle: "manuell", storniert: false },
    { id: "d6", datum: `${monat}-12`, text: "Bareinzahlung Tageskasse", konto: "1000", gegenkonto: "1360", betrag_brutto: 500, ust_satz: 0, quelle: "manuell", storniert: false },
  ];
}

export function erstelleVorschauDatenquelle(): Datenquelle {
  const konten: Konto[] = skr03Startkonten();
  const kostenstellen: Kostenstelle[] = [];
  const buchungen: Buchung[] = anfangsBuchungen();
  const gutscheine: Gutschein[] = anfangsGutscheine();

  return {
    modus: "vorschau",

    async mandantEinstellungen() {
      return { kassenAnfangsbestand: 200, kleinunternehmer: false };
    },
    async gutscheine() {
      return gutscheine.slice();
    },

    async konten() {
      return konten.slice();
    },
    async kontoSpeichern(konto) {
      const i = konten.findIndex((k) => k.nr === konto.nr);
      if (i >= 0) konten[i] = konto;
      else konten.push(konto);
    },
    async kontoLoeschen(nr): Promise<LoeschErgebnis> {
      if (buchungen.some((b) => b.konto === nr || b.gegenkonto === nr)) {
        return { ok: false, grund: "Konto wird noch bebucht." };
      }
      const i = konten.findIndex((k) => k.nr === nr);
      if (i >= 0) konten.splice(i, 1);
      return { ok: true };
    },

    async kostenstellen() {
      return kostenstellen.slice();
    },
    async kostenstelleSpeichern(kostenstelle) {
      const i = kostenstellen.findIndex((k) => k.id === kostenstelle.id);
      if (i >= 0) kostenstellen[i] = kostenstelle;
      else kostenstellen.push(kostenstelle);
    },
    async kostenstelleLoeschen(id): Promise<LoeschErgebnis> {
      if (buchungen.some((b) => b.kostenstelle_id === id)) {
        return { ok: false, grund: "Kostenstelle wird noch bebucht." };
      }
      const i = kostenstellen.findIndex((k) => k.id === id);
      if (i >= 0) kostenstellen.splice(i, 1);
      return { ok: true };
    },

    async buchungen() {
      return buchungen.slice();
    },
    async buchungSpeichern(buchung) {
      const i = buchungen.findIndex((b) => b.id === buchung.id);
      if (i >= 0) buchungen[i] = buchung;
      else buchungen.push(buchung);
    },
    async buchungLoeschen(id) {
      const i = buchungen.findIndex((b) => b.id === id);
      if (i >= 0) buchungen.splice(i, 1);
    },
  };
}
