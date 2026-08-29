# Kontor — Spezifikation

Internes Buchhaltungs- und Abrechnungsprogramm für kleine Einzelhandelsbetriebe.
Erstfall: ein Süßwarenladen. Das Programm muss aber mandantenfähig und flexibel genug
für andere Kleinbetriebe sein.

Stand: Juli 2026. Phase P0 ist als Browser-Prototyp fertig (`kontor.html`).
Ab P1 wird in Claude Code weitergebaut.

---

## 1. Zielbild

Der Betreiber soll seine monatliche Abrechnung vollständig selbst machen können:
Belege erfassen oder importieren, sortiert auf Konten nach deutschem System,
Auswertungen ziehen, Mitarbeiterstunden führen und am Monatsende ein Paket an den
Steuerberater oder ans Finanzamt geben.

**Leitprinzip: nichts ist fest verdrahtet.** Konten, Kostenstellen, Steuersätze,
Importregeln, Mitarbeiter, Firmen — alles muss anlegbar, bearbeitbar und löschbar sein.
Wo eine Vorgabe sinnvoll ist, wird sie als Startwert geliefert, nicht als Zwang.

**Ausdrücklich kein Ziel:** GoBD-Zertifizierung, Ersatz einer TSE-Kasse, Lohnabrechnung
im rechtlichen Sinn, Steuerberatung. Das Programm ist ein Vorbereitungs- und
Übersichtswerkzeug. Dieser Hinweis gehört sichtbar in die App.

---

## 2. Technik

| Bereich | Entscheidung |
|---|---|
| Zielform | Desktop-App mit **Tauri 2** (nicht Electron: ~10 MB statt ~150 MB) |
| Frontend | Vanilla TypeScript + Vite, keine schweren Frameworks. Kein Tailwind, eigenes Token-CSS |
| Datenbank | **SQLite** über `tauri-plugin-sql`, eine Datei pro Mandant unter `$APPDATA/kontor/mandanten/<id>.db` |
| Dateien | Belege liegen als Dateien in `$APPDATA/kontor/belege/<mandant>/<jahr>/`, in der DB nur der Pfad |
| Excel | SheetJS (`xlsx`) für Import und Export |
| PDF | `pdf-lib` oder `jspdf` + autotable, deutsche Umlaute prüfen |
| Diagramme | eigene SVG-Komponenten, keine Chart-Bibliothek — der Prototyp zeigt den Stil |
| Tests | Vitest für Rechenlogik (USt, BWA, EÜR, Stunden). Die Rechenkerne müssen getestet sein |
| Build | `cargo tauri build` erzeugt Windows-Installer |

**Migrationsweg:** Der Prototyp `kontor.html` ist Referenz für Design und Ablauf,
nicht für Code. Die Rechenfunktionen (`calc`, `split`, `kassenstand`, Importparser)
sind aber direkt übertragbar und sollten als erstes nach TypeScript portiert und
mit Tests abgesichert werden.

---

## 3. Design

Vorlage ist ein vom Auftraggeber gelieferter Dashboard-Screenshot. Der Prototyp setzt
ihn bereits um. Diese Tokens sind verbindlich:

```css
--ink:#14151A; --ink2:#41454D; --muted:#8C9199; --line:#F0F0F3; --surface:#FFFFFF;
--pos:#3BA55C; --neg:#E0524F;
--t-mint:#E6F4E9; --t-yellow:#FCF3D5; --t-lav:#EDEAFA; --t-blue:#E7F0FD; --t-rose:#FBEAEF;
--bar1:#FDEDA8; --bar2:#F6CE45;
--r:20px; --r-sm:14px; --r-xs:10px;
--sh:0 1px 2px rgba(20,20,30,.04), 0 10px 28px rgba(20,20,30,.05);
```

Hintergrund: zwei weiche Radialverläufe, rosa oben links, mint unten rechts, auf `#FDFAF5`.
Schrift: Plus Jakarta Sans, für Arabisch Noto Sans Arabic.

Merkmale: weiße Karten mit 20 px Radius und weichem Schatten, Seitenleiste mit schwarzer
Pille für den aktiven Punkt, farbige Schnellzugriff-Kacheln, große fette Kennzahlen mit
Tabellenziffern, Balkendiagramm mit gelbem Verlauf und abgerundeten Balkenköpfen.

