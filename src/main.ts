import "./style.css";
import { SPRACHEN, t, type Sprache } from "./i18n.ts";
import { calc } from "./lib/buchungen.ts";
import { kassenstand } from "./lib/kasse.ts";
import { offeneGutscheinSumme } from "./lib/gutschein.ts";
import { formatEur, parseNumber } from "./lib/numbers.ts";
import { uid } from "./lib/uid.ts";
import type { Buchung, Konto, Kostenstelle } from "./lib/types.ts";
import { erstelleDatenquelle } from "./repo/index.ts";
import type { Datenquelle } from "./repo/typen.ts";

// P1-Grundgerüst: Navigation und Design aus dem Prototyp (referenz/prototyp.html),
// aber als echte TypeScript-Struktur statt einer HTML-Datei. Buchungen,
// Kontenrahmen und Kostenstellen sind jetzt echte, gegen die Datenquelle
// verdrahtete Ansichten; alles Weitere füllt sich Phase für Phase
// (siehe SPEC.md Abschnitt 10).

type NavEintrag = { typ: "trenner"; label: string } | { typ: "ziel"; key: string; label: string; icon: string; phase?: string };

const ICONS: Record<string, string> = {
  dash: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  book: "M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2zM8 7h7M8 11h7",
  cash: "M3 7h18v10H3zM12 12h.01M6 12h.01M18 12h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
  pct: "M19 5 5 19M7.5 7.5h.01M16.5 16.5h.01M6 9a3 3 0 1 1 3-3 3 3 0 0 1-3 3zM18 21a3 3 0 1 1 3-3 3 3 0 0 1-3 3z",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  clock: "M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zM12 7v5l3 2",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  tagg: "M20 12.5 12.5 20 3 10.5V3h7.5zM7.5 7.5h.01",
  imp: "M12 3v12M8 11l4 4 4-4M4 19h16",
  build: "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01",
  gear: "M12 15.5a3.5 3.5 0 1 0-3.5-3.5 3.5 3.5 0 0 0 3.5 3.5zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
};

