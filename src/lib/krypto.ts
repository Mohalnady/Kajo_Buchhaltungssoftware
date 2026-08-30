// Passphrasen-basierte Verschlüsselung für die Sicherung (SPEC.md Abschnitt 9:
// "Vollsicherung als verschlüsseltes Archiv"). Nutzt die Web-Crypto-API
// (verfügbar sowohl im Tauri-Webview als auch in Node/Vitest), keine eigene
// Kryptografie-Implementierung.
//
// Format der verschlüsselten Datei: [16 Byte Salt][12 Byte IV][AES-GCM-Chiffrat].
// Der Schlüssel wird aus der Passphrase per PBKDF2 (100.000 Runden, SHA-256)
// abgeleitet — jede Sicherung bekommt ein eigenes Salt, damit dieselbe
// Passphrase nie denselben Schlüssel ergibt.

const SALT_LAENGE = 16;
const IV_LAENGE = 12;
const PBKDF2_RUNDEN = 100_000;

async function schluesselAbleiten(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_RUNDEN, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function verschluesseln(daten: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LAENGE));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LAENGE));
  const schluessel = await schluesselAbleiten(passphrase, salt);
  const chiffrat = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, schluessel, daten as BufferSource));

  const ergebnis = new Uint8Array(SALT_LAENGE + IV_LAENGE + chiffrat.length);
  ergebnis.set(salt, 0);
  ergebnis.set(iv, SALT_LAENGE);
  ergebnis.set(chiffrat, SALT_LAENGE + IV_LAENGE);
  return ergebnis;
}

/** Wirft bei falscher Passphrase oder beschädigter Datei (AES-GCM prüft die Integrität mit). */
export async function entschluesseln(datenVerschluesselt: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (datenVerschluesselt.length < SALT_LAENGE + IV_LAENGE) {
    throw new Error("Datei zu kurz, keine gültige Sicherung.");
  }
  const salt = datenVerschluesselt.slice(0, SALT_LAENGE);
  const iv = datenVerschluesselt.slice(SALT_LAENGE, SALT_LAENGE + IV_LAENGE);
  const chiffrat = datenVerschluesselt.slice(SALT_LAENGE + IV_LAENGE);
  const schluessel = await schluesselAbleiten(passphrase, salt);
  const klartext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, schluessel, chiffrat as BufferSource);
  return new Uint8Array(klartext);
}
