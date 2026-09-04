# Kontor — Handbuch

Dieses Handbuch richtet sich an die Personen, die mit Kontor täglich arbeiten:
Inhaberin oder Inhaber, Buchhalterin oder Buchhalter, Mitarbeitende und den
Steuerberater. Es beschreibt die Bedienung, nicht die Technik dahinter — dafür
gibt es `SPEC.md`.

---

## 0. Wichtiger Hinweis

**Kontor ist keine GoBD-zertifizierte Software, kein Ersatz für eine
TSE-Kasse, keine Lohnabrechnung im rechtlichen Sinn und keine
Steuerberatung.** Kontor unterstützt bei der laufenden Erfassung und
Vorbereitung, ersetzt aber nicht die Kasse mit zertifizierter technischer
Sicherheitseinrichtung, die rechtssichere Lohnabrechnung oder die Prüfung
durch eine Steuerberatung. Dieser Hinweis erscheint auch am unteren Rand
jeder Ansicht in der App.

---

## 1. Erste Schritte

### 1.1 Installation

Unter Windows wird Kontor über eine Installationsdatei (`.exe`, NSIS)
eingerichtet. Beim ersten Start lässt sich die Installationssprache wählen
(Deutsch oder Englisch für den Installer selbst — die App-Sprache wird
unabhängig davon in Kontor selbst eingestellt).

### 1.2 Ersteinrichtung: erster Benutzer

Beim allerersten Start einer neuen Installation gibt es noch keinen
Benutzer. Kontor fragt nach:

- **Name** der Person, die den ersten Zugang bekommt
- **Passwort** (mindestens 8 Zeichen, zur Sicherheit zweimal eingeben)

Diese erste Person wird automatisch **Inhaber** — die Rolle mit allen
Rechten (siehe Abschnitt 3). Weitere Benutzer legt sie später selbst unter
*Benutzer* an.

Dieses Passwort verschlüsselt zugleich die Datenbank (SQLCipher) — es ist
also gleichzeitig das **Datenbank-Passwort** aus Abschnitt 1.4.

### 1.3 Der Erstinbetriebnahme-Assistent

Direkt nach der Ersteinrichtung fragt Kontor einmalig nach den Firmendaten:
Firmenname, Inhaber, Anschrift, Steuernummer, USt-ID, Telefon, E-Mail, Logo,
Kassenanfangsbestand, Kleinunternehmerstatus, Versteuerungsart (Ist oder
Soll) und der Zeitraum für die Umsatzsteuer-Voranmeldung. Diese Angaben
erscheinen später auf Auswertungen und Ausdrucken.

Wer es eilig hat, kann über **Später einrichten** direkt in die App
wechseln — die Angaben lassen sich jederzeit unter *Einstellungen*
nachtragen oder ändern.

### 1.4 Datenbank entsperren und Anmelden

Bei jedem weiteren Start erscheint zuerst der Bildschirm **Datenbank
entsperren**: Hier wird einmalig das Passwort des Inhabers eingegeben, mit
dem die Datenbank verschlüsselt ist (siehe Abschnitt 1.2). Erst danach
folgt die eigentliche Anmeldemaske: Name und Passwort des jeweiligen
Benutzers. Über **Abmelden** (unten links) kann tagsüber beliebig oft
zwischen Benutzern gewechselt werden, ohne die Datenbank erneut zu
entsperren oder die App zu schließen.

Ändert der Inhaber sein eigenes Passwort (siehe Abschnitt 3), wird die
Datenbank automatisch mit dem neuen Passwort neu verschlüsselt.

---

## 2. Mehrsprachigkeit

Kontor spricht Deutsch, Englisch und Arabisch. Arabisch wird automatisch von
rechts nach links dargestellt. Die Sprache lässt sich oben links jederzeit
umschalten — auch schon auf der Anmeldemaske.

---

## 3. Benutzer und Rollen

