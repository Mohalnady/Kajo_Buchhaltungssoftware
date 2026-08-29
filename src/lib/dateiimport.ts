// Liest Importdateien in ein einheitliches Zeilenformat ein. Siehe SPEC.md
// Abschnitt 6 "Formate". Arbeitet nur mit ArrayBuffer/Text, keine DOM-Typen —
// so bleibt die Logik ohne Browser testbar (CLAUDE.md: "Rechenlogik zuerst").

import * as XLSX from "xlsx";
import { csvZeileSplit, delimiterErkennen } from "./import-parser.ts";
import type { ImportFormat } from "./types.ts";

export interface EingelesenesRohformat {
  format: ImportFormat;
  kopfzeile: string[];
  zeilen: (string | number)[][];
}

/** Erkennt das Format anhand der Dateiendung. */
export function formatVonDateiname(name: string): ImportFormat {
  const endung = name.split(".").pop()?.toLowerCase() ?? "";
  if (endung === "json") return "json";
  if (endung === "md" || endung === "markdown") return "markdown";
  if (endung === "xlsx" || endung === "xls") return "excel";
  if (endung === "tsv") return "tsv";
  return "csv";
}

/** Erkennt UTF-8 gegenüber Windows-1252 (SPEC.md: beide Zeichensätze unterstützen). */
export function textDecodieren(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

function csvEinlesen(text: string): { kopfzeile: string[]; zeilen: string[][] } {
  const zeilenRoh = text.split(/\r?\n/).filter((z) => z.trim() !== "");
  if (!zeilenRoh.length) return { kopfzeile: [], zeilen: [] };
  const trenner = delimiterErkennen(text);
  const alle = zeilenRoh.map((z) => csvZeileSplit(z, trenner));
  return { kopfzeile: alle[0], zeilen: alle.slice(1) };
}

function markdownEinlesen(text: string): { kopfzeile: string[]; zeilen: string[][] } {
  const spalten = (z: string) => z.split("|").slice(1, -1).map((s) => s.trim());
  const zeilenRoh = text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z.startsWith("|") && z.endsWith("|"));
  if (zeilenRoh.length < 2) return { kopfzeile: [], zeilen: [] };
  const kopfzeile = spalten(zeilenRoh[0]);
  // zeilenRoh[1] ist die Trennzeile (|---|---|) und wird übersprungen.
  const zeilen = zeilenRoh.slice(2).map(spalten);
  return { kopfzeile, zeilen };
}

function jsonEinlesen(text: string): { kopfzeile: string[]; zeilen: string[][] } {
  const daten = JSON.parse(text) as unknown;
  const liste = (Array.isArray(daten) ? daten : [daten]) as Record<string, unknown>[];
  if (!liste.length) return { kopfzeile: [], zeilen: [] };
  const kopfzeile = Object.keys(liste[0]);
  const zeilen = liste.map((obj) => kopfzeile.map((k) => (obj[k] == null ? "" : String(obj[k]))));
  return { kopfzeile, zeilen };
}

function excelEinlesen(buffer: ArrayBuffer): { kopfzeile: string[]; zeilen: (string | number)[][] } {
  const arbeitsmappe = XLSX.read(buffer, { type: "array" });
  const blatt = arbeitsmappe.Sheets[arbeitsmappe.SheetNames[0]];
  const alle: unknown[][] = XLSX.utils.sheet_to_json(blatt, { header: 1, raw: true, blankrows: false });
  if (!alle.length) return { kopfzeile: [], zeilen: [] };
  const kopfzeile = alle[0].map((z) => String(z ?? ""));
  const zeilen = alle
    .slice(1)
    .map((z) => kopfzeile.map((_, i) => (z[i] == null ? "" : (z[i] as string | number))));
  return { kopfzeile, zeilen };
}

/** Liest den rohen Dateiinhalt in Kopfzeile + Zeilen ein, je nach erkanntem Format. */
export function inhaltEinlesen(format: ImportFormat, buffer: ArrayBuffer): EingelesenesRohformat {
  if (format === "excel") {
    return { format, ...excelEinlesen(buffer) };
  }
  const text = textDecodieren(buffer);
  if (format === "json") return { format, ...jsonEinlesen(text) };
  if (format === "markdown") return { format, ...markdownEinlesen(text) };
  return { format, ...csvEinlesen(text) };
}
