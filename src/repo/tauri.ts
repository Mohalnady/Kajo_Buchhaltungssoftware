// Echte Datenquelle über die Mandanten-SQLite-Datenbank (Tauri-Desktop-App).
// Siehe src/db/mandant.ts fürs Öffnen/Anlegen der Datenbank und
// src-tauri/migrations/mandant/0001_init.sql fürs Schema.

import type Database from "@tauri-apps/plugin-sql";
import { mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { Beleg, Buchung, Dokument, Importlauf, Konto, Kostenstelle } from "../lib/types.ts";
import type { Gutschein } from "../lib/gutschein.ts";
import { offenerBetrag, statusNachEinloesung } from "../lib/gutschein.ts";
import { round2 } from "../lib/numbers.ts";
import { uid } from "../lib/uid.ts";
import { belegeOrdner, dokumenteOrdner } from "../db/pfade.ts";
import type { Datenquelle, LoeschErgebnis, MandantEinstellungen } from "./typen.ts";

interface KontoZeile {
  nr: string;
  name: string;
  typ: Konto["typ"];
  ust_satz: number;
  bwa_gruppe: string;
  euer_zeile: number | null;
  datev_konto: string | null;
  aktiv: number;
  sortierung: number;
}

interface KostenstelleZeile {
  id: string;
  name: string;
  notiz: string;
  aktiv: number;
}

interface BuchungZeile {
  id: string;
  datum: string;
  belegnr: string;
  text: string;
  konto: string;
  gegenkonto: string;
  betrag_brutto: number;
  ust_satz: number;
  kostenstelle_id: string | null;
  quelle: Buchung["quelle"];
  storniert: number;
}

export function erstelleTauriDatenquelle(db: Database, mandantId: string): Datenquelle {
  return {
    modus: "tauri",

    async mandantEinstellungen(): Promise<MandantEinstellungen> {
      const zeilen = await db.select<
        { kassen_anfangsbestand: number; kleinunternehmer: number; versteuerung: "ist" | "soll"; voranmeldung: MandantEinstellungen["voranmeldung"] }[]
      >("SELECT kassen_anfangsbestand, kleinunternehmer, versteuerung, voranmeldung FROM mandant LIMIT 1");
      const z = zeilen[0];
      return {
        kassenAnfangsbestand: z?.kassen_anfangsbestand ?? 0,
        kleinunternehmer: z?.kleinunternehmer === 1,
        versteuerung: z?.versteuerung ?? "ist",
        voranmeldung: z?.voranmeldung ?? "monatlich",
      };
    },

    async gutscheine() {
      const zeilen = await db.select<Gutschein[]>(
        "SELECT id, nummer, ausgabe_datum, betrag, eingeloest_betrag, eingeloest_datum, status FROM gutschein ORDER BY ausgabe_datum DESC",
      );
      return zeilen.map((z) => ({ ...z, eingeloest_datum: z.eingeloest_datum ?? undefined }));
    },

    async gutscheinAusgeben(eingabe) {
      await db.execute(
        "INSERT INTO gutschein (id, nummer, ausgabe_datum, betrag, eingeloest_betrag, status) VALUES ($1,$2,$3,$4,0,'offen')",
        [uid(), eingabe.nummer, eingabe.ausgabe_datum, eingabe.betrag],
      );
      await db.execute(
        "INSERT INTO buchung (id, datum, belegnr, text, konto, gegenkonto, betrag_brutto, ust_satz, quelle, storniert) VALUES ($1,$2,'',$3,'1700',$4,$5,0,'manuell',0)",
        [uid(), eingabe.ausgabe_datum, `Gutschein ausgegeben ${eingabe.nummer}`, eingabe.zahlungskonto, eingabe.betrag],
      );
    },

    async gutscheinEinloesen(eingabe): Promise<LoeschErgebnis> {
      const zeilen = await db.select<Gutschein[]>(
        "SELECT id, nummer, betrag, eingeloest_betrag, status FROM gutschein WHERE id = $1",
        [eingabe.id],
      );
      const g = zeilen[0];
      if (!g) return { ok: false, grund: "Gutschein nicht gefunden." };
      if (round2(eingabe.betrag) > offenerBetrag(g)) {
        return { ok: false, grund: "Betrag übersteigt den Restbetrag des Gutscheins." };
      }
      const kontoZeilen = await db.select<{ ust_satz: number }[]>("SELECT ust_satz FROM konto WHERE nr = $1", [eingabe.erloesKonto]);
      const neuerStatus = statusNachEinloesung(g, eingabe.betrag);
      const neuEingeloest = round2(g.eingeloest_betrag + eingabe.betrag);
      await db.execute(
        "UPDATE gutschein SET eingeloest_betrag=$2, eingeloest_datum=$3, status=$4 WHERE id=$1",
        [eingabe.id, neuEingeloest, eingabe.datum, neuerStatus],
      );
      await db.execute(
        "INSERT INTO buchung (id, datum, belegnr, text, konto, gegenkonto, betrag_brutto, ust_satz, quelle, storniert) VALUES ($1,$2,'',$3,$4,'1700',$5,$6,'manuell',0)",
        [uid(), eingabe.datum, `Gutschein eingelöst ${g.nummer}`, eingabe.erloesKonto, eingabe.betrag, kontoZeilen[0]?.ust_satz ?? 0],
      );
      return { ok: true };
    },

    async konten() {
      const zeilen = await db.select<KontoZeile[]>(
        "SELECT * FROM konto WHERE aktiv = 1 ORDER BY sortierung, nr",
      );
      return zeilen.map(
        (z): Konto => ({
          nr: z.nr,
          name: z.name,
          typ: z.typ,
          ust_satz: z.ust_satz,
          bwa_gruppe: z.bwa_gruppe,
          euer_zeile: z.euer_zeile ?? undefined,
          datev_konto: z.datev_konto ?? undefined,
          aktiv: z.aktiv === 1,
          sortierung: z.sortierung,
        }),
      );
    },

    async kontoSpeichern(konto) {
      const vorhanden = await db.select<{ nr: string }[]>("SELECT nr FROM konto WHERE nr = $1", [konto.nr]);
      if (vorhanden.length) {
        await db.execute(
          "UPDATE konto SET name=$2, typ=$3, ust_satz=$4, bwa_gruppe=$5, aktiv=$6, sortierung=$7 WHERE nr=$1",
          [konto.nr, konto.name, konto.typ, konto.ust_satz, konto.bwa_gruppe, konto.aktiv ? 1 : 0, konto.sortierung ?? 0],
        );
      } else {
        await db.execute(
          "INSERT INTO konto (nr, name, typ, ust_satz, bwa_gruppe, aktiv, sortierung) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [konto.nr, konto.name, konto.typ, konto.ust_satz, konto.bwa_gruppe, konto.aktiv ? 1 : 0, konto.sortierung ?? 0],
        );
      }
    },

    async kontoLoeschen(nr): Promise<LoeschErgebnis> {
      const bebucht = await db.select<{ anzahl: number }[]>(
        "SELECT COUNT(*) as anzahl FROM buchung WHERE konto = $1 OR gegenkonto = $1",
        [nr],
      );
      if ((bebucht[0]?.anzahl ?? 0) > 0) {
        return { ok: false, grund: "Konto wird noch bebucht." };
      }
      await db.execute("DELETE FROM konto WHERE nr = $1", [nr]);
      return { ok: true };
    },

    async kostenstellen() {
      const zeilen = await db.select<KostenstelleZeile[]>(
        "SELECT * FROM kostenstelle WHERE aktiv = 1 ORDER BY name",
      );
      return zeilen.map(
        (z): Kostenstelle => ({ id: z.id, name: z.name, notiz: z.notiz, aktiv: z.aktiv === 1 }),
      );
    },

    async kostenstelleSpeichern(kostenstelle) {
      const vorhanden = await db.select<{ id: string }[]>(
        "SELECT id FROM kostenstelle WHERE id = $1",
        [kostenstelle.id],
      );
      if (vorhanden.length) {
        await db.execute(
          "UPDATE kostenstelle SET name=$2, notiz=$3, aktiv=$4 WHERE id=$1",
          [kostenstelle.id, kostenstelle.name, kostenstelle.notiz, kostenstelle.aktiv ? 1 : 0],
        );
      } else {
        await db.execute(
          "INSERT INTO kostenstelle (id, name, notiz, aktiv) VALUES ($1,$2,$3,$4)",
          [kostenstelle.id, kostenstelle.name, kostenstelle.notiz, kostenstelle.aktiv ? 1 : 0],
        );
      }
    },

    async kostenstelleLoeschen(id): Promise<LoeschErgebnis> {
      const bebucht = await db.select<{ anzahl: number }[]>(
        "SELECT COUNT(*) as anzahl FROM buchung WHERE kostenstelle_id = $1",
        [id],
      );
      if ((bebucht[0]?.anzahl ?? 0) > 0) {
        return { ok: false, grund: "Kostenstelle wird noch bebucht." };
      }
      await db.execute("DELETE FROM kostenstelle WHERE id = $1", [id]);
      return { ok: true };
    },

    async buchungen() {
      const zeilen = await db.select<BuchungZeile[]>(
        "SELECT * FROM buchung WHERE storniert = 0 ORDER BY datum",
      );
      return zeilen.map(
        (z): Buchung => ({
          id: z.id,
          datum: z.datum,
          belegnr: z.belegnr,
          text: z.text,
          konto: z.konto,
          gegenkonto: z.gegenkonto,
          betrag_brutto: z.betrag_brutto,
          ust_satz: z.ust_satz,
          kostenstelle_id: z.kostenstelle_id ?? undefined,
          quelle: z.quelle,
          storniert: z.storniert === 1,
        }),
      );
    },

    async buchungSpeichern(b) {
      const vorhanden = await db.select<{ id: string }[]>("SELECT id FROM buchung WHERE id = $1", [b.id]);
      if (vorhanden.length) {
        await db.execute(
          `UPDATE buchung SET datum=$2, belegnr=$3, text=$4, konto=$5, gegenkonto=$6,
             betrag_brutto=$7, ust_satz=$8, kostenstelle_id=$9, geaendert_am=datetime('now')
           WHERE id=$1`,
          [b.id, b.datum, b.belegnr ?? "", b.text, b.konto, b.gegenkonto, b.betrag_brutto, b.ust_satz, b.kostenstelle_id ?? null],
        );
      } else {
        await db.execute(
          `INSERT INTO buchung (id, datum, belegnr, text, konto, gegenkonto, betrag_brutto, ust_satz, kostenstelle_id, quelle, storniert)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)`,
          [b.id, b.datum, b.belegnr ?? "", b.text, b.konto, b.gegenkonto, b.betrag_brutto, b.ust_satz, b.kostenstelle_id ?? null, b.quelle],
        );
      }
    },

    async buchungLoeschen(id) {
      // Echtes Storno statt Löschen kommt mit dem Monatsabschluss (siehe SPEC.md
      // Abschnitt 10, P1). Bis dahin: Buchungen lassen sich vor dem Abschluss
      // wie im Prototyp direkt entfernen, um Tippfehler korrigieren zu können.
      await db.execute("DELETE FROM buchung WHERE id = $1", [id]);
    },

    async belegeVon(buchungId) {
      return db.select<Beleg[]>(
        "SELECT id, buchung_id, dateiname, pfad, mime, groesse, hinzugefuegt_am FROM beleg WHERE buchung_id = $1 ORDER BY hinzugefuegt_am",
        [buchungId],
      );
    },

    async belegAnhaengen(neuerBeleg) {
      const buchungZeilen = await db.select<{ datum: string }[]>(
        "SELECT datum FROM buchung WHERE id = $1",
        [neuerBeleg.buchung_id],
      );
      const jahr = Number((buchungZeilen[0]?.datum ?? new Date().toISOString()).slice(0, 4));
      const ordner = await belegeOrdner(mandantId, jahr);
      await mkdir(ordner, { recursive: true });
      const dateiname = `${uid()}_${neuerBeleg.dateiname}`;
      const pfad = await join(ordner, dateiname);
      await writeFile(pfad, neuerBeleg.inhalt);
      await db.execute(
        "INSERT INTO beleg (id, buchung_id, dateiname, pfad, mime, groesse) VALUES ($1,$2,$3,$4,$5,$6)",
        [uid(), neuerBeleg.buchung_id, neuerBeleg.dateiname, pfad, neuerBeleg.mime, neuerBeleg.inhalt.byteLength],
      );
    },

    async belegLoeschen(id) {
      const zeilen = await db.select<{ pfad: string }[]>("SELECT pfad FROM beleg WHERE id = $1", [id]);
      await db.execute("DELETE FROM beleg WHERE id = $1", [id]);
      if (zeilen[0]) {
        try {
          await remove(zeilen[0].pfad);
        } catch {
          // Datei bereits verschwunden — der Datenbankeintrag ist trotzdem weg.
        }
      }
    },

    async belegInhalt(beleg) {
      const bytes = await readFile(beleg.pfad);
      return new Blob([bytes], { type: beleg.mime });
    },

    async importregeln() {
      const zeilen = await db.select<{ id: string; stichwoerter: string; konto: string; prioritaet: number; aktiv: number }[]>(
        "SELECT id, stichwoerter, konto, prioritaet, aktiv FROM importregel ORDER BY prioritaet DESC",
      );
      return zeilen.map((z) => ({ ...z, aktiv: z.aktiv === 1 }));
    },

    async importregelSpeichern(regel) {
      const vorhanden = await db.select<{ id: string }[]>("SELECT id FROM importregel WHERE id = $1", [regel.id]);
      if (vorhanden.length) {
        await db.execute(
          "UPDATE importregel SET stichwoerter=$2, konto=$3, prioritaet=$4, aktiv=$5 WHERE id=$1",
          [regel.id, regel.stichwoerter, regel.konto, regel.prioritaet, regel.aktiv ? 1 : 0],
        );
      } else {
        await db.execute(
          "INSERT INTO importregel (id, stichwoerter, konto, prioritaet, aktiv) VALUES ($1,$2,$3,$4,$5)",
          [regel.id, regel.stichwoerter, regel.konto, regel.prioritaet, regel.aktiv ? 1 : 0],
        );
      }
    },

    async importregelLoeschen(id) {
      await db.execute("DELETE FROM importregel WHERE id = $1", [id]);
    },

    async importlaeufe() {
      return db.select<Importlauf[]>(
        "SELECT id, datei, format, zeilen, uebernommen, datum FROM importlauf ORDER BY datum DESC",
      );
    },

    async buchungenUebernehmen(eingabe) {
      const importlaufId = uid();
      await db.execute(
        "INSERT INTO importlauf (id, datei, format, zeilen, uebernommen) VALUES ($1,$2,$3,$4,$5)",
        [importlaufId, eingabe.datei, eingabe.format, eingabe.zeilen, eingabe.buchungen.length],
      );
      for (const b of eingabe.buchungen) {
        await db.execute(
          `INSERT INTO buchung (id, datum, belegnr, text, konto, gegenkonto, betrag_brutto, ust_satz, quelle, import_id, storniert)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)`,
          [uid(), b.datum, b.belegnr ?? "", b.text, b.konto, b.gegenkonto, b.betrag_brutto, b.ust_satz, b.quelle, importlaufId],
        );
      }
    },

    async importRueckgaengig(importlaufId) {
      await db.execute("DELETE FROM buchung WHERE import_id = $1", [importlaufId]);
    },

    async dokumente() {
      return db.select<Dokument[]>(
        "SELECT id, typ, datum, dateiname, pfad, mime, groesse, hinzugefuegt_am FROM dokument ORDER BY datum DESC, hinzugefuegt_am DESC",
      );
    },

    async dokumentHinzufuegen(neuesDokument) {
      const jahr = Number(neuesDokument.datum.slice(0, 4));
      const ordner = await dokumenteOrdner(mandantId, jahr);
      await mkdir(ordner, { recursive: true });
      const dateiname = `${uid()}_${neuesDokument.dateiname}`;
      const pfad = await join(ordner, dateiname);
      await writeFile(pfad, neuesDokument.inhalt);
      await db.execute(
        "INSERT INTO dokument (id, typ, datum, dateiname, pfad, mime, groesse) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [uid(), neuesDokument.typ, neuesDokument.datum, neuesDokument.dateiname, pfad, neuesDokument.mime, neuesDokument.inhalt.byteLength],
      );
    },

    async dokumentLoeschen(id) {
      const zeilen = await db.select<{ pfad: string }[]>("SELECT pfad FROM dokument WHERE id = $1", [id]);
      await db.execute("DELETE FROM dokument WHERE id = $1", [id]);
      if (zeilen[0]) {
        try {
          await remove(zeilen[0].pfad);
        } catch {
          // Datei bereits verschwunden — der Datenbankeintrag ist trotzdem weg.
        }
      }
    },

    async dokumentInhalt(dokument) {
      const bytes = await readFile(dokument.pfad);
      return new Blob([bytes], { type: dokument.mime });
    },
  };
}
