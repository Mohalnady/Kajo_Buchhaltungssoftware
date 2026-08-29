// Zahlen- und Rundungshilfen. Geldbeträge werden nie ungerundet ausgegeben
// (siehe CLAUDE.md: "Niemals Fließkomma für Endsummen ohne Rundung auf zwei Stellen").

/** Rundet kaufmännisch auf zwei Nachkommastellen und vermeidet Fließkomma-Artefakte. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Erkennt deutsche (1.234,56) und englische (1234.56) Zahlenschreibweise. */
export function parseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (v == null || v === "") return 0;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Formatiert als deutsche Zahl mit zwei Nachkommastellen, ohne Währungszeichen. */
export function formatEur(n: number): string {
  return (Number(n) || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
