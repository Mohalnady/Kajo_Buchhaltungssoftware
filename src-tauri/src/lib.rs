use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rand_core::OsRng;

mod db;
use db::{db_auswaehlen, db_ausfuehren, db_mandant_anlegen, db_oeffnen, db_umschluesseln, db_zentral_anlegen, DbRegistry};

mod google_drive;
use google_drive::{google_drive_autorisieren, google_drive_datei_hochladen, google_drive_trennen, google_drive_verbunden};

// Passwort-Hashing für die Benutzerverwaltung (SPEC.md Abschnitt 8: "Passwörter
// mit Argon2 oder bcrypt"). Läuft bewusst in Rust statt im Frontend, damit die
// eigentliche Kryptografie nicht von einer JS/WASM-Bibliothek im Webview abhängt.
#[derive(serde::Serialize)]
struct PasswortHash {
  hash: String,
  salt: String,
}

#[tauri::command]
fn passwort_hashen(passwort: String) -> Result<PasswortHash, String> {
  let salt = SaltString::generate(&mut OsRng);
  let hash = Argon2::default()
    .hash_password(passwort.as_bytes(), &salt)
    .map_err(|e| e.to_string())?;
  Ok(PasswortHash {
    hash: hash.to_string(),
    salt: salt.to_string(),
  })
}

#[tauri::command]
fn passwort_pruefen(passwort: String, hash: String) -> Result<bool, String> {
  let geparst = PasswordHash::new(&hash).map_err(|e| e.to_string())?;
  Ok(Argon2::default().verify_password(passwort.as_bytes(), &geparst).is_ok())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn hash_und_pruefung_runden_korrekt() {
    let ergebnis = passwort_hashen("sehr-geheim".into()).expect("hashen darf nicht scheitern");
    assert!(passwort_pruefen("sehr-geheim".into(), ergebnis.hash.clone()).unwrap());
    assert!(!passwort_pruefen("falsches-passwort".into(), ergebnis.hash).unwrap());
  }

  #[test]
  fn zwei_hashes_desselben_passworts_unterscheiden_sich() {
    let a = passwort_hashen("gleiches-passwort".into()).unwrap();
    let b = passwort_hashen("gleiches-passwort".into()).unwrap();
    assert_ne!(a.hash, b.hash, "unterschiedliches Salt muss unterschiedliche Hashes ergeben");
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(DbRegistry::default())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      db_oeffnen,
      db_zentral_anlegen,
      db_mandant_anlegen,
      db_auswaehlen,
      db_ausfuehren,
      db_umschluesseln,
      passwort_hashen,
      passwort_pruefen,
      google_drive_autorisieren,
      google_drive_verbunden,
      google_drive_trennen,
      google_drive_datei_hochladen
    ])
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
