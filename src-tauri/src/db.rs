// Eigene, verschlüsselte Datenbankanbindung (SQLCipher) als Ersatz für
// tauri-plugin-sql. SPEC.md Abschnitt 8: "Die SQLite-Datei wird über
// SQLCipher verschlüsselt, Schlüssel aus dem Passwort des Inhabers."
//
// tauri-plugin-sql öffnet Verbindungen über `sqlx::Pool::connect(url)` ohne
// Möglichkeit, vor der ersten Abfrage ein `PRAGMA key` zu setzen — SQLCipher
// verlangt das aber zwingend als allerersten Schritt auf jeder Verbindung.
// sqlx selbst unterstützt SQLCipher aber sehr wohl über den Options-Builder
// (`SqliteConnectOptions::pragma`), inklusive vorregistrierter
// "cipher_*"-Pragmas in der richtigen Reihenfolge. Deshalb hier ein eigener,
// schlanker Ersatz statt des Plugins — mit denselben Methodennamen/-formen
// wie `@tauri-apps/plugin-sql`, damit sich die bestehenden `.select()`/
// `.execute()`-Aufrufe im Frontend nicht ändern müssen (siehe
// src/db/verschluesselt.ts).
//
// Die eigentliche Logik ist bewusst als freie Funktionen geschrieben, die
// direkt mit einem `SqlitePool` arbeiten (statt mit Tauri-`State`), damit sie
// sich ohne eine vollständige gemockte Tauri-App testen lassen. Die
// `#[tauri::command]`-Funktionen sind nur dünne Adapter darüber.

use serde_json::{Map as JsonMap, Value as JsonValue};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions, SqliteValueRef};
use sqlx::{Column, Row, TypeInfo, ValueRef};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct DbRegistry(Mutex<HashMap<String, SqlitePool>>);

/// SQL-String-Literal-Escaping (Verdoppeln von `'`) — PRAGMA-Werte lassen
/// sich bei sqlx nicht als gebundene Parameter übergeben (siehe
/// `pragma_string()` in sqlx-sqlite), deshalb hier von Hand.
fn sql_quote(wert: &str) -> String {
  format!("'{}'", wert.replace('\'', "''"))
}

async fn pool_oeffnen(pfad: &str, schluessel: &str) -> Result<SqlitePool, String> {
  let options = SqliteConnectOptions::from_str(&format!("sqlite://{pfad}"))
    .map_err(|e| e.to_string())?
    .create_if_missing(true)
    .foreign_keys(true)
    .pragma("key", sql_quote(schluessel));

  let pool = SqlitePoolOptions::new()
    .max_connections(4)
    .connect_with(options)
    .await
    .map_err(|e| e.to_string())?;

  // Bei falschem Schlüssel (oder einer beschädigten Datei) scheitert jede
  // echte Abfrage auf eine bereits verschlüsselte Datenbank — das ist der
  // einzige verlässliche Weg, ein falsches Passwort zu erkennen.
  sqlx::query("SELECT count(*) FROM sqlite_master")
    .fetch_one(&pool)
    .await
    .map_err(|_| "Falsches Passwort oder beschädigte Datenbank.".to_string())?;

  Ok(pool)
}

/// Entfernt `-- Kommentar`-Zeilen (auch dort, wo sie direkt vor einer
/// Anweisung stehen, ohne eigenes Semikolon) und zerlegt danach nach `;`.
fn zerlege_schema(schema: &str) -> Vec<String> {
  let ohne_kommentare: String = schema
    .lines()
    .map(|zeile| if zeile.trim_start().starts_with("--") { "" } else { zeile })
    .collect::<Vec<_>>()
    .join("\n");

  ohne_kommentare
    .split(';')
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(str::to_string)
    .collect()
}

