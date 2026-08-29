import { describe, expect, it } from "vitest";
import { ustVoranmeldung } from "./ustva.ts";
import type { Buchung, Konto } from "./types.ts";

const konten: Konto[] = [
  { nr: "8400", name: "Erlöse 19%", typ: "erloes", ust_satz: 19, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "8300", name: "Erlöse 7%", typ: "erloes", ust_satz: 7, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "8195", name: "Erlöse Kleinunternehmer", typ: "erloes", ust_satz: 0, bwa_gruppe: "umsatz", aktiv: true },
  { nr: "3300", name: "Wareneinkauf", typ: "aufwand", ust_satz: 19, bwa_gruppe: "ware", aktiv: true },
  { nr: "1200", name: "Bank", typ: "finanz", ust_satz: 0, bwa_gruppe: "", aktiv: true },
];
const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);

function buchung(datum: string, konto: string, betrag: number, ust: number, wertstellung?: string): Buchung {
  return { id: `${datum}-${konto}-${betrag}`, datum, wertstellung, text: "Test", konto, gegenkonto: "1200", betrag_brutto: betrag, ust_satz: ust, quelle: "manuell", storniert: false };
}

describe("ustVoranmeldung", () => {
  it("ordnet Umsätze nach Steuersatz in Kz 81/86/83 ein", () => {
    const buchungen = [
      buchung("2026-08-01", "8400", 1190, 19), // 1000 netto -> Kz81
      buchung("2026-08-02", "8300", 107, 7), // 100 netto -> Kz86
      buchung("2026-08-03", "8195", 50, 0), // 50 netto -> Kz83
    ];
    const b = ustVoranmeldung(buchungen, kontoVon, false, "soll", "2026-08-01", "2026-08-31");
    expect(b.kz81).toBe(1000);
    expect(b.kz86).toBe(100);
    expect(b.kz83).toBe(50);
  });

  it("berechnet Umsatzsteuer aus Kz 81 und 86 und die Zahllast nach Abzug der Vorsteuer", () => {
    const buchungen = [
      buchung("2026-08-01", "8400", 1190, 19), // USt 190
      buchung("2026-08-02", "3300", 119, 19), // Vorsteuer 19
    ];
    const b = ustVoranmeldung(buchungen, kontoVon, false, "soll", "2026-08-01", "2026-08-31");
    expect(b.ustAus81).toBe(190);
    expect(b.umsatzsteuerGesamt).toBe(190);
    expect(b.kz66).toBe(19);
    expect(b.zahllast).toBe(171);
  });

  it("weist bei Kleinunternehmern alles als 0 % (Kz 83) aus", () => {
    const buchungen = [buchung("2026-08-01", "8400", 1190, 19)];
    const b = ustVoranmeldung(buchungen, kontoVon, true, "soll", "2026-08-01", "2026-08-31");
    expect(b.kz81).toBe(0);
    expect(b.kz83).toBe(1190);
    expect(b.umsatzsteuerGesamt).toBe(0);
  });

  it("verwendet bei Ist-Versteuerung das Zahlungsdatum statt des Rechnungsdatums", () => {
    const buchungen = [buchung("2026-07-28", "8400", 1190, 19, "2026-08-02")];
    const ist = ustVoranmeldung(buchungen, kontoVon, false, "ist", "2026-08-01", "2026-08-31");
    const soll = ustVoranmeldung(buchungen, kontoVon, false, "soll", "2026-08-01", "2026-08-31");
    expect(ist.kz81).toBe(1000);
    expect(soll.kz81).toBe(0);
  });

  it("liefert eine negative Zahllast (Erstattung), wenn die Vorsteuer überwiegt", () => {
    const buchungen = [buchung("2026-08-01", "3300", 1190, 19)];
    const b = ustVoranmeldung(buchungen, kontoVon, false, "soll", "2026-08-01", "2026-08-31");
    expect(b.zahllast).toBe(-190);
  });
});
