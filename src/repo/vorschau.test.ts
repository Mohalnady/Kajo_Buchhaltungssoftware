import { describe, expect, it } from "vitest";
import { erstelleVorschauDatenquelle } from "./vorschau.ts";

describe("Vorschau-Datenquelle", () => {
  it("liefert die SKR03-Startkonten und die Beispiel-Buchungen", async () => {
    const repo = erstelleVorschauDatenquelle();
    const konten = await repo.konten();
    const buchungen = await repo.buchungen();
    expect(konten.length).toBeGreaterThan(30);
    expect(buchungen.length).toBeGreaterThan(0);
  });

  it("legt ein neues Konto an und findet es danach wieder", async () => {
    const repo = erstelleVorschauDatenquelle();
    await repo.kontoSpeichern({ nr: "4990", name: "Testkonto", typ: "aufwand", ust_satz: 19, bwa_gruppe: "sonst", aktiv: true });
    const konten = await repo.konten();
    expect(konten.some((k) => k.nr === "4990")).toBe(true);
  });

  it("verweigert das Löschen eines bebuchten Kontos", async () => {
    const repo = erstelleVorschauDatenquelle();
    const ergebnis = await repo.kontoLoeschen("8400"); // wird von den Beispiel-Buchungen genutzt
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.grund).toBeTruthy();
  });

  it("erlaubt das Löschen eines unbebuchten Kontos", async () => {
    const repo = erstelleVorschauDatenquelle();
    const ergebnis = await repo.kontoLoeschen("4980"); // im Beispieldatensatz nicht bebucht
    expect(ergebnis.ok).toBe(true);
    expect((await repo.konten()).some((k) => k.nr === "4980")).toBe(false);
  });

  it("verweigert das Löschen einer bebuchten Kostenstelle", async () => {
    const repo = erstelleVorschauDatenquelle();
    await repo.kostenstelleSpeichern({ id: "ks1", name: "Filiale Nord", notiz: "", aktiv: true });
    const buchungen = await repo.buchungen();
    await repo.buchungSpeichern({ ...buchungen[0], kostenstelle_id: "ks1" });
    const ergebnis = await repo.kostenstelleLoeschen("ks1");
    expect(ergebnis.ok).toBe(false);
  });

  it("legt eine Buchung an, ändert sie und löscht sie wieder", async () => {
    const repo = erstelleVorschauDatenquelle();
    const id = "neu-1";
    await repo.buchungSpeichern({
      id,
      datum: "2026-08-01",
      text: "Test",
      konto: "8400",
      gegenkonto: "1000",
      betrag_brutto: 50,
      ust_satz: 19,
      quelle: "manuell",
      storniert: false,
    });
    expect((await repo.buchungen()).some((b) => b.id === id)).toBe(true);

    await repo.buchungSpeichern({
      id,
      datum: "2026-08-01",
      text: "Test geändert",
      konto: "8400",
      gegenkonto: "1000",
      betrag_brutto: 75,
      ust_satz: 19,
      quelle: "manuell",
      storniert: false,
    });
    const geaendert = (await repo.buchungen()).find((b) => b.id === id);
    expect(geaendert?.betrag_brutto).toBe(75);

    await repo.buchungLoeschen(id);
    expect((await repo.buchungen()).some((b) => b.id === id)).toBe(false);
  });
});
