import { describe, expect, it } from "vitest";
import { kontenblatt, summenUndSalden } from "./berichte.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 7, bwa_gruppe: "ware", aktiv: true },
  { nr: "1000", name: "Kasse", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
  { nr: "1360", name: "Geldtransit", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(datum: string, konto: string, gegenkonto: string, betrag: number): Buchung {
  return { id: `${datum}-${konto}-${gegenkonto}-${betrag}`, datum, text: "Test", konto, gegenkonto, betrag_brutto: betrag, ust_satz: 19, quelle: "manuell", storniert: false };
}

describe("summenUndSalden", () => {
  it("bucht bei einer Erlösbuchung das Gegenkonto im Soll und das Erlöskonto im Haben", () => {
    const buchungen = [buchung("2026-08-01", "8400", "1000", 100)];
    const zeilen = summenUndSalden(buchungen, kontoVon);
    const kasse = zeilen.find((z) => z.konto === "1000")!;
    const erloes = zeilen.find((z) => z.konto === "8400")!;
    expect(kasse.soll).toBe(100);
    expect(kasse.haben).toBe(0);
    expect(erloes.haben).toBe(100);
    expect(erloes.soll).toBe(0);
  });

  it("bucht bei einer Aufwandsbuchung das Konto selbst im Soll", () => {
    const buchungen = [buchung("2026-08-02", "3300", "1000", 50)];
    const zeilen = summenUndSalden(buchungen, kontoVon);
    const wareneinkauf = zeilen.find((z) => z.konto === "3300")!;
    const kasse = zeilen.find((z) => z.konto === "1000")!;
    expect(wareneinkauf.soll).toBe(50);
    expect(kasse.haben).toBe(50);
  });

  it("summiert mehrere Buchungen je Konto und berechnet den Saldo", () => {
    const buchungen = [buchung("2026-08-01", "8400", "1000", 100), buchung("2026-08-02", "3300", "1000", 30)];
    const zeilen = summenUndSalden(buchungen, kontoVon);
    const kasse = zeilen.find((z) => z.konto === "1000")!;
    expect(kasse.soll).toBe(100);
    expect(kasse.haben).toBe(30);
    expect(kasse.saldo).toBe(70);
  });

  it("ignoriert stornierte Buchungen", () => {
    const buchungen = [{ ...buchung("2026-08-01", "8400", "1000", 100), storniert: true }];
    expect(summenUndSalden(buchungen, kontoVon)).toEqual([]);
  });
});

describe("kontenblatt", () => {
  it("listet nur Buchungen des gewählten Kontos, chronologisch mit laufendem Saldo", () => {
    const buchungen = [
      buchung("2026-08-03", "8400", "1000", 50),
      buchung("2026-08-01", "8400", "1000", 100),
      buchung("2026-08-02", "3300", "1000", 20),
    ];
    const zeilen = kontenblatt(buchungen, kontoVon, "1000");
    expect(zeilen.map((z) => z.datum)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(zeilen[0].saldo).toBe(100);
    expect(zeilen[1].saldo).toBe(80); // 100 - 20
    expect(zeilen[2].saldo).toBe(130); // 80 + 50
  });

  it("zeigt das jeweils andere Konto als Gegenkonto an, unabhängig von der Feldreihenfolge", () => {
    const buchungen = [buchung("2026-08-01", "1000", "1360", 200)];
    const kasse = kontenblatt(buchungen, kontoVon, "1000");
    const transit = kontenblatt(buchungen, kontoVon, "1360");
    expect(kasse[0].gegenkonto).toBe("1360");
    expect(transit[0].gegenkonto).toBe("1000");
  });
});
