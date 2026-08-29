-- Zentrale Datei $APPDATA/kontor/kontor.db.
-- Hält die Mandantenliste (Verweis auf die jeweilige Mandanten-Datenbankdatei),
-- die Benutzer (gelten über alle Mandanten hinweg) und globale Einstellungen
-- wie Sprache und Backup-Konfiguration. Siehe SPEC.md Abschnitt 4 und 8.

CREATE TABLE mandant (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  db_pfad     TEXT NOT NULL,
  angelegt_am TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE benutzer (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  rolle          TEXT NOT NULL CHECK (rolle IN ('inhaber', 'buchhalter', 'mitarbeiter', 'steuerberater')),
  passwort_hash  TEXT NOT NULL,
  salt           TEXT NOT NULL,
  aktiv          INTEGER NOT NULL DEFAULT 1,
  letzter_login  TEXT
);

-- Schlüssel/Wert-Paare, z. B. sprache, backup_intervall, backup_ziel.
CREATE TABLE einstellung (
  schluessel TEXT PRIMARY KEY,
  wert       TEXT
);

INSERT INTO einstellung (schluessel, wert) VALUES ('sprache', 'de');
INSERT INTO einstellung (schluessel, wert) VALUES ('backup_intervall', 'woechentlich');
