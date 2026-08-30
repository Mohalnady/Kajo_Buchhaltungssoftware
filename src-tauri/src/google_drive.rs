// Vorbereitung der Google-Drive-Anbindung für die Sicherung (SPEC.md Abschnitt 9):
// OAuth-Desktop-Ablauf mit PKCE und drive.file-Berechtigung, Refresh-Token im
// System-Schlüsselbund. Der Nutzer muss dafür ein eigenes Google-Cloud-Projekt
// mit einem OAuth-Client vom Typ "Desktop-App" anlegen und die Client-ID in
// Kontor hinterlegen — Kontor selbst enthält kein eigenes Google-Projekt.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

const SCHLUESSELBUND_DIENST: &str = "kontor-google-drive";
const SCHLUESSELBUND_NUTZER: &str = "refresh_token";
const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.file";
const TOKEN_ENDPUNKT: &str = "https://oauth2.googleapis.com/token";
const AUTH_ENDPUNKT: &str = "https://accounts.google.com/o/oauth2/v2/auth";

fn code_verifier_erzeugen() -> String {
  let mut bytes = [0u8; 64];
  rand::thread_rng().fill_bytes(&mut bytes);
  URL_SAFE_NO_PAD.encode(bytes)
}

fn code_challenge_aus_verifier(verifier: &str) -> String {
  let mut hasher = Sha256::new();
  hasher.update(verifier.as_bytes());
  URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn schluesselbund() -> Result<keyring::Entry, String> {
  keyring::Entry::new(SCHLUESSELBUND_DIENST, SCHLUESSELBUND_NUTZER).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn google_drive_verbunden() -> bool {
  match schluesselbund() {
    Ok(eintrag) => eintrag.get_password().is_ok(),
    Err(_) => false,
  }
}

#[tauri::command]
pub fn google_drive_trennen() -> Result<(), String> {
  let eintrag = schluesselbund()?;
  match eintrag.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

// Wartet auf genau einen lokalen Redirect (RFC 8252, Loopback-Redirect für
// installierte Apps) und liest den Autorisierungscode aus der Query aus.
fn auf_redirect_warten(listener: TcpListener) -> Result<String, String> {
  let (stream, _) = listener.accept().map_err(|e| e.to_string())?;
  let mut reader = BufReader::new(&stream);
  let mut zeile = String::new();
  reader.read_line(&mut zeile).map_err(|e| e.to_string())?;
  // Erwartet: "GET /?code=... HTTP/1.1" oder "GET /?error=... HTTP/1.1"
  let pfad = zeile.split_whitespace().nth(1).ok_or("Ungültige Anfrage vom Browser")?;
  let query = pfad.splitn(2, '?').nth(1).unwrap_or("");
  let mut code = None;
  let mut fehler = None;
  for paar in query.split('&') {
    let mut teile = paar.splitn(2, '=');
    let schluessel = teile.next().unwrap_or("");
    let wert = teile.next().unwrap_or("");
    if schluessel == "code" {
      code = Some(wert.to_string());
    }
    if schluessel == "error" {
      fehler = Some(wert.to_string());
    }
  }

  let antwort_text = if code.is_some() {
    "Kontor ist jetzt mit Google Drive verbunden. Sie können dieses Fenster schließen."
  } else {
    "Die Verbindung mit Google Drive wurde abgebrochen. Sie können dieses Fenster schließen."
  };
  let antwort = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
    antwort_text.len(),
    antwort_text
  );
  let _ = (&stream).write_all(antwort.as_bytes());

  match code {
    Some(c) => Ok(c),
    None => Err(fehler.unwrap_or_else(|| "Kein Autorisierungscode erhalten".into())),
  }
}

#[derive(serde::Deserialize)]
struct TokenAntwort {
  access_token: String,
  refresh_token: Option<String>,
}

/// Führt den vollständigen OAuth-Desktop-Ablauf mit PKCE durch: öffnet den
/// Standardbrowser, wartet lokal auf den Redirect, tauscht den Code gegen
/// Tokens und speichert das Refresh-Token im System-Schlüsselbund.
#[tauri::command]
pub fn google_drive_autorisieren(client_id: String) -> Result<(), String> {
  let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
  let port = listener.local_addr().map_err(|e| e.to_string())?.port();
  let redirect_uri = format!("http://127.0.0.1:{port}");

  let verifier = code_verifier_erzeugen();
  let challenge = code_challenge_aus_verifier(&verifier);

  let auth_url = format!(
    "{AUTH_ENDPUNKT}?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={DRIVE_SCOPE}&code_challenge={challenge}&code_challenge_method=S256&access_type=offline&prompt=consent"
  );

  webbrowser::open(&auth_url).map_err(|e| e.to_string())?;

  let code = auf_redirect_warten(listener)?;

  let client = reqwest::blocking::Client::new();
  let antwort = client
    .post(TOKEN_ENDPUNKT)
    .form(&[
      ("client_id", client_id.as_str()),
      ("code", code.as_str()),
      ("code_verifier", verifier.as_str()),
      ("grant_type", "authorization_code"),
      ("redirect_uri", redirect_uri.as_str()),
    ])
    .send()
    .map_err(|e| e.to_string())?;

  if !antwort.status().is_success() {
    let text = antwort.text().unwrap_or_default();
    return Err(format!("Google hat den Autorisierungscode abgelehnt: {text}"));
  }

  let token: TokenAntwort = antwort.json().map_err(|e| e.to_string())?;
  let refresh_token = token
    .refresh_token
    .ok_or("Google hat kein Refresh-Token geliefert (bitte die Verbindung erneut herstellen)")?;

  schluesselbund()?.set_password(&refresh_token).map_err(|e| e.to_string())
}

fn zugriffstoken_erneuern(client_id: &str, refresh_token: &str) -> Result<String, String> {
  let client = reqwest::blocking::Client::new();
  let antwort = client
    .post(TOKEN_ENDPUNKT)
    .form(&[
      ("client_id", client_id),
      ("refresh_token", refresh_token),
      ("grant_type", "refresh_token"),
    ])
    .send()
    .map_err(|e| e.to_string())?;

  if !antwort.status().is_success() {
    let text = antwort.text().unwrap_or_default();
    return Err(format!("Zugriffstoken konnte nicht erneuert werden: {text}"));
  }

  let token: TokenAntwort = antwort.json().map_err(|e| e.to_string())?;
  Ok(token.access_token)
}

/// Lädt eine Datei (z. B. eine .kontorbackup-Sicherung) in Google Drive hoch.
/// Nutzt die drive.file-Berechtigung: Kontor sieht damit nur Dateien, die es
/// selbst angelegt hat, nicht den restlichen Drive-Inhalt.
#[tauri::command]
pub fn google_drive_datei_hochladen(client_id: String, dateiname: String, inhalt: Vec<u8>) -> Result<(), String> {
  let eintrag = schluesselbund()?;
  let refresh_token = eintrag
    .get_password()
    .map_err(|_| "Nicht mit Google Drive verbunden".to_string())?;
  let access_token = zugriffstoken_erneuern(&client_id, &refresh_token)?;

  let metadaten = serde_json::json!({ "name": dateiname });
  let client = reqwest::blocking::Client::new();
  let form = reqwest::blocking::multipart::Form::new()
    .part(
      "metadata",
      reqwest::blocking::multipart::Part::text(metadaten.to_string())
        .mime_str("application/json; charset=UTF-8")
        .map_err(|e| e.to_string())?,
    )
    .part(
      "file",
      reqwest::blocking::multipart::Part::bytes(inhalt)
        .mime_str("application/octet-stream")
        .map_err(|e| e.to_string())?,
    );

  let antwort = client
    .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
    .bearer_auth(access_token)
    .multipart(form)
    .send()
    .map_err(|e| e.to_string())?;

  if !antwort.status().is_success() {
    let text = antwort.text().unwrap_or_default();
    return Err(format!("Hochladen zu Google Drive fehlgeschlagen: {text}"));
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn code_challenge_entspricht_rfc_7636_testvektor() {
    // Testvektor aus RFC 7636 Anhang B.
    let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    let challenge = code_challenge_aus_verifier(verifier);
    assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  }

  #[test]
  fn code_verifier_hat_ausreichende_laenge_und_ist_url_sicher() {
    let verifier = code_verifier_erzeugen();
    assert!(verifier.len() >= 43, "PKCE-Verifier muss mindestens 43 Zeichen lang sein (RFC 7636)");
    assert!(verifier.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
  }
}