async fn schema_ausfuehren(pool: &SqlitePool, schema: &str) -> Result<(), String> {
  for anweisung in zerlege_schema(schema) {
    sqlx::query(&anweisung).execute(pool).await.map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn json_binden<'q>(
  mut query: sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>>,
  werte: &'q [JsonValue],
) -> sqlx::query::Query<'q, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'q>> {
  for wert in werte {
    query = match wert {
      JsonValue::Null => query.bind(None::<String>),
      JsonValue::String(s) => query.bind(s.as_str()),
      JsonValue::Number(n) => {
        if let Some(i) = n.as_i64() {
          query.bind(i)
        } else {
          query.bind(n.as_f64().unwrap_or_default())
        }
      }
      JsonValue::Bool(b) => query.bind(*b),
      andere => query.bind(andere.to_string()),
    };
  }
  query
}

fn spaltenwert_zu_json(row: &sqlx::sqlite::SqliteRow, index: usize) -> Result<JsonValue, String> {
  let roh: SqliteValueRef = row.try_get_raw(index).map_err(|e| e.to_string())?;
  if roh.is_null() {
    return Ok(JsonValue::Null);
  }
  Ok(match roh.type_info().name() {
    "TEXT" => row.try_get::<String, _>(index).map(JsonValue::String).unwrap_or(JsonValue::Null),
    "INTEGER" | "NUMERIC" => row
      .try_get::<i64, _>(index)
      .map(|v| JsonValue::Number(v.into()))
      .unwrap_or(JsonValue::Null),
    "REAL" => row
      .try_get::<f64, _>(index)
      .ok()
      .and_then(serde_json::Number::from_f64)
      .map(JsonValue::Number)
      .unwrap_or(JsonValue::Null),
    "BOOLEAN" => row.try_get::<bool, _>(index).map(JsonValue::Bool).unwrap_or(JsonValue::Null),
    "BLOB" => row
      .try_get::<Vec<u8>, _>(index)
      .map(|v| JsonValue::Array(v.into_iter().map(|b| JsonValue::Number(b.into())).collect()))
      .unwrap_or(JsonValue::Null),
    _ => JsonValue::Null,
  })
}

async fn auswaehlen_intern(pool: &SqlitePool, sql: &str, werte: &[JsonValue]) -> Result<Vec<JsonMap<String, JsonValue>>, String> {
  let query = json_binden(sqlx::query(sql), werte);
  let zeilen = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

  let mut ergebnis = Vec::with_capacity(zeilen.len());
  for zeile in &zeilen {
    let mut objekt = JsonMap::new();
    for (i, spalte) in zeile.columns().iter().enumerate() {
      objekt.insert(spalte.name().to_string(), spaltenwert_zu_json(zeile, i)?);
    }
    ergebnis.push(objekt);
  }
  Ok(ergebnis)
}

pub struct AusfuehrenErgebnisIntern {
  pub rows_affected: u64,
  pub last_insert_id: i64,
}

async fn ausfuehren_intern(pool: &SqlitePool, sql: &str, werte: &[JsonValue]) -> Result<AusfuehrenErgebnisIntern, String> {
  let query = json_binden(sqlx::query(sql), werte);
  let ergebnis = query.execute(pool).await.map_err(|e| e.to_string())?;
  Ok(AusfuehrenErgebnisIntern {
    rows_affected: ergebnis.rows_affected(),
    last_insert_id: ergebnis.last_insert_rowid(),
  })
}

/// Verschlüsselt die Datenbank mit einem neuen Schlüssel neu und liefert
/// einen frischen Pool dafür zurück. `PRAGMA rekey` wirkt nur auf die eine
/// Verbindung, auf der es ausgeführt wird — andere Verbindungen desselben
/// Pools behalten den alten Schlüssel in ihrem SQLCipher-Kontext und würden
/// bei der nächsten Abfrage mit "file is not a database" scheitern. Deshalb
/// wird der gesamte alte Pool geschlossen und durch einen neu mit dem
/// neuen Schlüssel geöffneten ersetzt.
async fn umschluesseln_intern(pool: &SqlitePool, pfad: &str, neuer_schluessel: &str) -> Result<SqlitePool, String> {
  sqlx::query(&format!("PRAGMA rekey = {}", sql_quote(neuer_schluessel)))
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
  pool.close().await;
  pool_oeffnen(pfad, neuer_schluessel).await
}

// ---------- Tauri-Commands (dünne Adapter über die Registry) ----------

fn pool_aus_registry(registry: &State<'_, DbRegistry>, pfad: &str) -> Result<SqlitePool, String> {
  registry
    .0
    .lock()
    .map_err(|e| e.to_string())?
    .get(pfad)
    .cloned()
    .ok_or_else(|| format!("Datenbank {pfad} ist nicht geöffnet."))
}

/// Öffnet eine bereits bestehende, verschlüsselte Datenbank (oder eine neue
/// leere Datei, die beim ersten Öffnen mit diesem Schlüssel verschlüsselt
/// wird — für ein vollständiges Schema siehe `db_zentral_anlegen`/
/// `db_mandant_anlegen`).
#[tauri::command]
pub async fn db_oeffnen(registry: State<'_, DbRegistry>, pfad: String, schluessel: String) -> Result<(), String> {
  if registry.0.lock().map_err(|e| e.to_string())?.contains_key(&pfad) {
    // Eine bereits offene Verbindung ersetzt keine Passwortprüfung: Die
    // Registry lebt für die gesamte Prozesslaufzeit, ein Neuladen des
    // Webviews setzt aber den JS-seitigen Sitzungsschlüssel zurück und
    // zeigt erneut "Datenbank entsperren" — ohne diese Prüfung würde dann
    // jedes beliebige Passwort akzeptiert. Eine kurzlebige Testverbindung
    // mit dem angegebenen Schlüssel deckt ein falsches Passwort auf, ohne
    // die schon offene Verbindung anzufassen.
    pool_oeffnen(&pfad, &schluessel).await?.close().await;
    return Ok(());
  }
  let pool = pool_oeffnen(&pfad, &schluessel).await?;
  registry.0.lock().map_err(|e| e.to_string())?.insert(pfad, pool);
  Ok(())
}

/// Legt die zentrale Datenbank (Mandantenregister, Benutzer, Einstellungen)
/// mit dem übergebenen Schlüssel neu an und führt das feste Schema aus.
#[tauri::command]
pub async fn db_zentral_anlegen(registry: State<'_, DbRegistry>, pfad: String, schluessel: String) -> Result<(), String> {
  let pool = pool_oeffnen(&pfad, &schluessel).await?;
  schema_ausfuehren(&pool, include_str!("../migrations/zentral/0001_init.sql")).await?;
  registry.0.lock().map_err(|e| e.to_string())?.insert(pfad, pool);
  Ok(())
}

/// Legt eine neue Mandanten-Datenbank mit demselben Schlüssel an und führt
/// das Mandanten-Schema aus (Kontenrahmen usw. befüllt die Oberfläche
/// anschließend selbst, siehe db/mandant.ts).
#[tauri::command]
pub async fn db_mandant_anlegen(registry: State<'_, DbRegistry>, pfad: String, schluessel: String) -> Result<(), String> {
  let pool = pool_oeffnen(&pfad, &schluessel).await?;
  schema_ausfuehren(&pool, include_str!("../migrations/mandant/0001_init.sql")).await?;
  registry.0.lock().map_err(|e| e.to_string())?.insert(pfad, pool);
  Ok(())
}

#[tauri::command]
pub async fn db_auswaehlen(
  registry: State<'_, DbRegistry>,
  pfad: String,
  sql: String,
  werte: Vec<JsonValue>,
) -> Result<Vec<JsonMap<String, JsonValue>>, String> {
  let pool = pool_aus_registry(&registry, &pfad)?;
  auswaehlen_intern(&pool, &sql, &werte).await
}

#[derive(serde::Serialize)]
pub struct AusfuehrenErgebnis {
  #[serde(rename = "rowsAffected")]
  rows_affected: u64,
  #[serde(rename = "lastInsertId")]
  last_insert_id: i64,
}

#[tauri::command]
pub async fn db_ausfuehren(
  registry: State<'_, DbRegistry>,
  pfad: String,
  sql: String,
  werte: Vec<JsonValue>,
) -> Result<AusfuehrenErgebnis, String> {
  let pool = pool_aus_registry(&registry, &pfad)?;
  let ergebnis = ausfuehren_intern(&pool, &sql, &werte).await?;
  Ok(AusfuehrenErgebnis {
    rows_affected: ergebnis.rows_affected,
    last_insert_id: ergebnis.last_insert_id,
  })
}

/// Verschlüsselt eine bereits geöffnete Datenbank mit einem neuen Schlüssel
/// neu (SQLCipher `PRAGMA rekey`) — für die Passwortänderung des Inhabers,
/// dessen Passwort laut SPEC.md den Datenbankschlüssel bildet.
#[tauri::command]
pub async fn db_umschluesseln(registry: State<'_, DbRegistry>, pfad: String, neuer_schluessel: String) -> Result<(), String> {
  let alter_pool = pool_aus_registry(&registry, &pfad)?;
  let neuer_pool = umschluesseln_intern(&alter_pool, &pfad, &neuer_schluessel).await?;
  registry.0.lock().map_err(|e| e.to_string())?.insert(pfad, neuer_pool);
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn tempfile_pfad() -> String {
    let mut pfad = std::env::temp_dir();
    let eindeutig = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    pfad.push(format!("kontor-test-{eindeutig}.db"));
    pfad.to_string_lossy().to_string()
  }

  #[test]
  fn sql_quote_verdoppelt_apostrophe() {
    assert_eq!(sql_quote("o'brien"), "'o''brien'");
    assert_eq!(sql_quote("einfach"), "'einfach'");
  }

  #[tokio::test]
  async fn anlegen_schreiben_lesen_und_falsches_passwort() {
    let datei = tempfile_pfad();

    let pool = pool_oeffnen(&datei, "geheim").await.expect("anlegen darf nicht scheitern");
    schema_ausfuehren(&pool, include_str!("../migrations/zentral/0001_init.sql"))
      .await
      .expect("schema darf nicht scheitern");

    let eingefuegt = ausfuehren_intern(
      &pool,
      "INSERT INTO einstellung (schluessel, wert) VALUES ($1, $2)",
      &[JsonValue::String("test".into()), JsonValue::String("wert".into())],
    )
    .await
    .expect("insert darf nicht scheitern");
    assert_eq!(eingefuegt.rows_affected, 1);

    let zeilen = auswaehlen_intern(&pool, "SELECT wert FROM einstellung WHERE schluessel = $1", &[JsonValue::String("test".into())])
      .await
      .expect("select darf nicht scheitern");
    assert_eq!(zeilen[0]["wert"], JsonValue::String("wert".into()));
    pool.close().await;

    // Dieselbe Datei mit falschem Schlüssel öffnen muss scheitern.
    let fehler = pool_oeffnen(&datei, "falsch").await;
    assert!(fehler.is_err());

    std::fs::remove_file(&datei).ok();
  }

  #[tokio::test]
  async fn umschluesseln_erlaubt_zugriff_nur_noch_mit_neuem_schluessel() {
    let datei = tempfile_pfad();

    let pool = pool_oeffnen(&datei, "altes-passwort").await.expect("anlegen darf nicht scheitern");
    schema_ausfuehren(&pool, "CREATE TABLE t (x INTEGER);").await.expect("schema darf nicht scheitern");
    let neuer_pool = umschluesseln_intern(&pool, &datei, "neues-passwort").await.expect("umschluesseln darf nicht scheitern");
    neuer_pool.close().await;

    assert!(pool_oeffnen(&datei, "altes-passwort").await.is_err());
    let neu = pool_oeffnen(&datei, "neues-passwort").await;
    assert!(neu.is_ok());
    if let Ok(p) = neu {
      p.close().await;
    }

    std::fs::remove_file(&datei).ok();
  }

  /// Regressionstest: `PRAGMA rekey` wirkt nur auf die Verbindung, auf der es
  /// ausgeführt wird. Andere Verbindungen desselben Pools (hier durch
  /// mehrere gleichzeitige Abfragen erzwungen) hätten ohne den Ersatz des
  /// gesamten Pools weiterhin den alten Schlüssel im SQLCipher-Kontext und
  /// wären nach einer Passwortänderung des Inhabers gescheitert.
  #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
  async fn umschluesseln_aktualisiert_alle_pool_verbindungen() {
    let datei = tempfile_pfad();

    let pool = pool_oeffnen(&datei, "altes-passwort").await.expect("anlegen darf nicht scheitern");
    schema_ausfuehren(&pool, "CREATE TABLE t (x INTEGER);").await.expect("schema darf nicht scheitern");
    let neuer_pool = umschluesseln_intern(&pool, &datei, "neues-passwort").await.expect("umschluesseln darf nicht scheitern");

    let mut aufgaben = Vec::new();
    for _ in 0..8 {
      let p = neuer_pool.clone();
      aufgaben.push(tokio::spawn(async move { sqlx::query("SELECT count(*) FROM t").fetch_one(&p).await }));
    }
    for aufgabe in aufgaben {
      aufgabe.await.expect("task darf nicht paniken").expect("abfrage nach umschluesseln darf nicht scheitern");
    }

    neuer_pool.close().await;
    std::fs::remove_file(&datei).ok();
  }

  #[tokio::test]
  async fn zerlegtes_schema_mit_mehreren_anweisungen_wird_vollstaendig_ausgefuehrt() {
    let datei = tempfile_pfad();
    let pool = pool_oeffnen(&datei, "geheim").await.expect("anlegen darf nicht scheitern");
    // Ein Kommentar direkt vor einer Anweisung (ohne eigenes Semikolon dazwischen,
    // genau wie vor "CREATE TABLE einstellung" im echten Zentral-Schema) darf die
    // folgende Anweisung nicht mit verschlucken.
    schema_ausfuehren(
      &pool,
      "CREATE TABLE a (x INTEGER);\n-- Kommentar direkt vor der nächsten Tabelle\nCREATE TABLE b (y INTEGER);\n",
    )
    .await
    .expect("schema darf nicht scheitern");
    let tabellen = auswaehlen_intern(&pool, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name", &[])
      .await
      .expect("select darf nicht scheitern");
    let namen: Vec<String> = tabellen.iter().map(|z| z["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(namen, vec!["a", "b"]);
    pool.close().await;
    std::fs::remove_file(&datei).ok();
  }

  #[tokio::test]
  async fn echtes_zentral_schema_legt_alle_drei_tabellen_an() {
    let datei = tempfile_pfad();
    let pool = pool_oeffnen(&datei, "geheim").await.expect("anlegen darf nicht scheitern");
    schema_ausfuehren(&pool, include_str!("../migrations/zentral/0001_init.sql"))
      .await
      .expect("schema darf nicht scheitern");
    let tabellen = auswaehlen_intern(&pool, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name", &[])
      .await
      .expect("select darf nicht scheitern");
    let namen: Vec<String> = tabellen.iter().map(|z| z["name"].as_str().unwrap().to_string()).collect();
    assert_eq!(namen, vec!["benutzer", "einstellung", "mandant"]);
    pool.close().await;
    std::fs::remove_file(&datei).ok();
  }
}
