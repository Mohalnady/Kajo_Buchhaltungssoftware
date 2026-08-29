// In-Memory-Datenquelle für die Vorschau im Browser (kein Tauri-Fenster,
// keine SQLite-Anbindung möglich). Änderungen bleiben nur für die laufende
// Sitzung erhalten und gehen beim Neuladen der Seite verloren.

import type { Beleg, Buchung, Importlauf, Importregel, Konto, Kostenstelle } from "../lib/types.ts";
import type { Gutschein } from "../lib/gutschein.ts";
import { offenerBetrag, statusNachEinloesung } from "../lib/gutschein.ts";
import { round2 } from "../lib/numbers.ts";
import { skr03Startkonten } from "../lib/skr03.ts";
import { uid } from "../lib/uid.ts";
import type { Datenquelle, LoeschErgebnis } from "./typen.ts";

// Blob-Inhalte der Vorschau-Belege leben nur im Arbeitsspeicher der Sitzung.
const belegBlobs = new Map<string, Blob>();

function anfangsGutscheine(): Gutschein[] {
  return [
    { id: "gs1", nummer: "G-2026-014", ausgabe_datum: "2026-08-01", betrag: 25, eingeloest_betrag: 0, status: "offen" },
    { id: "gs2", nummer: "G-2026-018", ausgabe_datum: "2026-08-05", betrag: 50, eingeloest_betrag: 20, eingeloest_datum: "2026-08-10", status: "teilweise_eingeloest" },
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
  const belege: Beleg[] = [];
  const importregeln: Importregel[] = [];
  const importlaeufe: Importlauf[] = [];

  return {
    modus: "vorschau",

    async mandantEinstellungen() {
      return { kassenAnfangsbestand: 200, kleinunternehmer: false, versteuerung: "ist", voranmeldung: "monatlich" };
    },
    async gutscheine() {
      return gutscheine.slice();
    },
    async gutscheinAusgeben(eingabe) {
      gutscheine.push({
        id: uid(),
        nummer: eingabe.nummer,
        ausgabe_datum: eingabe.ausgabe_datum,
        betrag: eingabe.betrag,
        eingeloest_betrag: 0,
        status: "offen",
      });
      buchungen.push({
        id: uid(),
        datum: eingabe.ausgabe_datum,
        text: `Gutschein ausgegeben ${eingabe.nummer}`,
        konto: "1700",
        gegenkonto: eingabe.zahlungskonto,
        betrag_brutto: eingabe.betrag,
        ust_satz: 0,
        quelle: "manuell",
        storniert: false,
      });
    },
    async gutscheinEinloesen(eingabe): Promise<LoeschErgebnis> {
      const g = gutscheine.find((x) => x.id === eingabe.id);
      if (!g) return { ok: false, grund: "Gutschein nicht gefunden." };
      if (round2(eingabe.betrag) > offenerBetrag(g)) {
        return { ok: false, grund: "Betrag übersteigt den Restbetrag des Gutscheins." };
      }
      const erloesKonto = konten.find((k) => k.nr === eingabe.erloesKonto);
      const neuerStatus = statusNachEinloesung(g, eingabe.betrag);
      g.eingeloest_betrag = round2(g.eingeloest_betrag + eingabe.betrag);
      g.eingeloest_datum = eingabe.datum;
      g.status = neuerStatus;
      buchungen.push({
        id: uid(),
        datum: eingabe.datum,
        text: `Gutschein eingelöst ${g.nummer}`,
        konto: eingabe.erloesKonto,
        gegenkonto: "1700",
        betrag_brutto: eingabe.betrag,
        ust_satz: erloesKonto?.ust_satz ?? 0,
        quelle: "manuell",
        storniert: false,
      });
      return { ok: true };
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

    async belegeVon(buchungId) {
      return belege.filter((b) => b.buchung_id === buchungId);
    },
    async belegAnhaengen(neuerBeleg) {
      const id = uid();
      belegBlobs.set(id, new Blob([neuerBeleg.inhalt as BlobPart], { type: neuerBeleg.mime }));
      belege.push({
        id,
        buchung_id: neuerBeleg.buchung_id,
        dateiname: neuerBeleg.dateiname,
        pfad: `vorschau:${id}`,
        mime: neuerBeleg.mime,
        groesse: neuerBeleg.inhalt.byteLength,
        hinzugefuegt_am: new Date().toISOString(),
      });
    },
    async belegLoeschen(id) {
      const i = belege.findIndex((b) => b.id === id);
      if (i >= 0) belege.splice(i, 1);
      belegBlobs.delete(id);
    },
    async belegInhalt(beleg) {
      return belegBlobs.get(beleg.id) ?? new Blob([]);
    },

    async importregeln() {
      return importregeln.slice().sort((a, b) => b.prioritaet - a.prioritaet);
    },
    async importregelSpeichern(regel) {
      const i = importregeln.findIndex((r) => r.id === regel.id);
      if (i >= 0) importregeln[i] = regel;
      else importregeln.push(regel);
    },
    async importregelLoeschen(id) {
      const i = importregeln.findIndex((r) => r.id === id);
      if (i >= 0) importregeln.splice(i, 1);
    },

    async importlaeufe() {
      return importlaeufe.slice();
    },
    async buchungenUebernehmen(eingabe) {
      const importlaufId = uid();
      importlaeufe.push({
        id: importlaufId,
        datei: eingabe.datei,
        format: eingabe.format,
        zeilen: eingabe.zeilen,
        uebernommen: eingabe.buchungen.length,
        datum: new Date().toISOString(),
      });
      for (const b of eingabe.buchungen) {
        buchungen.push({ ...b, import_id: importlaufId });
      }
    },
    async importRueckgaengig(importlaufId) {
      for (let i = buchungen.length - 1; i >= 0; i--) {
        if (buchungen[i].import_id === importlaufId) buchungen.splice(i, 1);
      }
    },
  };
}
