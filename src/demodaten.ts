// Beispieldaten für die Dashboard-Vorschau, solange Buchungen noch nicht über
// eine echte Oberfläche erfasst werden (folgt in einem der nächsten P1-Schritte).
// Ausdrücklich als Beispiel gekennzeichnet — siehe CLAUDE.md: nichts vortäuschen.

import type { Buchung } from "./lib/types.ts";
import { skr03Startkonten } from "./lib/skr03.ts";

export function demoKonten() {
  return skr03Startkonten();
}

export function demoBuchungen(): Buchung[] {
  const heute = new Date().toISOString().slice(0, 10);
  const monat = heute.slice(0, 7);
  return [
    { id: "d1", datum: `${monat}-03`, text: "Tageseinnahmen Bar", konto: "8400", gegenkonto: "1000", betrag_brutto: 892.5, ust_satz: 19, quelle: "manuell", storniert: false },
    { id: "d2", datum: `${monat}-03`, text: "Tageseinnahmen Karte", konto: "8300", gegenkonto: "1210", betrag_brutto: 340.1, ust_satz: 7, quelle: "manuell", storniert: false },
    { id: "d3", datum: `${monat}-05`, text: "Wareneinkauf Großhandel", konto: "3300", gegenkonto: "1200", betrag_brutto: 610.4, ust_satz: 7, quelle: "manuell", storniert: false },
    { id: "d4", datum: `${monat}-07`, text: "Miete Ladenlokal", konto: "4210", gegenkonto: "1200", betrag_brutto: 950, ust_satz: 0, quelle: "manuell", storniert: false },
    { id: "d5", datum: `${monat}-10`, text: "Strom und Wasser", konto: "4240", gegenkonto: "1200", betrag_brutto: 180.2, ust_satz: 19, quelle: "manuell", storniert: false },
    { id: "d6", datum: `${monat}-12`, text: "Bareinzahlung Tageskasse", konto: "1000", gegenkonto: "1360", betrag_brutto: 500, ust_satz: 0, quelle: "manuell", storniert: false },
  ];
}

export function demoGutscheine() {
  return [
    { nummer: "G-2026-014", betrag: 25, eingeloest_betrag: 0, status: "offen" as const },
    { nummer: "G-2026-018", betrag: 50, eingeloest_betrag: 20, status: "teilweise_eingeloest" as const },
  ];
}

export const DEMO_KASSEN_ANFANGSBESTAND = 200;
export const DEMO_KLEINUNTERNEHMER = false;
