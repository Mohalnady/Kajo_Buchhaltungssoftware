# Kontor

Internes Buchhaltungs- und Abrechnungsprogramm für kleine Einzelhandelsbetriebe.
Die vollständige fachliche und technische Spezifikation steht in [`SPEC.md`](./SPEC.md),
die Arbeitsanweisung für die Weiterentwicklung in [`CLAUDE.md`](./CLAUDE.md).

Der Browser-Prototyp (Phase P0) liegt unter [`referenz/prototyp.html`](./referenz/prototyp.html)
und ist die verbindliche Vorlage für Design und Bedienablauf.

## Stand

Phase P1 (Buchhaltung) ist begonnen: Tauri-2/Vite/TypeScript-Projektgerüst,
SQLite-Datenbankschema als Migration, Rechenkerne (Umsatzsteuer, Kassenbuch,
Summenbildung, Importparser, Geldtransit, Gutschein) mit Vitest-Tests, Design-Tokens
und Grundnavigation sowie ein Dashboard mit echten KPI-Kacheln (Einnahmen, Ausgaben,
Ergebnis, USt-Zahllast, Kassenbestand mit Negativ-Warnung, offene Gutscheine) auf
Basis der bereits getesteten Rechenkerne — vorerst mit Beispieldaten, bis Buchungen
über eine echte Oberfläche erfasst werden.

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
referenz/prototyp.html          P0-Browser-Prototyp (Design-/Ablaufvorlage)
src/lib/                        Rechenkerne (USt, Kasse, Summen, Import, Geldtransit, Gutschein) + Tests
src/db/                         Datenzugriff auf zentrale und Mandanten-SQLite-Datenbanken
src/demodaten.ts                Beispieldaten für die Dashboard-Vorschau
src/i18n.ts, src/main.ts        Sprachschlüssel, Navigation, Dashboard und Design-Shell
src-tauri/                      Tauri-2-Projekt (Rust)
src-tauri/migrations/zentral/   Migration der zentralen kontor.db
src-tauri/migrations/mandant/   Migration je Mandanten-Datenbank
```
