// Startkontenrahmen SKR03, angelehnt an den Bedarf eines Einzelhandelsbetriebs.
// Siehe SPEC.md Abschnitt 4 und den Prototyp (referenz/prototyp.html).
// Das ist ein Startwert, kein Zwang — jeder Mandant kann Konten anlegen,
// bearbeiten und (falls unbebucht) löschen.

import type { Konto } from "./types.ts";

const ROHDATEN: [string, string, Konto["typ"], number, string][] = [
  ["1000", "Kasse", "finanz", 0, ""],
  ["1200", "Bank", "finanz", 0, ""],
  ["1210", "Kartenzahlung SumUp", "finanz", 0, ""],
  ["1360", "Geldtransit", "finanz", 0, ""],
  ["1700", "Verbindlichkeit aus Gutscheinen", "finanz", 0, ""],
  ["1800", "Privatentnahme", "privat", 0, ""],
  ["1890", "Privateinlage", "privat", 0, ""],
  ["8300", "Erlöse 7 % USt", "erloes", 7, "umsatz"],
  ["8400", "Erlöse 19 % USt", "erloes", 19, "umsatz"],
  ["8195", "Erlöse Kleinunternehmer § 19", "erloes", 0, "umsatz"],
  ["8905", "Unentgeltliche Wertabgabe", "erloes", 7, "neutral"],
  ["2700", "Sonstige betriebliche Erträge", "erloes", 0, "neutral"],
  ["3300", "Wareneingang 7 % Vorsteuer", "aufwand", 7, "ware"],
  ["3400", "Wareneingang 19 % Vorsteuer", "aufwand", 19, "ware"],
  ["3960", "Verpackungsmaterial", "aufwand", 19, "ware"],
  ["4100", "Löhne und Gehälter", "aufwand", 0, "personal"],
  ["4110", "Löhne Minijob", "aufwand", 0, "personal"],
  ["4130", "Gesetzliche Sozialaufwendungen", "aufwand", 0, "personal"],
  ["4210", "Miete Ladenlokal", "aufwand", 0, "raum"],
  ["4240", "Strom, Gas, Wasser", "aufwand", 19, "raum"],
  ["4250", "Reinigung", "aufwand", 19, "raum"],
  ["4260", "Instandhaltung Räume", "aufwand", 19, "raum"],
  ["4320", "Gewerbesteuer", "aufwand", 0, "steuern"],
  ["4360", "Versicherungen", "aufwand", 0, "vers"],
  ["4380", "Beiträge IHK und Verbände", "aufwand", 0, "vers"],
  ["4530", "Laufende Kfz-Kosten", "aufwand", 19, "kfz"],
  ["4540", "Kfz-Versicherung und -Steuer", "aufwand", 0, "kfz"],
  ["4600", "Werbekosten", "aufwand", 19, "werbung"],
  ["4650", "Bewirtungskosten", "aufwand", 19, "werbung"],
  ["4670", "Reisekosten", "aufwand", 19, "werbung"],
  ["4750", "Transport und Fracht", "aufwand", 19, "warenabgabe"],
  ["4805", "Reparatur Ausstattung", "aufwand", 19, "rep"],
  ["4830", "Abschreibungen", "aufwand", 0, "afa"],
  ["4855", "Sofortabschreibung GWG", "aufwand", 19, "afa"],
  ["4910", "Porto", "aufwand", 19, "sonst"],
  ["4920", "Telefon und Internet", "aufwand", 19, "sonst"],
  ["4930", "Bürobedarf", "aufwand", 19, "sonst"],
  ["4955", "Steuerberatung", "aufwand", 19, "sonst"],
  ["4960", "Software und Kassensystem", "aufwand", 19, "sonst"],
  ["4970", "Nebenkosten Geldverkehr", "aufwand", 0, "sonst"],
  ["4980", "Sonstiger Betriebsbedarf", "aufwand", 19, "sonst"],
];

export function skr03Startkonten(): Konto[] {
  return ROHDATEN.map(([nr, name, typ, ust_satz, bwa_gruppe], i) => ({
    nr,
    name,
    typ,
    ust_satz,
    bwa_gruppe,
    aktiv: true,
    sortierung: i * 10,
  }));
}
