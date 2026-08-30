import { describe, expect, it } from "vitest";
import { entschluesseln, verschluesseln } from "./krypto.ts";

describe("verschluesseln/entschluesseln", () => {
  it("liefert nach Ver- und Entschlüsselung wieder die ursprünglichen Bytes", async () => {
    const original = new TextEncoder().encode("Testinhalt für die Sicherung 123");
    const verschluesselt = await verschluesseln(original, "korrekte-passphrase");
    const entschluesselt = await entschluesseln(verschluesselt, "korrekte-passphrase");
    expect(new TextDecoder().decode(entschluesselt)).toBe("Testinhalt für die Sicherung 123");
  });

  it("verweigert die Entschlüsselung mit falscher Passphrase", async () => {
    const original = new TextEncoder().encode("geheim");
    const verschluesselt = await verschluesseln(original, "richtig");
    await expect(entschluesseln(verschluesselt, "falsch")).rejects.toThrow();
  });

  it("erzeugt bei jedem Aufruf ein anderes Ergebnis, auch mit derselben Passphrase (zufälliges Salt/IV)", async () => {
    const original = new TextEncoder().encode("gleicher Inhalt");
    const a = await verschluesseln(original, "gleiche-passphrase");
    const b = await verschluesseln(original, "gleiche-passphrase");
    expect(a).not.toEqual(b);
  });

  it("lehnt eine zu kurze Datei ab", async () => {
    await expect(entschluesseln(new Uint8Array(4), "irgendwas")).rejects.toThrow();
  });

  it("verarbeitet auch größere Binärdaten korrekt (z. B. ein gepacktes Archiv)", async () => {
    const original = crypto.getRandomValues(new Uint8Array(50_000));
    const verschluesselt = await verschluesseln(original, "archiv-passphrase");
    const entschluesselt = await entschluesseln(verschluesselt, "archiv-passphrase");
    expect(entschluesselt).toEqual(original);
  });
});