Alle Abstände und Ausrichtungen mit logischen CSS-Eigenschaften (`margin-inline-start`,
`text-align:start`), damit Arabisch ohne Sonderfälle funktioniert.

---

## 4. Datenmodell

Pro Mandant eine SQLite-Datei mit diesen Tabellen.

```sql
mandant(id, name, firma, inhaber, strasse, plz, ort, land, stnr, ustid, tel, mail,
        logo_pfad, gewinnart, kleinunternehmer, versteuerung, voranmeldung,
        wirtschaftsjahr_beginn, kassen_anfangsbestand, waehrung, angelegt_am)

konto(nr PK, name, typ, ust_satz, bwa_gruppe, euer_zeile, datev_konto, aktiv, sortierung)
  typ ∈ erloes | aufwand | finanz | privat | bestand

kostenstelle(id, name, notiz, aktiv)

buchung(id, datum, wertstellung, belegnr, text, konto, gegenkonto, betrag_brutto,
        ust_satz, kostenstelle_id, quelle, import_id, storniert, angelegt_von,
        angelegt_am, geaendert_am)
  quelle ∈ manuell | import_bank | import_kasse | import_excel | dauerbuchung

buchung_split(id, buchung_id, konto, betrag_brutto, ust_satz, kostenstelle_id)
  nur bei Splitbuchungen, sonst leer

beleg(id, buchung_id, dateiname, pfad, mime, groesse, hinzugefuegt_am)

dauerbuchung(id, name, text, konto, gegenkonto, betrag_brutto, ust_satz,
             intervall, naechste_faellig, aktiv)
  intervall ∈ monatlich | quartal | jaehrlich

importregel(id, stichwoerter, konto, gegenkonto, prioritaet, aktiv)

importlauf(id, datei, format, zeilen, uebernommen, datum, benutzer_id)

gutschein(id, nummer, ausgabe_datum, betrag, eingeloest_betrag, eingeloest_datum, status)

mitarbeiter(id, name, personalnr, rolle, beschaeftigungsart, eintritt, austritt,
            stundenlohn, wochenstunden, urlaubstage_jahr, aktiv, benutzer_id)
  beschaeftigungsart ∈ minijob | teilzeit | vollzeit | aushilfe

zeiteintrag(id, mitarbeiter_id, datum, von, bis, pause_min, stunden, art,
            notiz, status, freigegeben_von, freigegeben_am, erfasst_von)
  art ∈ arbeit | urlaub | krank | feiertag | frei
  status ∈ entwurf | eingereicht | freigegeben | abgelehnt

zuschlagsregel(id, art, von_uhrzeit, bis_uhrzeit, wochentag, prozent, aktiv)
  art ∈ nacht | sonntag | feiertag

benutzer(id, name, rolle, passwort_hash, salt, aktiv, letzter_login)
  rolle ∈ inhaber | buchhalter | mitarbeiter | steuerberater

einstellung(schluessel PK, wert)
```

Zentrale Datei `$APPDATA/kontor/kontor.db` hält Mandantenliste, Benutzer und
globale Einstellungen wie Sprache und Backup-Konfiguration.

---

## 5. Fachliche Regeln

Diese Regeln sind der Kern. Werden sie falsch umgesetzt, sind alle Auswertungen wertlos.

### 5.1 Umsatzsteuer

- Beträge werden **brutto** erfasst, netto und Steuer werden gerechnet:
  `netto = brutto / (1 + satz/100)`, `steuer = brutto − netto`
- Steuersätze sind frei pflegbar. Startwerte 0, 7, 19. Neue Sätze mit Gültigkeitsdatum
- Bei aktivem Kleinunternehmerstatus rechnet die gesamte App mit 0 % und weist keine
  Umsatzsteuer aus. Erlöse laufen dann auf 8195
- Voranmeldungszeitraum frei wählbar: monatlich, quartalsweise, jährlich
- Ist- und Soll-Versteuerung sind umschaltbar. Bei Ist zählt das Zahlungsdatum,
  bei Soll das Rechnungsdatum. Deshalb hat `buchung` beide Felder

### 5.2 Geldtransit — die wichtigste Falle

Wenn Kassendaten **und** Bankdaten importiert werden, entsteht Doppelerfassung.
Der Umsatz kommt aus der Kasse, die Bank zeigt nur die Geldbewegung.