function icon(name: string): string {
  return `<svg class="i" viewBox="0 0 24 24"><path d="${ICONS[name] ?? ""}"/></svg>`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const NAV: NavEintrag[] = [
  { typ: "ziel", key: "dashboard", label: "dash", icon: "dash" },
  { typ: "ziel", key: "buchungen", label: "buch", icon: "book" },
  { typ: "ziel", key: "kasse", label: "kasse", icon: "cash", phase: "P1" },
  { typ: "trenner", label: "ausw" },
  { typ: "ziel", key: "bwa", label: "bwa", icon: "chart", phase: "P2" },
  { typ: "ziel", key: "euer", label: "euer", icon: "doc", phase: "P2" },
  { typ: "ziel", key: "ustva", label: "ust", icon: "pct", phase: "P2" },
  { typ: "trenner", label: "pers" },
  { typ: "ziel", key: "mitarbeiter", label: "ma", icon: "users", phase: "P4" },
  { typ: "ziel", key: "stunden", label: "std", icon: "clock", phase: "P4" },
  { typ: "trenner", label: "verw" },
  { typ: "ziel", key: "konten", label: "konten", icon: "list" },
  { typ: "ziel", key: "kostenstellen", label: "ks", icon: "tagg" },
  { typ: "ziel", key: "datenimport", label: "imp", icon: "imp", phase: "P3" },
  { typ: "ziel", key: "mandanten", label: "mand", icon: "build", phase: "P5" },
  { typ: "ziel", key: "einstellungen", label: "einst", icon: "gear" },
  { typ: "ziel", key: "sicherung", label: "sich", icon: "shield", phase: "P5" },
];

interface Zustand {
  tab: string;
  sprache: Sprache;
  repo: Datenquelle;
  konten: Konto[];
  kostenstellen: Kostenstelle[];
  buchungen: Buchung[];
  kassenAnfangsbestand: number;
  kleinunternehmer: boolean;
  gutscheinSumme: number;
}

let zustand: Zustand;

async function datenNeuLaden(): Promise<void> {
  const [konten, kostenstellen, buchungen, einstellungen, gutscheine] = await Promise.all([
    zustand.repo.konten(),
    zustand.repo.kostenstellen(),
    zustand.repo.buchungen(),
    zustand.repo.mandantEinstellungen(),
    zustand.repo.gutscheine(),
  ]);
  zustand.konten = konten;
  zustand.kostenstellen = kostenstellen;
  zustand.buchungen = buchungen;
  zustand.kassenAnfangsbestand = einstellungen.kassenAnfangsbestand;
  zustand.kleinunternehmer = einstellungen.kleinunternehmer;
  zustand.gutscheinSumme = offeneGutscheinSumme(gutscheine);
}

function kontoVon(nr: string): Konto | undefined {
  return zustand.konten.find((k) => k.nr === nr);
}

let meldungTimeout: ReturnType<typeof setTimeout> | undefined;
function zeigeMeldung(text: string): void {
  const wrapper = document.querySelector<HTMLDivElement>("#meldung");
  if (!wrapper) return;
  wrapper.textContent = text;
  wrapper.hidden = false;
  clearTimeout(meldungTimeout);
  meldungTimeout = setTimeout(() => {
    wrapper.hidden = true;
  }, 2500);
}

// ---------- Navigation und Rahmen ----------

function renderSprachSchalter(): string {
  return `<div class="seg" style="width:100%">${SPRACHEN.map(
    (s) => `<button style="flex:1" data-sprache="${s.code}" class="${zustand.sprache === s.code ? "on" : ""}">${s.label}</button>`,
  ).join("")}</div>`;
}

function renderNav(): string {
  return NAV.map((eintrag) => {
    if (eintrag.typ === "trenner") {
      return `<div class="navsep">${t(zustand.sprache, eintrag.label)}</div>`;
    }
    return `<button class="navbtn ${zustand.tab === eintrag.key ? "on" : ""}" data-tab="${eintrag.key}">
      ${icon(eintrag.icon)}<span>${t(zustand.sprache, eintrag.label)}</span>
      ${eintrag.phase ? `<span class="k">${eintrag.phase}</span>` : ""}
    </button>`;
  }).join("");
}

function aktuellerNavEintrag() {
  return NAV.find((n) => n.typ === "ziel" && n.key === zustand.tab) as Extract<NavEintrag, { typ: "ziel" }> | undefined;
}

function topbarTitel(titel: string, aktionen = ""): string {
  return `<div class="topbar"><h1>${titel}</h1><div class="sp"></div>${aktionen}</div>`;
}

// ---------- Übersicht ----------

function renderDashboard(): string {
  const a = calc(zustand.buchungen, kontoVon, zustand.kleinunternehmer);
  const bestand = kassenstand(zustand.buchungen, zustand.kassenAnfangsbestand, "1000", kontoVon);
  const bestandNegativ = bestand < 0;

  const kpis: { lbl: string; val: string; ton: "pos" | "neg" | ""; hinweis?: string }[] = [
    { lbl: t(zustand.sprache, "ein"), val: formatEur(a.ein) + " €", ton: "pos" },
    { lbl: t(zustand.sprache, "aus"), val: formatEur(a.aus) + " €", ton: "neg" },
    { lbl: t(zustand.sprache, "erg"), val: formatEur(a.ergebnis) + " €", ton: a.ergebnis >= 0 ? "pos" : "neg" },
    {
      lbl: t(zustand.sprache, "zahllast"),
      val: zustand.kleinunternehmer ? t(zustand.sprache, "kleinunternehmer_hinweis") : formatEur(a.zahllast) + " €",
      ton: "",
    },
    {
      lbl: t(zustand.sprache, "kasseb"),
      val: formatEur(bestand) + " €",
      ton: bestandNegativ ? "neg" : "",
      hinweis: bestandNegativ ? t(zustand.sprache, "kasse_negativ") : undefined,
    },
    { lbl: t(zustand.sprache, "gutscheine"), val: formatEur(zustand.gutscheinSumme) + " €", ton: "" },
  ];

  return topbarTitel(t(zustand.sprache, "dash")) + `
    <div class="kpiwrap"><div class="grid g3" style="gap:0">
      ${kpis
        .map(
          (k) => `<div class="kpi">
            <div class="lbl">${k.lbl}</div>
            <div class="val ${k.ton}">${k.val}</div>
            ${k.hinweis ? `<div class="dlt"><span class="pill r">${k.hinweis}</span></div>` : ""}
          </div>`,
        )
        .join("")}
    </div></div>
    ${zustand.repo.modus === "vorschau" ? `<div class="hint" style="margin-top:10px">${t(zustand.sprache, "vorschau_hinweis")}</div>` : ""}
  `;
}

// ---------- Kontenrahmen ----------

const KONTO_TYP_LABEL: Record<Konto["typ"], string> = {
  erloes: "erloes",
  aufwand: "aufwand",
  finanz: "finanz",
  privat: "privat",
  bestand: "bestand",
};

function renderKonten(): string {
  const sortiert = [...zustand.konten].sort((a, b) => a.nr.localeCompare(b.nr));
  return (
    topbarTitel(
      t(zustand.sprache, "konten"),
      `<button class="btn" data-aktion="konto-neu">${icon("plus")}${t(zustand.sprache, "neu")}</button>`,
    ) +
    `<div class="card"><div class="tw"><table><thead><tr>
      <th style="width:90px">${t(zustand.sprache, "nr")}</th><th>${t(zustand.sprache, "name")}</th>
      <th style="width:130px">${t(zustand.sprache, "art")}</th>
      <th class="num" style="width:80px">USt</th><th style="width:84px"></th>
    </tr></thead><tbody>
      ${sortiert
        .map(
          (k) => `<tr>
            <td><span class="tag">${escapeHtml(k.nr)}</span></td>
            <td>${escapeHtml(k.name)}</td>
            <td>${t(zustand.sprache, KONTO_TYP_LABEL[k.typ])}</td>
            <td class="num">${k.ust_satz} %</td>
            <td style="text-align:end;white-space:nowrap">
              <button class="btn ghost sm" data-aktion="konto-bearbeiten" data-nr="${escapeHtml(k.nr)}">${icon("edit")}</button>
              <button class="btn danger sm" data-aktion="konto-loeschen" data-nr="${escapeHtml(k.nr)}">${icon("trash")}</button>
            </td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div></div>`
  );
}

function kontoOptionen(ausgewaehlt: string, typen: Konto["typ"][]): string {
  return zustand.konten
    .filter((k) => typen.includes(k.typ))
    .sort((a, b) => a.nr.localeCompare(b.nr))
    .map((k) => `<option value="${escapeHtml(k.nr)}" ${ausgewaehlt === k.nr ? "selected" : ""}>${escapeHtml(k.nr)} – ${escapeHtml(k.name)}</option>`)
    .join("");
}

function kontoFormular(nr?: string): void {
  const bestehend = nr ? kontoVon(nr) : undefined;
  const k = bestehend ?? { nr: "", name: "", typ: "aufwand" as const, ust_satz: 19, bwa_gruppe: "sonst", aktiv: true };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${nr ? t(zustand.sprache, "edit") : t(zustand.sprache, "neu")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "nr")}</label>
        <input id="f-nr" value="${escapeHtml(k.nr)}" ${nr ? "disabled" : ""} placeholder="4980"></div>
      <div style="flex:2"><label class="f">${t(zustand.sprache, "name")}</label><input id="f-name" value="${escapeHtml(k.name)}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "art")}</label>
        <select id="f-typ">
          ${(["erloes", "aufwand", "finanz", "privat"] as const)
            .map((x) => `<option value="${x}" ${k.typ === x ? "selected" : ""}>${t(zustand.sprache, KONTO_TYP_LABEL[x])}</option>`)
            .join("")}
        </select></div>
      <div><label class="f">USt</label>
        <select id="f-ust">${[0, 7, 19].map((s) => `<option value="${s}" ${k.ust_satz === s ? "selected" : ""}>${s} %</option>`).join("")}</select></div>
    </div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="konto-speichern" data-nr="${nr ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function kontoSpeichern(alteNr: string): Promise<void> {
  const nr = alteNr || (document.querySelector<HTMLInputElement>("#f-nr")?.value.trim() ?? "");
  const name = document.querySelector<HTMLInputElement>("#f-name")?.value.trim() ?? "";
  const typ = (document.querySelector<HTMLSelectElement>("#f-typ")?.value ?? "aufwand") as Konto["typ"];
  const ust_satz = Number(document.querySelector<HTMLSelectElement>("#f-ust")?.value ?? 0);
  if (!nr || !name) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  if (!alteNr && kontoVon(nr)) {
    zeigeMeldung(t(zustand.sprache, "fehler_nr_vergeben"));
    return;
  }
  const bestehend = alteNr ? kontoVon(alteNr) : undefined;
  await zustand.repo.kontoSpeichern({
    nr,
    name,
    typ,
    ust_satz,
    bwa_gruppe: bestehend?.bwa_gruppe ?? "sonst",
    aktiv: true,
    sortierung: bestehend?.sortierung,
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function kontoLoeschen(nr: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  const ergebnis = await zustand.repo.kontoLoeschen(nr);
  if (!ergebnis.ok) {
    zeigeMeldung(ergebnis.grund ?? t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

// ---------- Kostenstellen ----------

function renderKostenstellen(): string {
  return (
    topbarTitel(
      t(zustand.sprache, "ks"),
      `<button class="btn" data-aktion="kostenstelle-neu">${icon("plus")}${t(zustand.sprache, "neu")}</button>`,
    ) +
    `<div class="card">${
      zustand.kostenstellen.length
        ? `<table><thead><tr><th>${t(zustand.sprache, "name")}</th><th>${t(zustand.sprache, "notiz")}</th><th style="width:84px"></th></tr></thead><tbody>
          ${zustand.kostenstellen
            .map(
              (k) => `<tr>
                <td><b>${escapeHtml(k.name)}</b></td><td>${escapeHtml(k.notiz)}</td>
                <td style="text-align:end;white-space:nowrap">
                  <button class="btn ghost sm" data-aktion="kostenstelle-bearbeiten" data-id="${escapeHtml(k.id)}">${icon("edit")}</button>
                  <button class="btn danger sm" data-aktion="kostenstelle-loeschen" data-id="${escapeHtml(k.id)}">${icon("trash")}</button>
                </td>
              </tr>`,
            )
            .join("")}
        </tbody></table>`
        : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
    }</div>`
  );
}

function kostenstelleFormular(id?: string): void {
  const bestehend = id ? zustand.kostenstellen.find((k) => k.id === id) : undefined;
  const k = bestehend ?? { id: "", name: "", notiz: "", aktiv: true };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "neu")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row"><div><label class="f">${t(zustand.sprache, "name")}</label>
      <input id="f-name" value="${escapeHtml(k.name)}" placeholder="Filiale Nord"></div></div>
    <div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "notiz")}</label>
      <input id="f-notiz" value="${escapeHtml(k.notiz)}"></div></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="kostenstelle-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function kostenstelleSpeichern(id: string): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#f-name")?.value.trim() ?? "";
  const notiz = document.querySelector<HTMLInputElement>("#f-notiz")?.value.trim() ?? "";
  if (!name) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await zustand.repo.kostenstelleSpeichern({ id: id || uid(), name, notiz, aktiv: true });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function kostenstelleLoeschen(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  const ergebnis = await zustand.repo.kostenstelleLoeschen(id);
  if (!ergebnis.ok) {
    zeigeMeldung(ergebnis.grund ?? t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

// ---------- Buchungen ----------

function buchungsTabelle(liste: Buchung[]): string {
  if (!liste.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
    <th style="width:92px">${t(zustand.sprache, "date")}</th><th style="width:84px">${t(zustand.sprache, "beleg")}</th>
    <th>${t(zustand.sprache, "text")}</th><th style="width:180px">${t(zustand.sprache, "konto")}</th>
    <th style="width:96px">${t(zustand.sprache, "gegen")}</th>
    <th class="num" style="width:100px">${t(zustand.sprache, "brutto")}</th>
    <th class="num" style="width:56px">USt</th><th style="width:84px"></th>
  </tr></thead><tbody>
    ${liste
      .map((b) => {
        const k = kontoVon(b.konto);
        const ton = k?.typ === "erloes" ? "pos" : k?.typ === "aufwand" ? "neg" : "";
        return `<tr>
          <td>${b.datum.split("-").reverse().join(".")}</td><td>${escapeHtml(b.belegnr ?? "")}</td>
          <td>${escapeHtml(b.text)}</td>
          <td><span class="tag">${escapeHtml(b.konto)}</span> ${escapeHtml(k?.name ?? "")}</td>
          <td>${escapeHtml(b.gegenkonto)}</td>
          <td class="num ${ton}">${formatEur(b.betrag_brutto)}</td>
          <td class="num">${b.ust_satz} %</td>
          <td style="text-align:end;white-space:nowrap">
            <button class="btn ghost sm" data-aktion="buchung-bearbeiten" data-id="${escapeHtml(b.id)}">${icon("edit")}</button>
            <button class="btn danger sm" data-aktion="buchung-loeschen" data-id="${escapeHtml(b.id)}">${icon("trash")}</button>
          </td>
        </tr>`;
      })
      .join("")}
  </tbody></table></div>`;
}

function renderBuchungen(): string {
  const sortiert = [...zustand.buchungen].sort((a, b) => b.datum.localeCompare(a.datum));
  const a = calc(zustand.buchungen, kontoVon, zustand.kleinunternehmer);
  return (
    topbarTitel(
      t(zustand.sprache, "buch"),
      `<button class="btn" data-aktion="buchung-neu">${icon("plus")}${t(zustand.sprache, "addb")}</button>`,
    ) +
    `<div class="card">${buchungsTabelle(sortiert)}
      <div class="row" style="margin-top:14px;justify-content:flex-end;gap:24px">
        <span class="fit hint">${t(zustand.sprache, "ein")} <b>${formatEur(a.ein)} €</b></span>
        <span class="fit hint">${t(zustand.sprache, "aus")} <b>${formatEur(a.aus)} €</b></span>
        <span class="fit hint">${t(zustand.sprache, "erg")} <b class="${a.ergebnis >= 0 ? "pos" : "neg"}">${formatEur(a.ergebnis)} €</b></span>
      </div>
    </div>`
  );
}

function buchungFormular(id?: string): void {
  const bestehend = id ? zustand.buchungen.find((b) => b.id === id) : undefined;
  const vorgabeKonto = zustand.konten.find((k) => k.typ === "erloes");
  const b = bestehend ?? {
    id: "",
    datum: new Date().toISOString().slice(0, 10),
    belegnr: "",
    text: "",
    konto: vorgabeKonto?.nr ?? "",
    gegenkonto: zustand.konten.find((k) => k.typ === "finanz")?.nr ?? "",
    betrag_brutto: 0,
    ust_satz: vorgabeKonto?.ust_satz ?? 19,
    kostenstelle_id: undefined as string | undefined,
    quelle: "manuell" as const,
    storniert: false,
  };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "addb")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "date")}</label><input type="date" id="f-datum" value="${b.datum}"></div>
      <div><label class="f">${t(zustand.sprache, "beleg")}</label><input id="f-belegnr" value="${escapeHtml(b.belegnr ?? "")}" placeholder="RE-2026-014"></div>
    </div>
    <div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "text")}</label>
      <input id="f-text" value="${escapeHtml(b.text)}" placeholder="Wareneinkauf Großhandel"></div></div>
    <div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "konto")}</label>
      <select id="f-konto" data-aktion="buchung-konto-geaendert">${kontoOptionen(b.konto, ["erloes", "aufwand", "privat"])}</select></div></div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "gegen")}</label>
        <select id="f-gegenkonto">${kontoOptionen(b.gegenkonto, ["finanz"])}</select></div>
      <div><label class="f">${t(zustand.sprache, "betrag")}</label>
        <input id="f-betrag" value="${b.betrag_brutto || ""}" placeholder="0,00"></div>
      <div><label class="f">${t(zustand.sprache, "satz")}</label>
        <select id="f-ust">${[0, 7, 19].map((s) => `<option value="${s}" ${b.ust_satz === s ? "selected" : ""}>${s} %</option>`).join("")}</select></div>
    </div>
    ${
      zustand.kostenstellen.length
        ? `<div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "kst")}</label>
      <select id="f-kst"><option value="">${t(zustand.sprache, "ohne_kst")}</option>
        ${zustand.kostenstellen.map((k) => `<option value="${escapeHtml(k.id)}" ${b.kostenstelle_id === k.id ? "selected" : ""}>${escapeHtml(k.name)}</option>`).join("")}
      </select></div></div>`
        : ""
    }
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="buchung-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

