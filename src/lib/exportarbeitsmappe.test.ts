import { describe, expect, it } from "vitest";
import {
  bwaBlatt,
  euerBlatt,
  journalBlatt,
  kontenblaetterBlatt,
  stundenlisteBlatt,
  summenSaldenBlatt,
  ustvaBlatt,
} from "./exportarbeitsmappe.ts";
import { bwaBericht } from "./bwa.ts";
import { euerBericht } from "./euer.ts";
import { ustVoranmeldung } from "./ustva.ts";
import { kontenblatt, summenUndSalden } from "./berichte.ts";
import type { Buchung, Konto, Mitarbeiter, Zeiteintrag, Zuschlagsregel } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", euer_zeile: 10, aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", euer_zeile: 20, aktiv: true },
  { nr: "1000", name: "Kasse", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(teile: Partial<Buchung> & Pick<Buchung, "datum" | "konto" | "gegenkonto" | "betrag_brutto">): Buchung {
  return { id: `${teile.datum}-${teile.konto}`, text: "Test", ust_satz: 19, quelle: "manuell", storniert: false, ...teile };
}

const buchungen: Buchung[] = [
  buchung({ datum: "2026-08-03", konto: "8400", gegenkonto: "1000", betrag_brutto: 119, ust_satz: 19, text: "Verkauf" }),
  buchung({ datum: "2026-08-05", konto: "3300", gegenkonto: "1000", betrag_brutto: 53.5, ust_satz: 7, text: "Einkauf" }),
];

describe("journalBlatt", () => {
  it("hat eine Zeile je Buchung, chronologisch sortiert, mit Kontonamen", () => {
    const blatt = journalBlatt([buchungen[1], buchungen[0]], kontoVon);
    expect(blatt.zeilen).toHaveLength(2);
    expect(blatt.zeilen[0][0]).toBe("2026-08-03");
    expect(blatt.zeilen[0][4]).toBe("Erlöse 19%");
    expect(blatt.kopfzeile).toHaveLength(9);
    for (const zeile of blatt.zeilen) expect(zeile).toHaveLength(blatt.kopfzeile.length);
  });
});

describe("summenSaldenBlatt", () => {
  it("übernimmt die Zeilen aus summenUndSalden 1:1", () => {
    const zeilen = summenUndSalden(buchungen, kontoVon);
    const blatt = summenSaldenBlatt(zeilen);
    expect(blatt.zeilen).toHaveLength(zeilen.length);
    expect(blatt.kopfzeile).toEqual(["Konto", "Name", "Soll", "Haben", "Saldo"]);
  });
});

describe("kontenblaetterBlatt", () => {
  it("hängt mehrere Kontenblätter mit vorangestellter Kontospalte aneinander", () => {
    const blatt = kontenblaetterBlatt([
      { konto: "8400", name: "Erlöse 19%", zeilen: kontenblatt(buchungen, kontoVon, "8400") },
      { konto: "1000", name: "Kasse", zeilen: kontenblatt(buchungen, kontoVon, "1000") },
    ]);
    expect(blatt.zeilen.filter((z) => z[0] === "8400")).toHaveLength(1);
    expect(blatt.zeilen.filter((z) => z[0] === "1000")).toHaveLength(2);
  });
});

describe("bwaBlatt", () => {
  it("fügt Rohertrag nach Wareneinsatz und Betriebsergebnis nach Sonstige Kosten ein", () => {
    const bericht = bwaBericht(buchungen, kontoVon, false, "2026-08");
    const blatt = bwaBlatt(bericht);
    const positionen = blatt.zeilen.map((z) => z[0]);
    const idxWare = positionen.indexOf("Material- und Wareneinsatz");
    const idxSonst = positionen.indexOf("Sonstige Kosten");
    expect(positionen[idxWare + 1]).toBe("= Rohertrag");
    expect(positionen[idxSonst + 1]).toBe("= Betriebsergebnis");
    expect(positionen.at(-1)).toBe("= Vorläufiges Ergebnis");
  });
});

describe("euerBlatt", () => {
  it("listet Einnahmen/Ausgaben und hängt die drei Summenzeilen an", () => {
    const bericht = euerBericht(buchungen, kontoVon, false, "2026-08-01", "2026-08-31");
    const blatt = euerBlatt(bericht);
    const letzte3 = blatt.zeilen.slice(-3).map((z) => z[3]);
    expect(letzte3).toEqual(["Summe Betriebseinnahmen", "Summe Betriebsausgaben", "Gewinn"]);
  });
});

describe("ustvaBlatt", () => {
  it("bildet alle vier Kennzahlen als eigene Zeilen ab", () => {
    const bericht = ustVoranmeldung(buchungen, kontoVon, false, "ist", "2026-08-01", "2026-08-31");
    const blatt = ustvaBlatt(bericht);
    const kennzahlen = blatt.zeilen.map((z) => z[0]).filter(Boolean);
    expect(kennzahlen).toEqual(["Kz 81", "Kz 86", "Kz 83", "Kz 66"]);
  });
});

describe("stundenlisteBlatt", () => {
  const mitarbeiter: Mitarbeiter[] = [
    { id: "m1", name: "Anna", rolle: "Verkauf", beschaeftigungsart: "teilzeit", eintritt: "2024-01-01", stundenlohn: 15, wochenstunden: 20, urlaubstage_jahr: 24, aktiv: true },
  ];
  const regeln: Zuschlagsregel[] = [];
  const nieFeiertag = () => false;

  it("nimmt nur freigegebene Einträge auf und berechnet den Bruttolohn", () => {
    const eintraege: Zeiteintrag[] = [
      { id: "z1", mitarbeiter_id: "m1", datum: "2026-08-04", von: "08:00", bis: "12:00", pause_min: 0, stunden: 4, art: "arbeit", notiz: "", status: "freigegeben" },
      { id: "z2", mitarbeiter_id: "m1", datum: "2026-08-05", pause_min: 0, stunden: 3, art: "arbeit", notiz: "", status: "eingereicht" },
    ];
    const blatt = stundenlisteBlatt(eintraege, (id) => mitarbeiter.find((m) => m.id === id), regeln, nieFeiertag);
    expect(blatt.zeilen).toHaveLength(1);
    expect(blatt.zeilen[0][1]).toBe("Anna");
    expect(blatt.zeilen[0][7]).toBe(60); // 4 Std * 15 €
  });
});