Diese Vorgänge sind **kein Erlös**, sondern gehen auf **1360 Geldtransit**:

- Sammelgutschriften des Kartendienstleisters (SumUp, Zettle, Nexi)
- Bareinzahlungen der Tageskasse auf das Bankkonto
- Umbuchungen zwischen eigenen Konten

Die Differenz zwischen den Kartenumsätzen der Kasse und der Bankgutschrift ist die
Gebühr des Dienstleisters und gehört auf **4970 Nebenkosten des Geldverkehrs**.
Die App soll diese Differenz vorschlagen, sobald beide Seiten vorliegen.

### 5.3 Gutscheine

Ein Gutschein in einem Laden mit mehreren Steuersätzen ist ein **Mehrzweckgutschein**.
Bei der Ausgabe entsteht kein Umsatz, sondern eine Verbindlichkeit auf **1700**.
Erst beim Einlösen entsteht steuerpflichtiger Erlös mit dem Satz der gekauften Ware.

Die Tabelle `gutschein` führt Ausgabe und Einlösung. Es braucht eine Übersicht der
offenen Gutscheine mit Summe, weil das eine Verbindlichkeit gegenüber Kunden ist.

### 5.4 Kassenbuch

Alle Buchungen mit Gegenkonto 1000, chronologisch, mit laufendem Bestand ab
Anfangsbestand. Der Bestand darf rechnerisch **nie negativ** werden — das ist ein
sicheres Zeichen für einen Fehler und muss deutlich rot markiert werden.
Bar- und Kartenzahlung laufen getrennt (1000 und 1210).

### 5.5 BWA

Zuordnung über `konto.bwa_gruppe`. Aufbau der detaillierten BWA:

```
Umsatzerlöse
− Material- und Wareneinsatz
= Rohertrag
− Personalkosten
− Raumkosten
− Betriebliche Steuern
− Versicherungen und Beiträge
− Fahrzeugkosten
− Werbe- und Reisekosten
− Kosten der Warenabgabe
− Abschreibungen
− Reparatur und Instandhaltung
− Sonstige Kosten
= Betriebsergebnis
± Neutraler Aufwand und Ertrag
= Vorläufiges Ergebnis
```

Jede Zeile mit vier Spalten: laufender Monat, Vormonat, Vorjahresmonat, Jahr kumuliert.
Zusätzlich Prozent vom Umsatz je Zeile.

### 5.6 EÜR

Betriebseinnahmen und Betriebsausgaben nach Zahlungszeitpunkt, Aufbau angelehnt an die
amtliche Anlage EÜR mit Zeilennummern über `konto.euer_zeile`. Privatentnahmen und
Privateinlagen sind **nicht** ergebniswirksam, müssen aber ausgewiesen werden.
Bei Gewinnart Bilanz wird stattdessen eine einfache Gewinn- und Verlustrechnung gezeigt.

### 5.7 Stunden und Lohn

- Erfassung wahlweise als Kommen, Gehen, Pause **oder** als reine Stundenzahl
- Warnung ab 10 Stunden an einem Tag. Keine automatische Umverteilung
- Zuschläge frei konfigurierbar, Startwerte: Nacht 25 %, Sonntag 50 %, Feiertag 125 %
- Urlaub, Krankheit und Feiertag als eigene Eintragsarten, zählen nicht als Arbeitszeit,
  erscheinen aber im Stundenzettel
- Bruttolohn = Summe Arbeitsstunden × Stundenlohn + Zuschläge
- Mitarbeiter tragen selbst ein, Status `eingereicht`. Erst nach Freigabe durch den
  Inhaber gilt der Eintrag als verbindlich und fließt in Auswertungen
- Feiertage: nach Bundesland, Startwert Nordrhein-Westfalen

---

## 6. Import

### Formate

Excel `.xlsx` und `.xls`, CSV mit Semikolon, Komma oder Tabulator, `.json`,
Markdown-Tabelle. Zeichensatz UTF-8 und Windows-1252 erkennen.

### Ablauf

1. Datei wählen, Format erkennen, erste Zeile als Kopfzeile
2. **Spalten zuordnen** — automatischer Vorschlag über Regex auf die Überschriften.
   Zielfelder: Datum, Betrag (Pflicht), Buchungstext, zweiter Textteil, Belegnummer,
   Steuersatz, Zahlart, Kostenstelle
