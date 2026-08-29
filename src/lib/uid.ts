// Einfache, ausreichend eindeutige ID für neu angelegte Datensätze im Browser
// wie in der Tauri-Umgebung (kein Datenbank-Autoincrement über Dateigrenzen).
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
