import { describe, expect, it } from "vitest";
import { buchungenZuCsv } from "./buchungscsv.ts";
import type { Buchung } from "./types.ts";

describe("buchungenZuCsv", () => {
  it("erzeugt eine Kopfzeile und eine Datenzeile für eine einzelne Buchung", () => {
    const b: Buchung = {
      id: "1",
      datum: "2026-08-01",
      text: "Tageseinnahmen Bar",
      konto: "8400",
      gegenkonto: "1000",
      betrag_brutto: 892.5,
      ust_satz: 19,
      quelle: "manuell",
      storniert: false,
    };
    const csv = buchungenZuCsv([b]);
    const zeilen = csv.split("\r\n");
    expect(zeilen[0]).toBe("Datum;Belegnr;Text;Konto;Gegenkonto;Betrag_Brutto;USt_Satz;Quelle");
    expect(zeilen[1]).toBe("2026-08-01;;Tageseinnahmen Bar;8400;1000;892.50;19;manuell");
  });

  it("setzt mehrere Buchungen als weitere Zeilen an", () => {
    const b1: Buchung = {
      id: "1",
      datum: "2026-08-01",
      text: "A",
      konto: "8400",
      gegenkonto: "1000",
      betrag_brutto: 10,
      ust_satz: 19,
      quelle: "manuell",
      storniert: false,
    };
    const b2: Buchung = { ...b1, id: "2", text: "B", betrag_brutto: 20 };
    const csv = buchungenZuCsv([b1, b2]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("maskiert Texte mit Semikolon oder Anführungszeichen", () => {
    const b: Buchung = {
      id: "1",
      datum: "2026-08-01",
      text: 'Waren; "Süßes" Sortiment',
      konto: "3300",
      gegenkonto: "1200",
      betrag_brutto: 5,
      ust_satz: 7,
      quelle: "manuell",
      storniert: false,
    };
    const zeile = buchungenZuCsv([b]).split("\r\n")[1];
    expect(zeile).toContain('"Waren; ""Süßes"" Sortiment"');
  });
});