3. **Regeln anwenden** — Stichwörter im Text setzen das Konto
4. **Prüfen** — jede Zeile einzeln abwählbar, Konto und Gegenkonto änderbar,
   Dubletten erkannt und automatisch abgewählt
5. Übernehmen, Lauf in `importlauf` protokollieren, Rückgängig-Funktion für den letzten Lauf

### Konventionen

- Negativer Betrag → Ausgabe, positiver → Einnahme
- Datumsformate: `TT.MM.JJJJ`, `JJJJ-MM-TT`, Excel-Serienzahl ab 1899-12-30
- Zahlart Bar → 1000, EC oder Karte → 1210, sonst 1200
- Dublettenerkennung über Datum, Betrag und Text
- Zwei Textspalten dürfen zu einem Buchungstext verbunden werden

### Startregeln

| Stichwörter | Konto |
|---|---|
| sumup, kartenumsatz, kartenzahlung | 1360 |
| bareinzahlung, tageskasse, einzahlung | 1360 |
| großhandel, süßwaren, wareneingang, lieferant | 3300 |
| stadtwerke, strom, gas, wasser, energie | 4240 |
| miete, mietverwaltung, pacht | 4210 |
| lohn, gehalt, minijob | 4100 |
| versicherung | 4360 |
| telekom, vodafone, internet, telefon | 4920 |
| steuerberat, buchführung | 4955 |
| werbung, anzeige, google, meta | 4600 |
| gebühr, entgelt, kontoführung | 4970 |

### Beispielformate

Bank:
```
Buchungstag;Wertstellung;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Betrag;Währung
```

Kasse:
```
Datum;Uhrzeit;Bon_ID;Kassierer;Zahlart;Artikel;Kategorie;MwSt_Satz;Gesamt_Brutto
```

Beim Kassenimport wird pro Tag und Steuersatz verdichtet, nicht pro Bon.
Das Feld Kassierer wird mit `mitarbeiter` verknüpft, sofern der Name passt.

---

## 7. Export

| Format | Inhalt |
|---|---|
| Excel | Journal, Kontenblätter, BWA, EÜR, Summen und Salden, Stundenlisten — je ein Blatt |
| PDF | alle Auswertungen, A4, Logo und Kopfzeile aus den Mandantendaten, Querformat bei breiten Tabellen |
| CSV | Rohdaten der Buchungen |
| DATEV | EXTF-Buchungsstapel, Version 700, Semikolon, Windows-1252, mit Kopfzeile |
| Monatspaket | ZIP mit allen Auswertungen eines Monats, zusätzlich einzeln abrufbar |

PDF-Kopfzeile: Logo links, rechts Firma, Anschrift, Steuernummer. Fußzeile mit
Seitenzahl, Erstellungsdatum und dem Hinweis, dass es sich um eine interne Auswertung handelt.

---

## 8. Rollen

| Recht | Inhaber | Buchhalter | Mitarbeiter | Steuerberater |
|---|---|---|---|---|
| Buchungen sehen und erfassen | ja | ja | nein | nur lesen |
| Auswertungen und Export | ja | ja | nein | nur lesen |
| Stammdaten und Konten | ja | ja | nein | nein |
| Mitarbeiter und Löhne | ja | **nein** | nein | nein |
| Eigene Stunden erfassen | ja | nein | ja | nein |
| Fremde Stunden sehen | ja | nein | nein | nein |
| Stunden freigeben | ja | nein | nein | nein |
| Firmen anlegen, Backup | ja | nein | nein | nein |

Passwörter mit Argon2 oder bcrypt. Die SQLite-Datei wird über SQLCipher verschlüsselt,
Schlüssel aus dem Passwort des Inhabers. Ohne Verschlüsselung wäre der Passwortschutz
nur eine Sichtblende — das ist dem Auftraggeber so mitgeteilt worden.

---

## 9. Sicherung

- Vollsicherung als verschlüsseltes Archiv mit allen Mandanten und Belegdateien
- Intervall einstellbar: täglich, wöchentlich, monatlich. Voreinstellung wöchentlich
- Ziel: **Google Drive** über OAuth-Desktop-Ablauf mit `drive.file`-Berechtigung.
  Der Nutzer legt einmal ein Google-Cloud-Projekt an, die App führt ihn durch die
  Einrichtung und speichert das Refresh-Token im System-Schlüsselbund
