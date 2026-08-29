import { describe, expect, it } from "vitest";
import {
  csvZeileSplit,
  delimiterErkennen,
  istDublette,
  parseDatum,
  parseSteuersatz,
  spaltenErkennen,
  zahlartZuGegenkonto,
} from "./import-parser.ts";

describe("parseDatum", () => {
  it("erkennt TT.MM.JJJJ", () => {
    expect(parseDatum("23.07.2026")).toBe("2026-07-23");
  });
  it("erkennt JJJJ-MM-TT", () => {
    expect(parseDatum("2026-07-23")).toBe("2026-07-23");
  });
  it("erkennt zweistelliges Jahr", () => {
    expect(parseDatum("23.07.26")).toBe("2026-07-23");
  });
  it("erkennt die Excel-Serienzahl ab 1899-12-30", () => {
    // 46226 entspricht 2026-07-23 im Excel-1900-Datumssystem
    expect(parseDatum(46226)).toBe("2026-07-23");
  });
  it("liefert einen leeren String bei unlesbarem Wert", () => {
    expect(parseDatum("nicht ein datum")).toBe("");
    expect(parseDatum("")).toBe("");
    expect(parseDatum(null)).toBe("");
  });
});

describe("parseSteuersatz", () => {
  it("rundet auf die nächstliegende gültige Stufe", () => {
    expect(parseSteuersatz("19")).toBe(19);
    expect(parseSteuersatz("19%")).toBe(19);
    expect(parseSteuersatz("7")).toBe(7);
    expect(parseSteuersatz("0")).toBe(0);
    expect(parseSteuersatz("")).toBe(0);
  });
});

describe("spaltenErkennen", () => {
  it("erkennt Bank-Kopfzeile", () => {
    const kopf = ["Buchungstag", "Wertstellung", "Auftraggeber/Empfänger", "Buchungstext", "Verwendungszweck", "Betrag", "Währung"];
    const map = spaltenErkennen(kopf);
    expect(map.datum).toBe(0);
    expect(map.betrag).toBe(5);
    expect(map.text2).toBe(2);
  });
  it("erkennt Kassen-Kopfzeile", () => {
    const kopf = ["Datum", "Uhrzeit", "Bon_ID", "Kassierer", "Zahlart", "Artikel", "Kategorie", "MwSt_Satz", "Gesamt_Brutto"];
    const map = spaltenErkennen(kopf);
    expect(map.datum).toBe(0);
    expect(map.zahlart).toBe(4);
    expect(map.ust).toBe(7);
    expect(map.betrag).toBe(8);
  });
});

describe("delimiterErkennen", () => {
  it("erkennt Semikolon", () => {
    expect(delimiterErkennen("a;b;c\n1;2;3")).toBe(";");
  });
  it("erkennt Komma", () => {
    expect(delimiterErkennen("a,b,c\n1,2,3")).toBe(",");
  });
  it("erkennt Tabulator", () => {
    expect(delimiterErkennen("a\tb\tc")).toBe("\t");
  });
});

describe("csvZeileSplit", () => {
  it("zerlegt eine einfache Zeile", () => {
    expect(csvZeileSplit("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });
  it("respektiert Anführungszeichen mit Trennzeichen darin", () => {
    expect(csvZeileSplit('a;"b;c";d', ";")).toEqual(["a", "b;c", "d"]);
  });
  it("löst doppelte Anführungszeichen als Escape auf", () => {
    expect(csvZeileSplit('a;"b""c";d', ";")).toEqual(["a", 'b"c', "d"]);
  });
});

describe("zahlartZuGegenkonto", () => {
  it("ordnet Bar auf 1000", () => {
    expect(zahlartZuGegenkonto("Bar")).toBe("1000");
  });
  it("ordnet EC/Karte auf 1210", () => {
    expect(zahlartZuGegenkonto("EC-Karte")).toBe("1210");
    expect(zahlartZuGegenkonto("SumUp Card")).toBe("1210");
  });
  it("ordnet sonstiges auf 1200", () => {
    expect(zahlartZuGegenkonto("Überweisung")).toBe("1200");
  });
});

describe("istDublette", () => {
  const bestehende = [{ datum: "2026-07-01", betrag: 19.99, text: "Großhandel" }];
  it("erkennt eine exakte Dublette", () => {
    expect(istDublette({ datum: "2026-07-01", betrag: 19.99, text: "Großhandel" }, bestehende)).toBe(true);
  });
  it("toleriert Rundungsdifferenzen unter einem Cent", () => {
    expect(istDublette({ datum: "2026-07-01", betrag: -19.99, text: "Großhandel" }, bestehende)).toBe(true);
  });
  it("erkennt keine Dublette bei abweichendem Text", () => {
    expect(istDublette({ datum: "2026-07-01", betrag: 19.99, text: "Anderer Text" }, bestehende)).toBe(false);
  });
  it("erkennt keine Dublette bei abweichendem Datum", () => {
    expect(istDublette({ datum: "2026-07-02", betrag: 19.99, text: "Großhandel" }, bestehende)).toBe(false);
  });
});
