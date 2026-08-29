import { describe, expect, it } from "vitest";
import { buchungenDesMonats, dokumenteDesMonats, paketEintraege } from "./monatspaket.ts";
import type { Buchung, Dokument } from "./types.ts";

function dokument(id: string, typ: Dokument["typ"], datum: string, dateiname: string): Dokument {
  return { id, typ, datum, dateiname, pfad: `/pfad/${id}`, mime: "application/pdf", groesse: 100, hinzugefuegt_am: datum };
}

describe("dokumenteDesMonats", () => {
  it("filtert nur Dokumente des angegebenen Monats", () => {
    const dokumente = [
      dokument("1", "kassenbericht", "2026-08-01", "kb1.pdf"),
      dokument("2", "rechnung", "2026-09-01", "re1.pdf"),
      dokument("3", "beleg", "2026-08-31", "b1.png"),
    ];
    expect(dokumenteDesMonats(dokumente, "2026-08").map((d) => d.id)).toEqual(["1", "3"]);
  });
});

describe("buchungenDesMonats", () => {
  it("filtert nach Monat und schließt stornierte Buchungen aus", () => {
    const buchungen: Buchung[] = [
      { id: "1", datum: "2026-08-05", text: "A", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, ust_satz: 19, quelle: "manuell", storniert: false },
      { id: "2", datum: "2026-08-06", text: "B", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, ust_satz: 19, quelle: "manuell", storniert: true },
      { id: "3", datum: "2026-07-06", text: "C", konto: "8400", gegenkonto: "1000", betrag_brutto: 10, ust_satz: 19, quelle: "manuell", storniert: false },
    ];
    expect(buchungenDesMonats(buchungen, "2026-08").map((b) => b.id)).toEqual(["1"]);
  });
});

describe("paketEintraege", () => {
  it("sortiert Dokumente nach Typ-Ordner und stellt das Datum dem Dateinamen voran", () => {
    const dokumente = [dokument("1", "rechnung", "2026-08-03", "lieferant.pdf")];
    const eintraege = paketEintraege(dokumente, "2026-08");
    expect(eintraege[0].zipPfad).toBe("Rechnungen/2026-08-03_lieferant.pdf");
  });

  it("macht gleiche Dateinamen am selben Tag eindeutig statt sie zu überschreiben", () => {
    const dokumente = [
      dokument("1", "beleg", "2026-08-03", "foto.jpg"),
      dokument("2", "beleg", "2026-08-03", "foto.jpg"),
    ];
    const eintraege = paketEintraege(dokumente, "2026-08");
    const pfade = eintraege.map((e) => e.zipPfad);
    expect(new Set(pfade).size).toBe(2);
    expect(pfade[0]).toBe("Belege/2026-08-03_foto.jpg");
    expect(pfade[1]).toBe("Belege/2026-08-03_2_foto.jpg");
  });

  it("lässt Dokumente außerhalb des Monats weg", () => {
    const dokumente = [dokument("1", "kassenbericht", "2026-07-31", "kb.pdf")];
    expect(paketEintraege(dokumente, "2026-08")).toEqual([]);
  });
});