Unter *Benutzer* (nur für die Rolle Inhaber sichtbar) lassen sich Zugänge
anlegen, bearbeiten und deaktivieren. Es gibt vier Rollen:

| Recht | Inhaber | Buchhalter | Mitarbeiter | Steuerberater |
|---|---|---|---|---|
| Buchungen sehen und erfassen | ja | ja | nein | nur lesen |
| Auswertungen und Export | ja | ja | nein | nur lesen |
| Stammdaten und Konten | ja | ja | nein | nein |
| Mitarbeiter und Löhne | ja | nein | nein | nein |
| Eigene Stunden erfassen | ja | nein | ja | nein |
| Fremde Stunden sehen | ja | nein | nein | nein |
| Stunden freigeben | ja | nein | nein | nein |
| Firmen anlegen, Backup | ja | nein | nein | nein |

Ein Zugang wird nie gelöscht, sondern deaktiviert — so bleiben
Datenspuren (wer hat was erfasst) nachvollziehbar. Ein Mitarbeiterzugang
lässt sich mit dem passenden Mitarbeiter-Stammdatensatz verknüpfen: dann
sieht diese Person in der Zeiterfassung automatisch nur ihre eigenen
Stunden.

Passwörter werden mit Argon2 gehasht in der zentralen Datenbank
gespeichert — Kontor selbst kennt kein Passwort im Klartext.

---

## 4. Buchhaltung

### 4.1 Konten und Kostenstellen

Unter *Kontenrahmen* liegt der SKR03-Kontenrahmen als Startwert — jedes
Konto lässt sich bearbeiten, neue Konten anlegen, nicht mehr gebrauchte
inaktiv setzen (nie löschen, sobald darauf gebucht wurde). Kostenstellen
funktionieren genauso.

### 4.2 Buchungen erfassen

Unter *Buchungen* wird jeder Geschäftsvorfall erfasst: Datum, Text, Konto,
Gegenkonto, Betrag (immer **brutto**), Steuersatz, optional Kostenstelle und
angehängte Belege (Foto oder PDF). Netto und Steuer rechnet Kontor selbst.

Buchungen in bereits abgeschlossenen Monaten werden **storniert**, nicht
gelöscht — der ursprüngliche Vorgang bleibt sichtbar.

### 4.3 Kassenbuch

Das Kassenbuch zeigt alle Bewegungen auf dem Kassenkonto (bar) chronologisch
mit laufendem Bestand. **Wird der Bestand rechnerisch negativ, zeigt Kontor
das deutlich in Rot an** — das ist immer ein Zeichen für einen Fehler in den
Daten (siehe Abschnitt 4.5).

### 4.4 Gutscheine

Ausgabe und Einlösung von Gutscheinen werden getrennt erfasst. Wichtig:

- **Bei Ausgabe** entsteht **kein Umsatz**, sondern eine Verbindlichkeit
  (Konto 1700) — der Kunde hat ja noch nichts gekauft, nur bezahlt.
- **Erst beim Einlösen** entsteht der eigentliche, steuerpflichtige Umsatz,
  mit dem Steuersatz der tatsächlich gekauften Ware.

Die Gutschein-Übersicht zeigt jederzeit die Summe aller noch offenen
Gutscheine — das ist Geld, das dem Laden gegenüber den Kunden noch
"geschuldet" wird.

### 4.5 Die drei Fallen

Diese drei Punkte machen jede Auswertung wertlos, wenn sie falsch gebucht
werden:

1. **Geldtransit.** Kartengutschriften (SumUp, Zettle, Nexi & Co.) und
   Bareinzahlungen auf das Bankkonto sind **kein Umsatz** — der Umsatz
   wurde schon in der Kasse erfasst. Diese Bewegungen gehören auf Konto
   **1360 Geldtransit**. Bucht man sie versehentlich als Erlös, wird der
   Umsatz doppelt gezählt.
