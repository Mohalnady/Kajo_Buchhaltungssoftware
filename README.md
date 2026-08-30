# Kontor

Internes Buchhaltungs- und Abrechnungsprogramm für kleine Einzelhandelsbetriebe.
Die vollständige fachliche und technische Spezifikation steht in [`SPEC.md`](./SPEC.md),
die Arbeitsanweisung für die Weiterentwicklung in [`CLAUDE.md`](./CLAUDE.md), die
Bedienungsanleitung für Endnutzer in [`HANDBUCH.md`](./HANDBUCH.md).

Der Browser-Prototyp (Phase P0) liegt unter [`referenz/prototyp.html`](./referenz/prototyp.html)
und war die Vorlage für Design und Bedienablauf.

## Stand

P0–P5 sind umgesetzt: Buchhaltung (Buchungen, Kassenbuch, Gutscheine, Belege),
Auswertungen (BWA, EÜR, USt-Voranmeldung, Berichte, sieben Diagramme), Import und
Export (Dateiimport mit Zuordnung/Regeln/Protokoll, Belegablage, Monatspaket-ZIP),
Personal (Mitarbeiter, Zeiterfassung mit Freigabe-Workflow, Zuschlagsregeln,
Feiertage NRW), Zugang und Sicherung (Benutzerverwaltung mit vier Rollen,
Argon2-Passwort-Hashing, lokale verschlüsselte Sicherung, Google-Drive-Anbindung).

P6 (Ausliefern) läuft: Erstinbetriebnahme-Assistent und Firmendaten-Einstellungen
sind fertig, ebenso der Aktualisierungsmechanismus (tauri-plugin-updater) und die
Windows-Installer-Konfiguration. Offene Punkte stehen in `HANDBUCH.md` Abschnitt 6.3
und 7.4 (Excel-/PDF-Export der Auswertungen, DATEV-Export, Stundenzettel-PDF) sowie
in `SPEC.md` Abschnitt 8 (SQLCipher-Datenbankverschlüsselung — siehe Begründung in
den Commit-Nachrichten, warum das mit der aktuellen SQL-Plugin-Version nicht ohne
größere Architekturänderung sauber geht).

## Entwicklung

```sh
npm install
npm run dev      # Vite-Dev-Server (Browser-Vorschau der Oberfläche)
npm test         # Vitest-Tests der Rechenkerne
npm run tauri dev   # Tauri-Desktop-Fenster (benötigt GTK/WebKit-Systembibliotheken unter Linux)
```

## Struktur

```
SPEC.md                         Fachliche und technische Spezifikation
CLAUDE.md                       Arbeitsanweisung
HANDBUCH.md                     Bedienungsanleitung für Endnutzer
referenz/prototyp.html          P0-Browser-Prototyp (Design-/Ablaufvorlage)
src/lib/                        Rechenkerne (USt, Kasse, BWA, EÜR, Stunden, Geldtransit, Gutschein, …) + Tests
src/db/                         Datenzugriff auf zentrale und Mandanten-SQLite-Datenbanken
src/repo/                       Datenquelle-Abstraktion: repo/tauri.ts (echtes SQLite), repo/vorschau.ts (Browser-Vorschau ohne Persistenz)
src/i18n.ts, src/main.ts        Sprachschlüssel, Navigation und komplette Oberfläche
src-tauri/                      Tauri-2-Projekt (Rust): Argon2, Google-Drive-OAuth, Tauri-Commands
src-tauri/migrations/zentral/   Migration der zentralen kontor.db (Mandantenregister, Benutzer)
src-tauri/migrations/mandant/   Migration je Mandanten-Datenbank
```
