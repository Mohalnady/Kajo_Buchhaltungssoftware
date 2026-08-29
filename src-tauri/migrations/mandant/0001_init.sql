-- Pro-Mandant-Datenbank unter $APPDATA/kontor/mandanten/<id>.db.
-- Siehe SPEC.md Abschnitt 4 (Datenmodell) und Abschnitt 5 (Fachliche Regeln).
--
-- Konten, Kostenstellen, Steuersätze, Importregeln, Mitarbeiter usw. sind über
-- ein "aktiv"-Flag deaktivierbar statt löschbar, sobald darauf gebucht wurde
-- (siehe CLAUDE.md, Regel 3: "Löschen nur wo unschädlich").

PRAGMA foreign_keys = ON;

-- Stammdaten der Firma. Genau eine Zeile je Mandanten-Datenbank.
CREATE TABLE mandant (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  firma                  TEXT NOT NULL DEFAULT '',
  inhaber                TEXT NOT NULL DEFAULT '',
  strasse                TEXT NOT NULL DEFAULT '',
  plz                    TEXT NOT NULL DEFAULT '',
  ort                    TEXT NOT NULL DEFAULT '',
  land                   TEXT NOT NULL DEFAULT 'DE',
  stnr                   TEXT NOT NULL DEFAULT '',
  ustid                  TEXT NOT NULL DEFAULT '',
  tel                    TEXT NOT NULL DEFAULT '',
  mail                   TEXT NOT NULL DEFAULT '',
  logo_pfad              TEXT,
  gewinnart              TEXT NOT NULL DEFAULT 'euer' CHECK (gewinnart IN ('euer', 'bilanz')),
  kleinunternehmer       INTEGER NOT NULL DEFAULT 0,
  versteuerung           TEXT NOT NULL DEFAULT 'ist' CHECK (versteuerung IN ('ist', 'soll')),
  voranmeldung           TEXT NOT NULL DEFAULT 'monatlich' CHECK (voranmeldung IN ('monatlich', 'quartalsweise', 'jaehrlich')),
  wirtschaftsjahr_beginn TEXT NOT NULL DEFAULT '01-01',
  kassen_anfangsbestand  REAL NOT NULL DEFAULT 0,
  waehrung               TEXT NOT NULL DEFAULT 'EUR',
  angelegt_am            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE konto (
  nr           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  typ          TEXT NOT NULL CHECK (typ IN ('erloes', 'aufwand', 'finanz', 'privat', 'bestand')),
  ust_satz     REAL NOT NULL DEFAULT 0,
  bwa_gruppe   TEXT NOT NULL DEFAULT '',
  euer_zeile   INTEGER,
  datev_konto  TEXT,
  aktiv        INTEGER NOT NULL DEFAULT 1,
  sortierung   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE kostenstelle (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  notiz  TEXT NOT NULL DEFAULT '',
  aktiv  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE importlauf (
  id           TEXT PRIMARY KEY,
  datei        TEXT NOT NULL,
  format       TEXT NOT NULL,
  zeilen       INTEGER NOT NULL DEFAULT 0,
  uebernommen  INTEGER NOT NULL DEFAULT 0,
  datum        TEXT NOT NULL DEFAULT (datetime('now')),
  benutzer_id  TEXT
);

CREATE TABLE buchung (
  id              TEXT PRIMARY KEY,
  datum           TEXT NOT NULL,        -- JJJJ-MM-TT, Rechnungs-/Leistungsdatum (Soll)
  wertstellung    TEXT,                 -- JJJJ-MM-TT, Zahlungsdatum (Ist)
  belegnr         TEXT NOT NULL DEFAULT '',
  text            TEXT NOT NULL,
  konto           TEXT NOT NULL REFERENCES konto (nr),
  gegenkonto      TEXT NOT NULL REFERENCES konto (nr),
  betrag_brutto   REAL NOT NULL,
  ust_satz        REAL NOT NULL DEFAULT 0,
  kostenstelle_id TEXT REFERENCES kostenstelle (id),
  quelle          TEXT NOT NULL DEFAULT 'manuell'
                    CHECK (quelle IN ('manuell', 'import_bank', 'import_kasse', 'import_excel', 'dauerbuchung')),
  import_id       TEXT REFERENCES importlauf (id),
  storniert       INTEGER NOT NULL DEFAULT 0,
  angelegt_von    TEXT,
  angelegt_am     TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am    TEXT
);
CREATE INDEX idx_buchung_datum ON buchung (datum);
CREATE INDEX idx_buchung_konto ON buchung (konto);
CREATE INDEX idx_buchung_gegenkonto ON buchung (gegenkonto);

-- Nur bei Splitbuchungen befüllt, sonst leer (siehe Abschnitt 4).
CREATE TABLE buchung_split (
  id              TEXT PRIMARY KEY,
  buchung_id      TEXT NOT NULL REFERENCES buchung (id) ON DELETE CASCADE,
  konto           TEXT NOT NULL REFERENCES konto (nr),
  betrag_brutto   REAL NOT NULL,
  ust_satz        REAL NOT NULL DEFAULT 0,
  kostenstelle_id TEXT REFERENCES kostenstelle (id)
);
CREATE INDEX idx_buchung_split_buchung ON buchung_split (buchung_id);

CREATE TABLE beleg (
  id               TEXT PRIMARY KEY,
  buchung_id       TEXT NOT NULL REFERENCES buchung (id) ON DELETE CASCADE,
  dateiname        TEXT NOT NULL,
  pfad             TEXT NOT NULL,
  mime             TEXT,
  groesse          INTEGER,
  hinzugefuegt_am  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_beleg_buchung ON beleg (buchung_id);

CREATE TABLE dauerbuchung (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  text            TEXT NOT NULL,
  konto           TEXT NOT NULL REFERENCES konto (nr),
  gegenkonto      TEXT NOT NULL REFERENCES konto (nr),
  betrag_brutto   REAL NOT NULL,
  ust_satz        REAL NOT NULL DEFAULT 0,
  intervall       TEXT NOT NULL CHECK (intervall IN ('monatlich', 'quartal', 'jaehrlich')),
  naechste_faellig TEXT NOT NULL,
  aktiv           INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE importregel (
  id          TEXT PRIMARY KEY,
  stichwoerter TEXT NOT NULL,
  konto       TEXT NOT NULL REFERENCES konto (nr),
  gegenkonto  TEXT REFERENCES konto (nr),
  prioritaet  INTEGER NOT NULL DEFAULT 0,
  aktiv       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE gutschein (
  id                 TEXT PRIMARY KEY,
  nummer             TEXT NOT NULL UNIQUE,
  ausgabe_datum      TEXT NOT NULL,
  betrag             REAL NOT NULL,
  eingeloest_betrag  REAL NOT NULL DEFAULT 0,
  eingeloest_datum   TEXT,
  status             TEXT NOT NULL DEFAULT 'offen'
                        CHECK (status IN ('offen', 'teilweise_eingeloest', 'eingeloest'))
);

-- benutzer_id verweist lose auf benutzer.id in der zentralen kontor.db;
-- SQLite kann diese Fremdschlüsselbeziehung nicht über Dateigrenzen prüfen.
CREATE TABLE mitarbeiter (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  personalnr          TEXT,
  rolle               TEXT NOT NULL DEFAULT '',
  beschaeftigungsart  TEXT NOT NULL CHECK (beschaeftigungsart IN ('minijob', 'teilzeit', 'vollzeit', 'aushilfe')),
  eintritt            TEXT NOT NULL,
  austritt            TEXT,
  stundenlohn         REAL NOT NULL DEFAULT 0,
  wochenstunden       REAL NOT NULL DEFAULT 0,
  urlaubstage_jahr    INTEGER NOT NULL DEFAULT 0,
  aktiv               INTEGER NOT NULL DEFAULT 1,
  benutzer_id         TEXT
);

CREATE TABLE zeiteintrag (
  id               TEXT PRIMARY KEY,
  mitarbeiter_id   TEXT NOT NULL REFERENCES mitarbeiter (id),
  datum            TEXT NOT NULL,
  von              TEXT,
  bis              TEXT,
  pause_min        INTEGER NOT NULL DEFAULT 0,
  stunden          REAL NOT NULL DEFAULT 0,
  art              TEXT NOT NULL DEFAULT 'arbeit' CHECK (art IN ('arbeit', 'urlaub', 'krank', 'feiertag', 'frei')),
  notiz            TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'entwurf'
                      CHECK (status IN ('entwurf', 'eingereicht', 'freigegeben', 'abgelehnt')),
  freigegeben_von  TEXT,
  freigegeben_am   TEXT,
  erfasst_von      TEXT
);
CREATE INDEX idx_zeiteintrag_mitarbeiter ON zeiteintrag (mitarbeiter_id);
CREATE INDEX idx_zeiteintrag_datum ON zeiteintrag (datum);

CREATE TABLE zuschlagsregel (
  id          TEXT PRIMARY KEY,
  art         TEXT NOT NULL CHECK (art IN ('nacht', 'sonntag', 'feiertag')),
  von_uhrzeit TEXT,
  bis_uhrzeit TEXT,
  wochentag   INTEGER,
  prozent     REAL NOT NULL,
  aktiv       INTEGER NOT NULL DEFAULT 1
);

-- Mandanten-lokale Einstellungen (z. B. Anzeigeoptionen), getrennt von den
-- globalen Einstellungen der zentralen kontor.db.
CREATE TABLE einstellung (
  schluessel TEXT PRIMARY KEY,
  wert       TEXT
);
