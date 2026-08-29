import { describe, expect, it } from "vitest";
import { offenerBetrag, offeneGutscheinSumme, statusNachEinloesung } from "./gutschein.ts";
import type { Gutschein } from "./gutschein.ts";

describe("Gutschein", () => {
  it("berechnet den offenen Restbetrag", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 50, eingeloest_betrag: 20, status: "teilweise_eingeloest" };
    expect(offenerBetrag(g)).toBe(30);
  });

  it("summiert nur nicht vollständig eingelöste Gutscheine", () => {
    const gutscheine: Gutschein[] = [
      { nummer: "G-1", betrag: 50, eingeloest_betrag: 0, status: "offen" },
      { nummer: "G-2", betrag: 30, eingeloest_betrag: 30, status: "eingeloest" },
      { nummer: "G-3", betrag: 20, eingeloest_betrag: 5, status: "teilweise_eingeloest" },
    ];
    expect(offeneGutscheinSumme(gutscheine)).toBe(65);
  });
});

describe("statusNachEinloesung", () => {
  it("bleibt offen, wenn nichts eingelöst wurde", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 50, eingeloest_betrag: 0, status: "offen" };
    expect(statusNachEinloesung(g, 0)).toBe("offen");
  });

  it("wechselt zu teilweise eingelöst bei einer Teilzahlung", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 50, eingeloest_betrag: 0, status: "offen" };
    expect(statusNachEinloesung(g, 20)).toBe("teilweise_eingeloest");
  });

  it("wechselt zu vollständig eingelöst, sobald der Restbetrag erreicht ist", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 50, eingeloest_betrag: 20, status: "teilweise_eingeloest" };
    expect(statusNachEinloesung(g, 30)).toBe("eingeloest");
  });

  it("behandelt Rundungsdifferenzen beim vollständigen Einlösen korrekt", () => {
    const g: Gutschein = { nummer: "G-1", betrag: 19.99, eingeloest_betrag: 0, status: "offen" };
    expect(statusNachEinloesung(g, 19.99)).toBe("eingeloest");
  });
});
