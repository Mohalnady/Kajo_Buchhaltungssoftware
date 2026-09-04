# CLAUDE.md — Arbeitsanweisung für Kontor

Lies immer zuerst `SPEC.md`. Dort steht das Fachliche vollständig.
Diese Datei regelt nur, wie gearbeitet wird.

## Was das Projekt ist

Kontor ist ein internes Buchhaltungs- und Abrechnungsprogramm für kleine
Einzelhandelsbetriebe in Deutschland. Erstfall ist ein Süßwarenladen.
Zielform: Desktop-App mit Tauri 2, SQLite, TypeScript, Vite.

Der Browser-Prototyp liegt unter `referenz/prototyp.html`. Er ist die verbindliche
Vorlage für Design und Bedienablauf, **nicht** für die Code-Struktur.

## Sprache

Alles, was der Nutzer sieht, ist Deutsch. Zusätzlich Englisch und Arabisch,
Arabisch mit Rechts-nach-links-Layout. Keine harten Texte im Code, alles über
den Sprachschlüssel. Layout ausschließlich mit logischen CSS-Eigenschaften
(`margin-inline-start`, `text-align:start`, `inset-inline-end`).

Kommentare und Commits auf Deutsch.

## Regeln beim Bauen

1. **Rechenlogik zuerst, Oberfläche danach.** Umsatzsteuer, BWA, EÜR, Kassenbestand
   und Stundenberechnung bekommen Vitest-Tests, bevor irgendeine Ansicht entsteht.
   Ein Rechenfehler in der Buchhaltung ist kein Schönheitsfehler.
2. **Nichts fest verdrahten.** Konten, Steuersätze, Kostenstellen, Importregeln,
   Zuschläge, Feiertage — alles anlegbar, bearbeitbar, löschbar. Vorgaben sind
   Startwerte, keine Zwänge.
3. **Löschen nur wo unschädlich.** Ein Konto, auf das gebucht wurde, wird nicht
   gelöscht sondern inaktiv gesetzt. Buchungen in abgeschlossenen Monaten werden
   storniert, nicht entfernt.
4. **Jede Phase endet lauffähig.** Keine halben Zustände über einen Phasenschnitt hinaus.
5. **Geldbeträge** immer brutto speichern, netto und Steuer rechnen. Niemals Fließkomma
   für Endsummen ohne Rundung auf zwei Stellen.
6. **Datumsangaben** intern als `JJJJ-MM-TT`, angezeigt als `TT.MM.JJJJ`.

## Die drei Fallen, die alles kaputtmachen

Ausführlich in `SPEC.md` Abschnitt 5. Kurzfassung:

- **Geldtransit.** Kartengutschriften und Bareinzahlungen sind kein Umsatz, sondern
  Geldbewegung auf 1360. Sonst wird der Umsatz doppelt gezählt.
- **Gutscheine.** Mehrzweckgutscheine sind bei Ausgabe eine Verbindlichkeit auf 1700,
  Umsatz entsteht erst beim Einlösen.
- **Kassenbestand.** Darf nie negativ werden. Wird er es, ist ein Fehler in den Daten
  und das muss deutlich angezeigt werden.

## Was das Programm nicht ist

Keine GoBD-zertifizierte Software, kein Ersatz für eine TSE-Kasse, keine
Lohnabrechnung im rechtlichen Sinn, keine Steuerberatung. Dieser Hinweis gehört
sichtbar in die App und darf nicht wegoptimiert werden.

## Reihenfolge

P1 Buchhaltung → P2 Auswertungen → P3 Export und Import → P4 Personal →
P5 Zugang und Sicherung → P6 Ausliefern.

Aktueller Stand: P0–P6 umgesetzt (Details in README.md "Stand" und
HANDBUCH.md). Ein bekannter offener Punkt: SQLCipher-Datenbankverschlüsselung
(siehe README.md).
