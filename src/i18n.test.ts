import { describe, expect, it } from "vitest";
import { SPRACHEN, WOERTERBUECHER } from "./i18n.ts";

describe("i18n", () => {
  it("hat in jeder Sprache exakt dieselben Schlüssel wie Deutsch (deckt Tippfehler in Schlüsselnamen auf)", () => {
    const deSchluessel = Object.keys(WOERTERBUECHER.de).sort();
    for (const { code } of SPRACHEN) {
      const schluessel = Object.keys(WOERTERBUECHER[code]).sort();
      expect(schluessel, `Sprache "${code}" weicht von "de" ab`).toEqual(deSchluessel);
    }
  });

  it("hat keine leeren Übersetzungen", () => {
    for (const { code } of SPRACHEN) {
      for (const [schluessel, wert] of Object.entries(WOERTERBUECHER[code])) {
        expect(wert.trim(), `"${schluessel}" ist leer in "${code}"`).not.toBe("");
      }
    }
  });
});
