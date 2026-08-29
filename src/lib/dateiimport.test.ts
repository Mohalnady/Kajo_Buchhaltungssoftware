import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { formatVonDateiname, inhaltEinlesen, textDecodieren } from "./dateiimport.ts";

function puffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("formatVonDateiname", () => {
  it("erkennt die Formate anhand der Dateiendung", () => {
    expect(formatVonDateiname("umsaetze.CSV")).toBe("csv");
    expect(formatVonDateiname("export.tsv")).toBe("tsv");
    expect(formatVonDateiname("daten.json")).toBe("json");
    expect(formatVonDateiname("tabelle.md")).toBe("markdown");
    expect(formatVonDateiname("bank.xlsx")).toBe("excel");
    expect(formatVonDateiname("bank.xls")).toBe("excel");
    expect(formatVonDateiname("ohne_endung")).toBe("csv");
  });
});

describe("textDecodieren", () => {
  it("liest UTF-8 korrekt", () => {
    expect(textDecodieren(puffer("Süßwaren"))).toBe("Süßwaren");
  });
  it("fällt auf Windows-1252 zurück, wenn UTF-8 ungültig ist", () => {
    const win1252 = new Uint8Array([0x53, 0xfc, 0xdf, 0x65]); // "Süße" in Windows-1252
    expect(textDecodieren(win1252.buffer)).toBe("Süße");
  });
});

describe("inhaltEinlesen: csv", () => {
  it("erkennt Semikolon-CSV und trennt Kopfzeile von den Datenzeilen", () => {
    const text = "Datum;Betrag;Text\n01.08.2026;19,99;Süßwaren\n02.08.2026;-5;Rabatt";
    const r = inhaltEinlesen("csv", puffer(text));
    expect(r.kopfzeile).toEqual(["Datum", "Betrag", "Text"]);
    expect(r.zeilen).toEqual([
      ["01.08.2026", "19,99", "Süßwaren"],
      ["02.08.2026", "-5", "Rabatt"],
    ]);
  });
});

describe("inhaltEinlesen: json", () => {
  it("liest ein Array von Objekten", () => {
    const text = JSON.stringify([
      { Datum: "2026-08-01", Betrag: 19.99, Text: "Süßwaren" },
      { Datum: "2026-08-02", Betrag: -5, Text: "Rabatt" },
    ]);
    const r = inhaltEinlesen("json", puffer(text));
    expect(r.kopfzeile).toEqual(["Datum", "Betrag", "Text"]);
    expect(r.zeilen).toEqual([
      ["2026-08-01", "19.99", "Süßwaren"],
      ["2026-08-02", "-5", "Rabatt"],
    ]);
  });
});

describe("inhaltEinlesen: markdown", () => {
  it("liest eine Markdown-Tabelle", () => {
    const text = [
      "| Datum | Betrag | Text |",
      "|---|---|---|",
      "| 01.08.2026 | 19,99 | Süßwaren |",
      "| 02.08.2026 | -5 | Rabatt |",
    ].join("\n");
    const r = inhaltEinlesen("markdown", puffer(text));
    expect(r.kopfzeile).toEqual(["Datum", "Betrag", "Text"]);
    expect(r.zeilen).toEqual([
      ["01.08.2026", "19,99", "Süßwaren"],
      ["02.08.2026", "-5", "Rabatt"],
    ]);
  });
});

describe("inhaltEinlesen: excel", () => {
  it("liest das erste Tabellenblatt einer XLSX-Datei", () => {
    const blatt = XLSX.utils.aoa_to_sheet([
      ["Datum", "Betrag", "Text"],
      ["2026-08-01", 19.99, "Süßwaren"],
      ["2026-08-02", -5, "Rabatt"],
    ]);
    const arbeitsmappe = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(arbeitsmappe, blatt, "Blatt1");
    const buffer = XLSX.write(arbeitsmappe, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const r = inhaltEinlesen("excel", buffer);
    expect(r.kopfzeile).toEqual(["Datum", "Betrag", "Text"]);
    expect(r.zeilen[0][1]).toBe(19.99);
    expect(r.zeilen[1][2]).toBe("Rabatt");
  });
});