2. **Gutscheine.** Siehe 4.4 — Umsatz entsteht erst beim Einlösen, nicht
   bei der Ausgabe.
3. **Kassenbestand.** Der Kassenbestand darf nie negativ werden. Zeigt
   Kontor eine rote Warnung, stimmt etwas in den erfassten Daten nicht
   (z. B. eine vergessene Bareinzahlung oder eine falsche Zahlart) und
   sollte vor dem nächsten Monatsabschluss geklärt werden.

---

## 5. Auswertungen

Unter *Auswertungen* stehen:

- **BWA** — betriebswirtschaftliche Auswertung mit vier Vergleichsspalten
  (laufender Monat, Vormonat, Vorjahresmonat, Jahr kumuliert)
- **EÜR** — Einnahmen-Überschuss-Rechnung nach amtlichem Aufbau
- **Umsatzsteuer** — Voranmeldung mit frei wählbarem Zeitraum
  (monatlich/quartalsweise/jährlich) und den amtlichen Kennzahlen
- **Journal & Konten** — chronologisches Journal, Summen- und Saldenliste,
  einzelne Kontenblätter
- **Diagramme** — Umsatzverlauf, Kostenverteilung, Ergebnis pro Monat,
  Kasse und Bank, Personalkosten, Vorjahresvergleich, Umsatzsteuer

Bei aktivem Kleinunternehmerstatus (§ 19 UStG, unter *Einstellungen*
einstellbar) rechnet die gesamte App ohne Umsatzsteuer.

---

## 6. Import und Export

### 6.1 Import

Unter *Import und Export* lassen sich Excel-, CSV-, JSON- oder
Markdown-Dateien einlesen (Bank- oder Kassenexporte). Der Ablauf:

1. Datei auswählen — Kontor erkennt Format und Spalten automatisch
2. Spalten den Zielfeldern zuordnen (Datum, Betrag, Text, Steuersatz, …)
3. Zuordnungsregeln nach Stichwörtern im Buchungstext anwenden (z. B.
   "Großhandel" → Wareneinkauf) — eigene Regeln lassen sich anlegen
4. Jede Zeile einzeln prüfen, Dubletten werden automatisch erkannt und
   abgewählt
5. Übernehmen — der komplette Lauf wird protokolliert und lässt sich bei
   Bedarf als Ganzes rückgängig machen

### 6.2 Belegablage und Monatspaket

Unter *Belegablage* werden Kassenberichte, Rechnungen und sonstige Belege
laufend abgelegt (Foto oder PDF, mit Datum und Typ). Am Monatsende lässt
sich daraus ein **Monatspaket** als ZIP-Datei herunterladen — praktisch für
die Übergabe an den Steuerberater.

### 6.3 Excel-, PDF- und DATEV-Export der Auswertungen

Unter *Auswertungen → Journal & Konten* stehen drei weitere Exportknöpfe,
jeweils für den oben gewählten Zeitraum:

- **Als Excel exportieren** — eine Arbeitsmappe mit sieben Blättern:
  Journal, Summen und Salden, Kontenblätter, BWA, EÜR, USt-Voranmeldung und
  Stundenliste (nur freigegebene Einträge).
- **Als PDF exportieren** — dieselben sechs Auswertungen (ohne
  Stundenliste, die hat ihren eigenen Stundenzettel-PDF, siehe 7.4) als
  A4-PDF, mit Logo und Firmendaten in der Kopfzeile, Querformat bei breiten
  Tabellen, Seitenzahl und Erstellungsdatum in der Fußzeile.
- **DATEV-Export** — ein EXTF-Buchungsstapel für die Kanzleisoftware des
  Steuerberaters. Beim ersten Mal nach Beraternummer und Mandantennummer
  gefragt. **Vor dem ersten produktiven Einsatz unbedingt zusammen mit dem
  Steuerberater testweise einspielen** — das genaue Format hängt von der
  jeweiligen DATEV-Version ab und lässt sich hier nicht gegen eine echte
  DATEV-Installation prüfen.

