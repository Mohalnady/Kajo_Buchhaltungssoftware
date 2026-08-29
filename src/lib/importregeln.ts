// Regelanwendung beim Import. Siehe SPEC.md Abschnitt 6 "Ablauf" (Schritt 3).

export interface RegelEintrag {
  stichwoerter: string; // kommagetrennt
  konto: string;
}

/**
 * Sucht das erste Stichwort, das im Buchungstext vorkommt, und liefert dessen Konto.
 * Ohne Treffer: 8300 (Standard-Erlöskonto) bei positivem, 4980 (Sonstiger
 * Betriebsbedarf) bei negativem oder unbekanntem Vorzeichen — jeweils nur ein
 * Vorschlag, der vor dem Übernehmen geprüft und geändert werden kann.
 */
export function regelKonto(text: string, regeln: RegelEintrag[], betragVorzeichen: number): string {
  const s = text.toLowerCase();
  for (const regel of regeln) {
    const treffer = regel.stichwoerter
      .split(",")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .some((wort) => s.includes(wort));
    if (treffer) return regel.konto;
  }
  return betragVorzeichen >= 0 ? "8300" : "4980";
}
