// Baut die Arbeitsblätter für den Excel-Export der Auswertungen (SPEC.md
// Abschnitt 7: "Journal, Kontenblätter, BWA, EÜR, Summen und Salden,
// Stundenlisten — je ein Blatt"). Reine Formatierung auf Basis der bereits
// vorhandenen, eigens getesteten Rechenkerne (bwa.ts, euer.ts, ustva.ts,
// berichte.ts, stunden.ts) — hier wird nichts neu berechnet, nur in
// Tabellenform gebracht. Die eigentliche Excel-Datei baut main.ts mit der
// xlsx-Bibliothek aus den Arbeitsblatt-Objekten.
//
// Kopfzeilen sind bewusst fest auf Deutsch, wie schon bei buchungscsv.ts und
// datev.ts — Exportdateien sind ein Übergabeformat für den Steuerberater,
// unabhängig von der gerade eingestellten App-Sprache.

import type { Buchung, Konto, Mitarbeiter, Zeiteintrag, Zuschlagsregel } from "./types.ts";
import type { BwaBericht } from "./bwa.ts";
import { BWA_GRUPPEN } from "./bwa.ts";
import type { EuerBericht } from "./euer.ts";
import type { UstVaBericht } from "./ustva.ts";
import type { KontenblattZeile, SaldenZeile } from "./berichte.ts";
import { bruttolohnFuerEintrag } from "./stunden.ts";

export interface Arbeitsblatt {
  name: string;
  kopfzeile: string[];
  zeilen: (string | number)[][];
}

const BWA_LABEL_DEUTSCH: Record<string, string> = {
  umsatz: "Umsatzerlöse",
  ware: "Material- und Wareneinsatz",
  personal: "Personalkosten",
  raum: "Raumkosten",
  steuern: "Betriebliche Steuern",
  vers: "Versicherungen und Beiträge",
  kfz: "Fahrzeugkosten",
  werbung: "Werbe- und Reisekosten",
  warenabgabe: "Kosten der Warenabgabe",
  afa: "Abschreibungen",
  rep: "Reparatur und Instandhaltung",
  sonst: "Sonstige Kosten",
  neutral: "Neutraler Aufwand und Ertrag",
};

export function journalBlatt(buchungen: Buchung[], kontoVon: (nr: string) => Konto | undefined): Arbeitsblatt {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum));
  return {
    name: "Journal",
    kopfzeile: ["Datum", "Belegnr", "Text", "Konto", "Kontoname", "Gegenkonto", "Gegenkontoname", "Betrag brutto", "USt-Satz"],
    zeilen: sortiert.map((b) => [
      b.datum,
      b.belegnr ?? "",
      b.text,
      b.konto,
      kontoVon(b.konto)?.name ?? "",
      b.gegenkonto,
      kontoVon(b.gegenkonto)?.name ?? "",
      b.betrag_brutto,
      b.ust_satz,
    ]),
  };
}

export function summenSaldenBlatt(zeilen: SaldenZeile[]): Arbeitsblatt {
  return {
    name: "Summen und Salden",
    kopfzeile: ["Konto", "Name", "Soll", "Haben", "Saldo"],
    zeilen: zeilen.map((z) => [z.konto, z.name, z.soll, z.haben, z.saldo]),
  };
}

/** Ein kombiniertes Blatt mit den Kontenblättern aller übergebenen Konten hintereinander. */
export function kontenblaetterBlatt(kontenblaetter: { konto: string; name: string; zeilen: KontenblattZeile[] }[]): Arbeitsblatt {
  const zeilen: (string | number)[][] = [];
  for (const { konto, name, zeilen: kzeilen } of kontenblaetter) {
    for (const z of kzeilen) {
      zeilen.push([konto, name, z.datum, z.belegnr, z.text, z.gegenkonto, z.soll, z.haben, z.saldo]);
    }
  }
  return {
    name: "Kontenblätter",
    kopfzeile: ["Konto", "Kontoname", "Datum", "Belegnr", "Text", "Gegenkonto", "Soll", "Haben", "Saldo"],
    zeilen,
  };
}