Unter *Import und Export* steht zusätzlich weiterhin ein einfacher
CSV-Export der Buchungen zur Verfügung.

---

## 7. Personal

*(Nur sichtbar für Inhaber, bzw. eingeschränkt für Mitarbeiter mit
verknüpftem Zugang — siehe Abschnitt 3.)*

### 7.1 Mitarbeiterstammdaten

Unter *Mitarbeiter*: Name, Personalnummer, Beschäftigungsart (Minijob,
Teilzeit, Vollzeit, Aushilfe), Ein- und Austritt, Stundenlohn,
Wochenstunden, Urlaubstage. Ein Mitarbeiter lässt sich mit einem
Benutzerzugang verknüpfen (siehe Abschnitt 3).

### 7.2 Zeiterfassung

Unter *Stundenerfassung* trägt jede Mitarbeiterin und jeder Mitarbeiter die
eigenen Stunden ein — entweder als Kommen/Gehen/Pause oder als reine
Stundenzahl. Ab 10 Stunden an einem Tag warnt Kontor (ohne automatisch
umzuverteilen). Urlaub, Krankheit und Feiertag werden als eigene Art
erfasst.

Ein Eintrag wird **eingereicht** und muss vom Inhaber **freigegeben**
werden, bevor er in Bruttolohn-Berechnung und Auswertungen einfließt. Der
Inhaber sieht dabei alle Mitarbeitenden, jede angemeldete Person sonst nur
sich selbst.

### 7.3 Zuschläge und Feiertage

Zuschlagsregeln (Nacht, Sonntag, Feiertag) sind unter *Stundenerfassung*
frei anlegbar; Startwerte sind Nacht 25 %, Sonntag 50 %, Feiertag 125 %.
Feiertage kommen aus dem hinterlegten Bundesland (Startwert
Nordrhein-Westfalen).

### 7.4 Stundenzettel als PDF

Unter *Stundenerfassung* stehen zwei Exportknöpfe:

- **Stundenzettel** — alle Einträge der gerade angezeigten Person im
  gewählten Monat (unabhängig vom Freigabestatus), mit Summe und
  Unterschriftsfeldern für Mitarbeiter und Inhaber. Für jede angemeldete
  Person mit eigenem Zugang sichtbar, nicht nur für den Inhaber.
- **Sammelliste** — nur für den Inhaber sichtbar: eine Zeile je
  Mitarbeiter mit den im Monat freigegebenen Stunden und Bruttolohn, dazu
  eine eigene Unterschriftsspalte je Person und eine
  Freigabe-Unterschriftszeile am Ende.

---

## 8. Einstellungen

Unter *Einstellungen* lassen sich alle Firmendaten aus dem
Erstinbetriebnahme-Assistenten jederzeit ändern: Firmenname, Inhaber,
Anschrift, Steuernummer, USt-ID, Telefon, E-Mail, Logo, Kassenanfangsbestand,
Kleinunternehmerstatus, Versteuerungsart und Voranmeldungszeitraum. Hier
steht auch, welche Kontor-Version installiert ist, mit einem Knopf **Nach
Updates suchen** (siehe Abschnitt 10).

---

## 9. Sicherung

Unter *Sicherung* (nur für die Rolle Inhaber) lässt sich Kontor absichern:

### 9.1 Lokale verschlüsselte Sicherung

Ein Ordner wird ausgewählt (lokal oder ein Ordner, den z. B. OneDrive,
Google Drive oder Dropbox ohnehin auf dem Rechner synchronisiert), dazu ein
Intervall (täglich, wöchentlich, monatlich — Startwert wöchentlich). Jede
Sicherung wird mit einem selbst vergebenen Passwort verschlüsselt
(AES-256-GCM). **Dieses Passwort speichert Kontor nirgends** — ohne das
Passwort lässt sich die Sicherung nicht mehr öffnen, also gut aufbewahren.
Die letzten zehn Sicherungen bleiben erhalten, ältere werden automatisch
gelöscht.