- Zweitweg ohne Einrichtung: Sicherung in einen lokalen Ordner, den Drive oder Dropbox
  ohnehin synchronisiert
- Die letzten zehn Sicherungen bleiben erhalten, ältere werden gelöscht
- Wiederherstellung mit Vorschau, welcher Stand eingespielt wird

---

## 10. Phasen

**P0 — Gerüst.** Fertig als Browser-Prototyp. Design, Navigation, Mandanten, drei
Sprachen mit Rechts-nach-links, Einstellungen mit Logo, Kontenrahmen und Kostenstellen
mit vollem Bearbeiten, Buchungen erfassen, Dateiimport mit Zuordnung und Prüfung,
JSON-Sicherung.

**P1 — Buchhaltung vollständig.**
Projekt in Tauri aufsetzen, Prototyp portieren, SQLite anbinden, Migrationen.
Splitbuchungen, Belegdateien anhängen, Dauerbuchungen mit Fälligkeitslauf,
Belegnummernkreis automatisch und manuell, Kassenbuch mit Negativprüfung,
Gutscheinverwaltung, Storno statt Löschen bei abgeschlossenen Monaten.

**P2 — Auswertungen.**
BWA detailliert mit vier Vergleichsspalten, EÜR, Umsatzsteuer-Voranmeldung mit
flexiblem Zeitraum und Kennzahlen 81, 86, 66, 83, Summen- und Saldenliste, Journal,
Kontenblätter, alle sieben Diagramme: Umsatzverlauf, Kostenverteilung, Ergebnis pro
Monat, Kasse und Bank, Personalkosten, Vorjahresvergleich, Umsatzsteuer.

**P3 — Export und Import ausbauen.**
Excel- und PDF-Ausgabe aller Auswertungen mit Logo und Kopfzeile, Monatspaket als ZIP,
DATEV-Buchungsstapel, Import-Rückgängig, Importläufe protokolliert,
Kassenimport mit Tagesverdichtung und Geldtransit-Abgleich.

**P4 — Personal.**
Mitarbeiterstammdaten, Zeiterfassung in beiden Varianten, Zuschlagsregeln,
Abwesenheiten, Zehn-Stunden-Warnung, Bruttolohnberechnung, Stundenzettel als PDF
pro Person und als Sammelliste mit Unterschriftsfeld, Auswertung Personalkosten
gegen Umsatz.

**P5 — Zugang und Sicherung.**
Benutzerverwaltung, vier Rollen, verschlüsselte Datenbank, Handy-Oberfläche für die
Stundenerfassung mit Einreichen und Freigeben, Backup nach Google Drive mit Intervall.

**P6 — Ausliefern.**
Windows-Installer über `cargo tauri build`, Aktualisierungsmechanismus,
Erstinbetriebnahme-Assistent, deutsches Handbuch.

**Danach.** Rechnungen schreiben, Artikel und Lagerbestand, Budget und Planwerte.

---

## 11. Offene Punkte

- Rechtsform und Gewinnermittlungsart des Betriebs stehen noch nicht fest.
  Deshalb muss beides umschaltbar bleiben.
- Ob die Ladenkasse eine zertifizierte TSE hat, ist ungeklärt. Der Betreiber prüft das
  beim Kassenhändler. Für den Import ist es unerheblich, für die Rechtslage nicht.
- Echte Bank- und Kassenexporte fehlen noch. Die bisherigen Beispiele sind erfunden.
  Vor P3 müssen echte Dateien vorliegen, sonst passt der Parser nicht zur Realität.
- Bei über zehn Mitarbeitern mit Selbsterfassung ist eine reine Desktop-App eng.
  Der Weg in P5 ist eine kleine Weboberfläche fürs Handy, die auf denselben Bestand
  schreibt. Ob dafür ein kleiner Server nötig wird, entscheidet sich dort.

---

## 12. Arbeitsweise ab hier

1. Repository anlegen, `kontor.html` als `referenz/prototyp.html` ablegen
2. Diese Datei als `SPEC.md` in die Wurzel, `CLAUDE.md` daneben
3. P1 beginnen: Tauri-Projekt, Datenbankschema, Rechenkerne mit Tests portieren
4. Jede Phase endet mit einer lauffähigen App, nicht mit einem halben Zustand
5. Fachliche Regeln aus Abschnitt 5 bekommen Tests, bevor die Oberfläche gebaut wird
