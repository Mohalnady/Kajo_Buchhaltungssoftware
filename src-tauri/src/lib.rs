use tauri_plugin_sql::{Migration, MigrationKind};

// Migration der zentralen Datei kontor.db (Mandantenregister, Benutzer, globale
// Einstellungen). Siehe migrations/zentral/0001_init.sql und SPEC.md Abschnitt 4.
fn zentrale_migrationen() -> Vec<Migration> {
  vec![Migration {
    version: 1,
    description: "init",
    sql: include_str!("../migrations/zentral/0001_init.sql"),
    kind: MigrationKind::Up,
  }]
}

// Jeder Mandant bekommt eine eigene SQLite-Datei mit identischem Schema, aber
// unter einem zur Laufzeit erzeugten Pfad ($APPDATA/kontor/mandanten/<id>.db).
// Das feste Migrationsregister des SQL-Plugins ist an feste Verbindungsnamen
// gebunden und passt daher nicht auf dynamische Mandanten-IDs. Die Oberfläche
// führt dieses Schema deshalb selbst per `mandant_schema_sql` aus, sobald eine
// neue Mandanten-Datenbank angelegt wird.
#[tauri::command]
fn mandant_schema_sql() -> &'static str {
  include_str!("../migrations/mandant/0001_init.sql")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:kontor.db", zentrale_migrationen())
        .build(),
    )
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![mandant_schema_sql])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