Über **Wiederherstellen** zeigt Kontor vor dem eigentlichen Einspielen
eine Vorschau (welche Firmen enthalten sind, wann die Sicherung erstellt
wurde), damit nichts versehentlich überschrieben wird.

### 9.2 Google Drive

Zusätzlich lässt sich jede lokale Sicherung automatisch zu Google Drive
hochladen. Dafür wird einmalig eine **eigene Google-Cloud-Client-ID**
benötigt (Kontor bringt aus rechtlichen Gründen keine eigene mit) — das
Vorgehen dafür steht in Abschnitt 11. Kontor bekommt dabei nur Zugriff auf
Dateien, die es selbst in Drive anlegt (Berechtigung `drive.file`), nicht
auf den übrigen Drive-Inhalt.

---

## 10. Updates

Kontor kann sich selbst aktualisieren. Unter *Einstellungen* → **Nach
Updates suchen** prüft die App, ob eine neuere Version verfügbar ist, lädt
sie bei Bestätigung herunter, installiert sie und startet Kontor neu.
Voraussetzung ist eine Internetverbindung; ohne verfügbaren Update-Server
meldet die Prüfung entsprechend, dass kein Update gefunden wurde.

---

## 11. Anhang: eigene Google-Cloud-Client-ID einrichten

Für die Google-Drive-Sicherung (Abschnitt 9.2) wird einmalig ein eigenes
Google-Cloud-Projekt benötigt:

1. Auf [console.cloud.google.com](https://console.cloud.google.com) ein
   neues Projekt anlegen.
2. Unter *APIs & Dienste → Bibliothek* die **Google Drive API** aktivieren.
3. Unter *APIs & Dienste → OAuth-Zustimmungsbildschirm* die App als
   "extern" mit dem Umfang `drive.file` einrichten (für den privaten
   Gebrauch reicht der Testmodus mit der eigenen Google-Adresse als
   Testnutzer).
4. Unter *APIs & Dienste → Anmeldedaten* eine neue OAuth-Client-ID vom Typ
   **Desktop-App** anlegen.
5. Die angezeigte Client-ID in Kontor unter *Sicherung* eintragen und auf
   **Mit Google Drive verbinden** klicken — der Standardbrowser öffnet sich
   zur Anmeldung bei Google.

---

## 12. Häufige Fragen

**Der Kassenbestand ist rot / negativ — was tun?**
Das bedeutet: irgendwo fehlt eine Buchung oder eine Zahlart wurde falsch
gewählt (z. B. eine Kartenzahlung versehentlich als Bar gebucht). Am besten
den betreffenden Tag im Kassenbuch rückwärts durchgehen.

**Ich habe eine falsche Buchung erfasst — löschen?**
In einem noch offenen Monat: ja, direkt löschen oder korrigieren. In einem
bereits abgeschlossenen Monat: stornieren, nicht löschen — der
ursprüngliche Vorgang muss nachvollziehbar bleiben.

**Ein Mitarbeiter sieht seine Stunden nicht.**
Vermutlich ist der Benutzerzugang noch nicht mit dem Mitarbeiter-
Stammdatensatz verknüpft — das lässt sich unter *Mitarbeiter* nachholen.

**Ich habe mein Sicherungspasswort vergessen.**
Dann lässt sich diese eine Sicherungsdatei nicht mehr öffnen — Kontor
speichert das Passwort bewusst nirgends. Ältere Sicherungen mit einem noch
bekannten Passwort bleiben davon unberührt.

**Wo sehe ich, welche Kontor-Version ich habe?**
Unter *Einstellungen*, im Abschnitt "Programmversion".