function buchungKontoGeaendert(): void {
  const kontoNr = document.querySelector<HTMLSelectElement>("#f-konto")?.value;
  const ustFeld = document.querySelector<HTMLSelectElement>("#f-ust");
  const k = kontoNr ? kontoVon(kontoNr) : undefined;
  if (k && ustFeld) ustFeld.value = String(k.ust_satz);
}

async function buchungSpeichern(id: string): Promise<void> {
  const datum = document.querySelector<HTMLInputElement>("#f-datum")?.value ?? "";
  const betrag_brutto = parseNumber(document.querySelector<HTMLInputElement>("#f-betrag")?.value);
  const text = document.querySelector<HTMLInputElement>("#f-text")?.value.trim() ?? "";
  if (!datum || !text || !betrag_brutto) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  const kstFeld = document.querySelector<HTMLSelectElement>("#f-kst")?.value;
  await zustand.repo.buchungSpeichern({
    id: id || uid(),
    datum,
    belegnr: document.querySelector<HTMLInputElement>("#f-belegnr")?.value.trim() ?? "",
    text,
    konto: document.querySelector<HTMLSelectElement>("#f-konto")?.value ?? "",
    gegenkonto: document.querySelector<HTMLSelectElement>("#f-gegenkonto")?.value ?? "",
    betrag_brutto,
    ust_satz: Number(document.querySelector<HTMLSelectElement>("#f-ust")?.value ?? 0),
    kostenstelle_id: kstFeld || undefined,
    quelle: "manuell",
    storniert: false,
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function buchungLoeschen(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.buchungLoeschen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

// ---------- Platzhalter für kommende Phasen ----------

function renderPlatzhalter(): string {
  const eintrag = aktuellerNavEintrag();
  const titel = eintrag ? t(zustand.sprache, eintrag.label) : "";
  return topbarTitel(titel) + `
    <div class="card"><div class="soon">
      ${eintrag?.phase ? `<span class="ph">${t(zustand.sprache, "phase")} ${eintrag.phase}</span>` : ""}
      <h2 style="margin:0">${titel}</h2>
      <p class="hint" style="max-width:420px;margin:0">${t(zustand.sprache, "bereich_im_bau")}</p>
    </div></div>`;
}

function renderInhalt(): string {
  switch (zustand.tab) {
    case "dashboard":
      return renderDashboard();
    case "buchungen":
      return renderBuchungen();
    case "konten":
      return renderKonten();
    case "kostenstellen":
      return renderKostenstellen();
    default:
      return renderPlatzhalter();
  }
}

// ---------- Modal ----------

function openModal(html: string): void {
  const modal = document.querySelector<HTMLDivElement>("#modal");
  if (!modal) return;
  modal.innerHTML = `<div class="mask"><div class="modal">${html}</div></div>`;
}
function closeModal(): void {
  const modal = document.querySelector<HTMLDivElement>("#modal");
  if (modal) modal.innerHTML = "";
}

// ---------- Rendern und Ereignisse (Delegation, damit Modal-Inhalte ohne
// erneutes Binden funktionieren) ----------

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;
  document.documentElement.dir = SPRACHEN.find((s) => s.code === zustand.sprache)?.rtl ? "rtl" : "ltr";
  document.documentElement.lang = zustand.sprache;

  app.innerHTML = `
    <div class="app">
      <aside>
        <div class="brand"><b>K</b><span>Kontor</span></div>
        <div class="mand">${renderSprachSchalter()}</div>
        <nav>${renderNav()}</nav>
      </aside>
      <main>
        ${renderInhalt()}
        <div class="disclaimer">${t(zustand.sprache, "disclaimer")}</div>
      </main>
    </div>
  `;
}

function einrichten(): void {
  document.addEventListener("click", (ereignis) => {
    const ziel = ereignis.target as HTMLElement;

    const tabBtn = ziel.closest<HTMLButtonElement>("[data-tab]");
    if (tabBtn) {
      zustand.tab = tabBtn.dataset.tab!;
      render();
      return;
    }
    const sprachBtn = ziel.closest<HTMLButtonElement>("[data-sprache]");
    if (sprachBtn) {
      zustand.sprache = sprachBtn.dataset.sprache as Sprache;
      render();
      return;
    }
    // Schließen bei Klick auf die Maske selbst (nicht bei Klicks, die aus dem
    // Modal-Inhalt nach oben blubbern) oder auf einen expliziten Schließen-Button.
    const schliessKnopf = ziel.closest<HTMLButtonElement>("button[data-modal-close]");
    if (ziel.classList.contains("mask") || schliessKnopf) {
      closeModal();
      return;
    }

    const aktionBtn = ziel.closest<HTMLButtonElement>("[data-aktion]");
    if (!aktionBtn) return;
    const aktion = aktionBtn.dataset.aktion;
    const nr = aktionBtn.dataset.nr;
    const id = aktionBtn.dataset.id;

    switch (aktion) {
      case "konto-neu":
        kontoFormular();
        break;
      case "konto-bearbeiten":
        if (nr) kontoFormular(nr);
        break;
      case "konto-speichern":
        void kontoSpeichern(nr ?? "");
        break;
      case "konto-loeschen":
        if (nr) void kontoLoeschen(nr);
        break;
      case "kostenstelle-neu":
        kostenstelleFormular();
        break;
      case "kostenstelle-bearbeiten":
        if (id) kostenstelleFormular(id);
        break;
      case "kostenstelle-speichern":
        void kostenstelleSpeichern(id ?? "");
        break;
      case "kostenstelle-loeschen":
        if (id) void kostenstelleLoeschen(id);
        break;
      case "buchung-neu":
        buchungFormular();
        break;
      case "buchung-bearbeiten":
        if (id) buchungFormular(id);
        break;
      case "buchung-speichern":
        void buchungSpeichern(id ?? "");
        break;
      case "buchung-loeschen":
        if (id) void buchungLoeschen(id);
        break;
    }
  });

  document.addEventListener("change", (ereignis) => {
    const ziel = ereignis.target as HTMLElement;
    if (ziel.closest("[data-aktion='buchung-konto-geaendert']")) {
      buchungKontoGeaendert();
    }
  });

  document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key === "Escape") closeModal();
  });
}

async function start(): Promise<void> {
  const repo = await erstelleDatenquelle();
  zustand = {
    tab: "dashboard",
    sprache: "de",
    repo,
    konten: [],
    kostenstellen: [],
    buchungen: [],
    kassenAnfangsbestand: 0,
    kleinunternehmer: false,
    gutscheinSumme: 0,
  };
  await datenNeuLaden();
  einrichten();
  render();
}

void start();
