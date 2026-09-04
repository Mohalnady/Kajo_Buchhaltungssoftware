import { describe, expect, it } from "vitest";
import { encodiereWindows1252 } from "./cp1252.ts";

describe("encodiereWindows1252", () => {
  it("kodiert ASCII unverändert", () => {
    expect(Array.from(encodiereWindows1252("ABC 123"))).toEqual([65, 66, 67, 32, 49, 50, 51]);
  });

  it("kodiert deutsche Umlaute und scharfes S korrekt", () => {
    expect(Array.from(encodiereWindows1252("äöüÄÖÜß"))).toEqual([0xe4, 0xf6, 0xfc, 0xc4, 0xd6, 0xdc, 0xdf]);
  });

  it("kodiert das Euro-Zeichen im Sonderbereich 0x80-0x9F", () => {
    expect(Array.from(encodiereWindows1252("10 €"))).toEqual([49, 48, 32, 0x80]);
  });

  it("kodiert typografische Anführungszeichen", () => {
    // Deutsche Konvention: „ (U+201E) öffnet, “ (U+201C) schließt.
    expect(Array.from(encodiereWindows1252("„Test“"))).toEqual([0x84, 84, 101, 115, 116, 0x93]);
  });

  it("ersetzt Zeichen außerhalb von Windows-1252 durch ein Fragezeichen", () => {
    expect(Array.from(encodiereWindows1252("中"))).toEqual([0x3f]);
  });

  it("liefert die gleiche Länge wie die Eingabe für reinen Latin-1-Text", () => {
    const text = "Süßwarenladen München, Rechnung Nr. 42";
    expect(encodiereWindows1252(text).length).toBe(text.length);
  });
});