export function bwaBlatt(bericht: BwaBericht): Arbeitsblatt {
  const zeilen: (string | number)[][] = bericht.zeilen.map((z) => [
    BWA_LABEL_DEUTSCH[z.gruppe] ?? z.label,
    z.monat,
    z.vormonat,
    z.vorjahresmonat,
    z.jahrKumuliert,
    z.prozentUmsatz,
  ]);
  const summenzeile = (bezeichnung: string, s: BwaBericht["rohertrag"]) => [bezeichnung, s.monat, s.vormonat, s.vorjahresmonat, s.jahrKumuliert, ""];
  const rohertragIndex = BWA_GRUPPEN.findIndex((g) => g.gruppe === "ware");
  zeilen.splice(rohertragIndex + 1, 0, summenzeile("= Rohertrag", bericht.rohertrag));
  const sonstIndex = zeilen.findIndex((z) => z[0] === BWA_LABEL_DEUTSCH.sonst);
  zeilen.splice(sonstIndex + 1, 0, summenzeile("= Betriebsergebnis", bericht.betriebsergebnis));
  zeilen.push(summenzeile("= Vorläufiges Ergebnis", bericht.vorlaeufigesErgebnis));
  return {
    name: "BWA",
    kopfzeile: ["Position", "Monat", "Vormonat", "Vorjahresmonat", "Jahr kumuliert", "% vom Umsatz"],
    zeilen,
  };
}

export function euerBlatt(bericht: EuerBericht): Arbeitsblatt {
  const zeilen: (string | number)[][] = bericht.zeilen.map((z) => [z.euer_zeile ?? "", z.konto, z.name, z.typ === "erloes" ? "Einnahme" : "Ausgabe", z.netto]);
  for (const p of bericht.privatZeilen) {
    zeilen.push(["", p.konto, p.name, "Privat (nicht ergebniswirksam)", p.betrag]);
  }
  zeilen.push(["", "", "", "Summe Betriebseinnahmen", bericht.summeEinnahmen]);
  zeilen.push(["", "", "", "Summe Betriebsausgaben", bericht.summeAusgaben]);
  zeilen.push(["", "", "", "Gewinn", bericht.gewinn]);
  return {
    name: "EÜR",
    kopfzeile: ["EÜR-Zeile", "Konto", "Name", "Art", "Betrag"],
    zeilen,
  };
}

export function ustvaBlatt(bericht: UstVaBericht): Arbeitsblatt {
  return {
    name: "USt-Voranmeldung",
    kopfzeile: ["Kennzahl", "Bezeichnung", "Betrag"],
    zeilen: [
      ["Kz 81", "Umsätze zu 19 % (Bemessungsgrundlage)", bericht.kz81],
      ["Kz 86", "Umsätze zu 7 % (Bemessungsgrundlage)", bericht.kz86],
      ["Kz 83", "Umsätze zu 0 % (Bemessungsgrundlage)", bericht.kz83],
      ["Kz 66", "Abziehbare Vorsteuerbeträge", bericht.kz66],
      ["", "Umsatzsteuer aus Kz 81", bericht.ustAus81],
      ["", "Umsatzsteuer aus Kz 86", bericht.ustAus86],
      ["", "Umsatzsteuer gesamt", bericht.umsatzsteuerGesamt],
      ["", "Zahllast (positiv) / Erstattung (negativ)", bericht.zahllast],
    ],
  };
}

export function stundenlisteBlatt(
  zeiteintraege: Zeiteintrag[],
  mitarbeiterVon: (id: string) => Mitarbeiter | undefined,
  zuschlagsregeln: Zuschlagsregel[],
  istFeiertagFn: (datum: string) => boolean,
): Arbeitsblatt {
  const freigegeben = zeiteintraege.filter((e) => e.status === "freigegeben").sort((a, b) => a.datum.localeCompare(b.datum));
  return {
    name: "Stundenliste",
    kopfzeile: ["Datum", "Mitarbeiter", "Art", "Von", "Bis", "Pause (Min)", "Stunden", "Bruttolohn"],
    zeilen: freigegeben.map((e) => {
      const mitarbeiter = mitarbeiterVon(e.mitarbeiter_id);
      const bruttolohn = mitarbeiter ? bruttolohnFuerEintrag(e, mitarbeiter.stundenlohn, zuschlagsregeln, istFeiertagFn) : 0;
      return [e.datum, mitarbeiter?.name ?? e.mitarbeiter_id, e.art, e.von ?? "", e.bis ?? "", e.pause_min, e.stunden, bruttolohn];
    }),
  };
}
