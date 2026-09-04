// Windows-1252-Kodierung für den DATEV-Export (SPEC.md Abschnitt 7 verlangt
// ausdrücklich Windows-1252, nicht UTF-8). Der Browser/Tauri-Webview kennt
// TextEncoder nur für UTF-8, deshalb hier eine eigene, kleine Kodierung.
//
// 0x00–0x7F: identisch zu ASCII/Unicode.
// 0xA0–0xFF: identisch zu Unicode (Windows-1252 deckt sich dort mit Latin-1,
//            das erledigt die deutschen Umlaute ä/ö/ü/Ä/Ö/Ü/ß automatisch).
// 0x80–0x9F: eigene Tabelle (Euro-Zeichen, Anführungszeichen, Gedankenstriche).
// Alles außerhalb des Windows-1252-Zeichensatzes wird zu "?" (0x3F).

const SONDERBEREICH: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201c: 0x93, // "
  0x201d: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

function zeichenZuByte(codepoint: number): number {
  if (codepoint < 0x80) return codepoint;
  if (codepoint >= 0xa0 && codepoint <= 0xff) return codepoint;
  return SONDERBEREICH[codepoint] ?? 0x3f;
}

/** Kodiert Text nach Windows-1252. Zeichen außerhalb des Zeichensatzes werden zu "?". */
export function encodiereWindows1252(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = zeichenZuByte(text.codePointAt(i)!);
  }
  return bytes;
}
