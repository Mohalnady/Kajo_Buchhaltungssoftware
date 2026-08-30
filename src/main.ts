import "./style.css";
import { SPRACHEN, t, type Sprache } from "./i18n.ts";
import { calc } from "./lib/buchungen.ts";
import { kassenstand, kassenverlauf } from "./lib/kasse.ts";
import { offenerBetrag, offeneGutscheinSumme, type Gutschein } from "./lib/gutschein.ts";
import { naechsteBelegnummer } from "./lib/belegnummer.ts";
import { formatEur, parseNumber, round2 } from "./lib/numbers.ts";
import { uid } from "./lib/uid.ts";
import type {
  Beleg,
  Benutzer,
  Buchung,
  Beschaeftigungsart,
  Dokument,
  DokumentTyp,
  Importlauf,
  Importregel,
  Konto,
  Kostenstelle,
  Mitarbeiter,
  Rolle,
  Zeiteintrag,
  ZeiteintragArt,
  ZeiteintragStatus,
  Zuschlagsregel,
} from "./lib/types.ts";
import { erstelleDatenquelle, istTauri } from "./repo/index.ts";
import {
  benutzerAnmelden,
  benutzerAnzahl,
  benutzerListe,
  benutzerAnlegen,
  benutzerPasswortAendern,
  benutzerRolleUndAktivSpeichern,
  einstellungLesen,
  einstellungSchreiben,
  ersteBenutzerAnlegen,
} from "./db/zentral.ts";
import { sicherungEinspielen, sicherungenAuflisten, sicherungErstellen, sicherungVorschau } from "./repo/sicherungTauri.ts";
import type { BackupIntervall } from "./lib/sicherung.ts";
import { join as pfadJoin } from "@tauri-apps/api/path";
import { open as ordnerWaehlen } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { check as updateSuchen } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Datenquelle, MandantEinstellungen } from "./repo/typen.ts";
import { formatVonDateiname, inhaltEinlesen } from "./lib/dateiimport.ts";
import { spaltenErkennen, type DublettenKandidat, type ImportFeld } from "./lib/import-parser.ts";
import { zeileZuKandidat, type ImportKandidat } from "./lib/importkandidaten.ts";
import { standardImportRegeln } from "./lib/standardimportregeln.ts";
import { buchungenZuCsv } from "./lib/buchungscsv.ts";
import { BWA_GRUPPEN, bwaBericht, monatVerschieben, summenNachGruppe } from "./lib/bwa.ts";
import { euerBericht, type EuerZeile } from "./lib/euer.ts";
import { ustVoranmeldung } from "./lib/ustva.ts";
import { kontenblatt, summenUndSalden } from "./lib/berichte.ts";
import { monatsReihe } from "./lib/diagramme.ts";
import { buchungenDesMonats, paketEintraege } from "./lib/monatspaket.ts";
import { feiertageNrw, istFeiertag } from "./lib/feiertage.ts";
import { berechneStunden, bruttolohnFuerEintrag, standardZuschlagsregeln, warnungZehnStunden } from "./lib/stunden.ts";
import {
  auswertungenZugriff,
  buchungenZugriff,
  darfEigeneStundenErfassen,
  darfFirmenUndBackupVerwalten,
  darfFremdeStundenSehen,
  darfStundenFreigeben,
  mitarbeiterUndLoehneZugriff,
  stammdatenZugriff,
  standardTab,
} from "./lib/rechte.ts";
import { zipSync, type Zippable } from "fflate";

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
  voucher: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 7v10",
  plus: "M12 5v14M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  clip: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
};

const ERLAUBTE_DATEI_TYPEN = ".pdf,.doc,.docx,.csv,.xls,.xlsx,.xlsm,.json,.png,.jpg,.jpeg,.md,.markdown";

function mimeVonDateiname(name: string): string {
  const endung = name.split(".").pop()?.toLowerCase() ?? "";
  const zuordnung: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    csv: "text/csv",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    md: "text/markdown",
    markdown: "text/markdown",
  };
  return zuordnung[endung] ?? "application/octet-stream";
}

function formatGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function icon(name: string): string {
  return `<svg class="i" viewBox="0 0 24 24"><path d="${ICONS[name] ?? ""}"/></svg>`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const NAV: NavEintrag[] = [
  { typ: "ziel", key: "dashboard", label: "dash", icon: "dash" },
  { typ: "ziel", key: "buchungen", label: "buch", icon: "book" },
  { typ: "ziel", key: "kasse", label: "kasse", icon: "cash" },
  { typ: "ziel", key: "gutscheine", label: "nav_gutscheine", icon: "voucher" },
  { typ: "trenner", label: "ausw" },
  { typ: "ziel", key: "bwa", label: "bwa", icon: "chart" },
  { typ: "ziel", key: "euer", label: "euer", icon: "doc" },
  { typ: "ziel", key: "ustva", label: "ust", icon: "pct" },
  { typ: "ziel", key: "berichte", label: "berichte", icon: "list" },
  { typ: "ziel", key: "diagramme", label: "diagramme", icon: "chart" },
  { typ: "trenner", label: "pers" },
  { typ: "ziel", key: "mitarbeiter", label: "ma", icon: "users" },
  { typ: "ziel", key: "stunden", label: "std", icon: "clock" },
  { typ: "trenner", label: "verw" },
  { typ: "ziel", key: "konten", label: "konten", icon: "list" },
  { typ: "ziel", key: "kostenstellen", label: "ks", icon: "tagg" },
  { typ: "ziel", key: "datenimport", label: "imp", icon: "imp" },
  { typ: "ziel", key: "belegablage", label: "belegablage", icon: "clip" },
  { typ: "ziel", key: "mandanten", label: "mand", icon: "build", phase: "P5" },
  { typ: "ziel", key: "benutzer", label: "benutzer", icon: "users" },
  { typ: "ziel", key: "einstellungen", label: "einst", icon: "gear" },
  { typ: "ziel", key: "sicherung", label: "sich", icon: "shield" },
];

interface Zustand {
  tab: string;
  sprache: Sprache;
  repo: Datenquelle;
  benutzer: Benutzer;
  benutzerListe: Benutzer[];
  kannBuchungenBearbeiten: boolean;
  konten: Konto[];
  kostenstellen: Kostenstelle[];
  buchungen: Buchung[];
  gutscheine: Gutschein[];
  kassenAnfangsbestand: number;
  kleinunternehmer: boolean;
  versteuerung: "ist" | "soll";
  voranmeldung: "monatlich" | "quartalsweise" | "jaehrlich";
  firmenprofil: MandantEinstellungen;
  logoObjectUrl: string | null;
  gutscheinSumme: number;
  kassenKonto: "1000" | "1210";
  importregeln: Importregel[];
  importlaeufe: Importlauf[];
  dokumente: Dokument[];
  mitarbeiter: Mitarbeiter[];
  zeiteintraege: Zeiteintrag[];
  zuschlagsregeln: Zuschlagsregel[];
}

let zustand: Zustand;

async function datenNeuLaden(): Promise<void> {
  const [konten, kostenstellen, buchungen, einstellungen, gutscheine, importregeln, importlaeufe, dokumente, mitarbeiter, zeiteintraege, zuschlagsregeln] =
    await Promise.all([
      zustand.repo.konten(),
      zustand.repo.kostenstellen(),
      zustand.repo.buchungen(),
      zustand.repo.mandantEinstellungen(),
      zustand.repo.gutscheine(),
      zustand.repo.importregeln(),
      zustand.repo.importlaeufe(),
      zustand.repo.dokumente(),
      zustand.repo.mitarbeiterListe(),
      zustand.repo.zeiteintraege(),
      zustand.repo.zuschlagsregeln(),
    ]);
  zustand.konten = konten;
  zustand.kostenstellen = kostenstellen;
  zustand.buchungen = buchungen;
  zustand.gutscheine = gutscheine;
  zustand.kassenAnfangsbestand = einstellungen.kassenAnfangsbestand;
  zustand.kleinunternehmer = einstellungen.kleinunternehmer;
  zustand.versteuerung = einstellungen.versteuerung;
  zustand.voranmeldung = einstellungen.voranmeldung;
  zustand.firmenprofil = einstellungen;
  const logoBlob = await zustand.repo.logoInhalt();
  if (zustand.logoObjectUrl) URL.revokeObjectURL(zustand.logoObjectUrl);
  zustand.logoObjectUrl = logoBlob ? URL.createObjectURL(logoBlob) : null;
  zustand.gutscheinSumme = offeneGutscheinSumme(gutscheine);
  zustand.importregeln = importregeln;
  zustand.importlaeufe = importlaeufe;
  zustand.dokumente = dokumente;
  zustand.mitarbeiter = mitarbeiter;
  zustand.zeiteintraege = zeiteintraege;
  zustand.zuschlagsregeln = zuschlagsregeln;
  zustand.benutzerListe = istTauri() ? await benutzerListe() : [zustand.benutzer];
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

function renderSprachSchalter(aktuelleSprache: Sprache): string {
  return `<div class="seg" style="width:100%">${SPRACHEN.map(
    (s) => `<button style="flex:1" data-sprache="${s.code}" class="${aktuelleSprache === s.code ? "on" : ""}">${s.label}</button>`,
  ).join("")}</div>`;
}

/** Sichtbarkeit einzelner Nav-Ziele nach der Rechtetabelle aus SPEC.md Abschnitt 8. */
function navZielSichtbar(key: string, rolle: Rolle): boolean {
  switch (key) {
    case "dashboard":
    case "buchungen":
    case "kasse":
    case "gutscheine":
      return buchungenZugriff(rolle) !== "kein";
    case "bwa":
    case "euer":
    case "ustva":
    case "berichte":
    case "diagramme":
      return auswertungenZugriff(rolle) !== "kein";
    case "mitarbeiter":
      return mitarbeiterUndLoehneZugriff(rolle) !== "kein";
    case "stunden":
      return darfEigeneStundenErfassen(rolle) || darfFremdeStundenSehen(rolle);
    case "konten":
    case "kostenstellen":
    case "datenimport":
    case "belegablage":
    case "einstellungen":
      return stammdatenZugriff(rolle) !== "kein";
    case "mandanten":
    case "benutzer":
    case "sicherung":
      return darfFirmenUndBackupVerwalten(rolle);
    default:
      return true;
  }
}

/** Nav-Einträge für die aktuelle Rolle, ohne Trenner über leeren Abschnitten. */
function navEintraegeFuerRolle(rolle: Rolle): NavEintrag[] {
  const gefiltert = NAV.filter((e) => e.typ === "trenner" || navZielSichtbar(e.key, rolle));
  return gefiltert.filter((eintrag, i) => eintrag.typ !== "trenner" || gefiltert[i + 1]?.typ === "ziel");
}

function renderNav(): string {
  return navEintraegeFuerRolle(zustand.benutzer.rolle)
    .map((eintrag) => {
      if (eintrag.typ === "trenner") {
        return `<div class="navsep">${t(zustand.sprache, eintrag.label)}</div>`;
      }
      return `<button class="navbtn ${zustand.tab === eintrag.key ? "on" : ""}" data-tab="${eintrag.key}">
      ${icon(eintrag.icon)}<span>${t(zustand.sprache, eintrag.label)}</span>
      ${eintrag.phase ? `<span class="k">${eintrag.phase}</span>` : ""}
    </button>`;
    })
    .join("");
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

// ---------- Kassenbuch ----------

const KASSENKONTEN: { nr: "1000" | "1210"; label: string }[] = [
  { nr: "1000", label: "Kasse" },
  { nr: "1210", label: "Karte" },
];

function renderKasse(): string {
  const anfangsbestand = zustand.kassenKonto === "1000" ? zustand.kassenAnfangsbestand : 0;
  const verlauf = kassenverlauf(zustand.buchungen, anfangsbestand, zustand.kassenKonto, kontoVon).reverse();
  const aktuellerBestand = verlauf[0]?.bestand ?? anfangsbestand;

  const auswahl = `<div class="seg">${KASSENKONTEN.map(
    (k) => `<button data-aktion="kasse-konto-waehlen" data-nr="${k.nr}" class="${zustand.kassenKonto === k.nr ? "on" : ""}">${k.label}</button>`,
  ).join("")}</div>`;

  return (
    topbarTitel(t(zustand.sprache, "kasse"), auswahl) +
    `<div class="kpiwrap" style="margin-bottom:14px"><div class="grid g3" style="gap:0">
      <div class="kpi">
        <div class="lbl">${t(zustand.sprache, "bestand")}</div>
        <div class="val ${aktuellerBestand < 0 ? "neg" : ""}">${formatEur(aktuellerBestand)} €</div>
        ${aktuellerBestand < 0 ? `<div class="dlt"><span class="pill r">${t(zustand.sprache, "kasse_negativ")}</span></div>` : ""}
      </div>
    </div></div>
    <div class="card">${
      verlauf.length
        ? `<div class="tw"><table><thead><tr>
            <th style="width:92px">${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "text")}</th>
            <th class="num" style="width:110px">${t(zustand.sprache, "bewegung")}</th>
            <th class="num" style="width:110px">${t(zustand.sprache, "bestand")}</th>
          </tr></thead><tbody>
            ${verlauf
              .map(
                (z) => `<tr>
                  <td>${z.buchung.datum.split("-").reverse().join(".")}</td>
                  <td>${escapeHtml(z.buchung.text)}</td>
                  <td class="num ${z.bewegung >= 0 ? "pos" : "neg"}">${z.bewegung >= 0 ? "+" : ""}${formatEur(z.bewegung)}</td>
                  <td class="num ${z.negativ ? "neg" : ""}"><b>${formatEur(z.bestand)}</b></td>
                </tr>`,
              )
              .join("")}
          </tbody></table></div>`
        : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
    }</div>`
  );
}

// ---------- Gutscheine ----------

const GUTSCHEIN_STATUS_LABEL: Record<Gutschein["status"], string> = {
  offen: "status_offen",
  teilweise_eingeloest: "status_teilweise",
  eingeloest: "status_eingeloest",
};
const GUTSCHEIN_STATUS_PILL: Record<Gutschein["status"], string> = {
  offen: "y",
  teilweise_eingeloest: "b",
  eingeloest: "g",
};

function renderGutscheine(): string {
  const sortiert = [...zustand.gutscheine].sort((a, b) => (b.ausgabe_datum ?? "").localeCompare(a.ausgabe_datum ?? ""));
  return (
    topbarTitel(
      t(zustand.sprache, "nav_gutscheine"),
      zustand.kannBuchungenBearbeiten
        ? `<button class="btn" data-aktion="gutschein-ausgeben-neu">${icon("plus")}${t(zustand.sprache, "gutschein_ausgeben")}</button>`
        : "",
    ) +
    `<div class="card">${
      sortiert.length
        ? `<div class="tw"><table><thead><tr>
            <th style="width:120px">${t(zustand.sprache, "nr")}</th>
            <th style="width:92px">${t(zustand.sprache, "ausgabedatum")}</th>
            <th class="num" style="width:90px">${t(zustand.sprache, "betrag")}</th>
            <th class="num" style="width:90px">${t(zustand.sprache, "eingeloest_spalte")}</th>
            <th class="num" style="width:90px">${t(zustand.sprache, "rest")}</th>
            <th style="width:130px">${t(zustand.sprache, "status")}</th>
            <th style="width:100px"></th>
          </tr></thead><tbody>
            ${sortiert
              .map(
                (g) => `<tr>
                  <td><span class="tag">${escapeHtml(g.nummer)}</span></td>
                  <td>${g.ausgabe_datum ? g.ausgabe_datum.split("-").reverse().join(".") : ""}</td>
                  <td class="num">${formatEur(g.betrag)}</td>
                  <td class="num">${formatEur(g.eingeloest_betrag)}</td>
                  <td class="num"><b>${formatEur(offenerBetrag(g))}</b></td>
                  <td><span class="pill ${GUTSCHEIN_STATUS_PILL[g.status]}">${t(zustand.sprache, GUTSCHEIN_STATUS_LABEL[g.status])}</span></td>
                  <td style="text-align:end">
                    ${g.status !== "eingeloest" && zustand.kannBuchungenBearbeiten ? `<button class="btn ghost sm" data-aktion="gutschein-einloesen-neu" data-id="${escapeHtml(g.id ?? "")}">${t(zustand.sprache, "gutschein_einloesen")}</button>` : ""}
                  </td>
                </tr>`,
              )
              .join("")}
          </tbody></table></div>`
        : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
    }</div>`
  );
}

function gutscheinAusgebenFormular(): void {
  const jahr = String(new Date().getFullYear());
  const vorschlag = naechsteBelegnummer(
    zustand.gutscheine.map((g) => g.nummer),
    jahr,
    "GS",
  );
  openModal(`
    <div class="mhead"><h2 style="margin:0">${t(zustand.sprache, "gutschein_ausgeben")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "nr")}</label><input id="f-nummer" value="${vorschlag}"></div>
      <div><label class="f">${t(zustand.sprache, "ausgabedatum")}</label><input type="date" id="f-datum" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "betrag")}</label><input id="f-betrag" placeholder="0,00"></div>
      <div><label class="f">${t(zustand.sprache, "zahlungskonto")}</label>
        <select id="f-zahlkonto">${kontoOptionen("1000", ["finanz"])}</select></div>
    </div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="gutschein-ausgeben-speichern">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function gutscheinAusgebenSpeichern(): Promise<void> {
  const nummer = document.querySelector<HTMLInputElement>("#f-nummer")?.value.trim() ?? "";
  const ausgabe_datum = document.querySelector<HTMLInputElement>("#f-datum")?.value ?? "";
  const betrag = parseNumber(document.querySelector<HTMLInputElement>("#f-betrag")?.value);
  const zahlungskonto = document.querySelector<HTMLSelectElement>("#f-zahlkonto")?.value ?? "";
  if (!nummer || !ausgabe_datum || !betrag) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await zustand.repo.gutscheinAusgeben({ nummer, ausgabe_datum, betrag, zahlungskonto });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

function gutscheinEinloesenFormular(id: string): void {
  const g = zustand.gutscheine.find((x) => x.id === id);
  if (!g) return;
  openModal(`
    <div class="mhead"><h2 style="margin:0">${t(zustand.sprache, "gutschein_einloesen")} ${escapeHtml(g.nummer)}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <p class="hint">${t(zustand.sprache, "rest")}: <b class="num">${formatEur(offenerBetrag(g))} €</b></p>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "betrag")}</label><input id="f-betrag" value="${offenerBetrag(g)}"></div>
      <div><label class="f">${t(zustand.sprache, "einloesedatum")}</label><input type="date" id="f-datum" value="${new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "erloeskonto")}</label>
      <select id="f-erloeskonto">${kontoOptionen("", ["erloes"])}</select></div></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="gutschein-einloesen-speichern" data-id="${escapeHtml(id)}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function gutscheinEinloesenSpeichern(id: string): Promise<void> {
  const betrag = parseNumber(document.querySelector<HTMLInputElement>("#f-betrag")?.value);
  const datum = document.querySelector<HTMLInputElement>("#f-datum")?.value ?? "";
  const erloesKonto = document.querySelector<HTMLSelectElement>("#f-erloeskonto")?.value ?? "";
  if (!betrag || !datum || !erloesKonto) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  const ergebnis = await zustand.repo.gutscheinEinloesen({ id, betrag, datum, erloesKonto });
  if (!ergebnis.ok) {
    zeigeMeldung(ergebnis.grund ?? t(zustand.sprache, "fehler_restbetrag"));
    return;
  }
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
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
            <button class="btn ghost sm" data-aktion="buchung-belege" data-id="${escapeHtml(b.id)}">${icon("clip")}</button>
            ${
              zustand.kannBuchungenBearbeiten
                ? `<button class="btn ghost sm" data-aktion="buchung-bearbeiten" data-id="${escapeHtml(b.id)}">${icon("edit")}</button>
            <button class="btn danger sm" data-aktion="buchung-loeschen" data-id="${escapeHtml(b.id)}">${icon("trash")}</button>`
                : ""
            }
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
      zustand.kannBuchungenBearbeiten
        ? `<button class="btn" data-aktion="buchung-neu">${icon("plus")}${t(zustand.sprache, "addb")}</button>`
        : "",
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
    belegnr: naechsteBelegnummer(
      zustand.buchungen.map((x) => x.belegnr ?? ""),
      String(new Date().getFullYear()),
    ),
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

// ---------- Belege ----------

let aktuelleBelege: Beleg[] = [];

function belegeListeHtml(): string {
  if (!aktuelleBelege.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return aktuelleBelege
    .map(
      (beleg) => `<div class="listrow">
        <span>${icon("doc")}</span>
        <span style="margin-inline-start:8px">
          <button class="btn ghost sm" data-aktion="beleg-oeffnen" data-id="${escapeHtml(beleg.id)}" style="padding:2px 0;box-shadow:none;background:none;color:var(--ink);font-weight:600">${escapeHtml(beleg.dateiname)}</button>
          <br><span class="hint">${formatGroesse(beleg.groesse)} · ${beleg.hinzugefuegt_am.slice(0, 10).split("-").reverse().join(".")}</span>
        </span>
        <span style="margin-inline-start:auto"><button class="btn danger sm" data-aktion="beleg-loeschen" data-id="${escapeHtml(beleg.id)}">${icon("trash")}</button></span>
      </div>`,
    )
    .join("");
}

async function belegeFormular(buchungId: string): Promise<void> {
  aktuelleBelege = await zustand.repo.belegeVon(buchungId);
  const buchung = zustand.buchungen.find((b) => b.id === buchungId);
  openModal(`
    <div class="mhead"><h2 style="margin:0">${t(zustand.sprache, "belege_titel")}${buchung ? ` — ${escapeHtml(buchung.text)}` : ""}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <input type="file" multiple accept="${ERLAUBTE_DATEI_TYPEN}" data-aktion="beleg-datei-gewaehlt" data-buchung-id="${escapeHtml(buchungId)}">
    <div class="hint" style="margin-top:6px">${t(zustand.sprache, "belege_hinweis_typen")}</div>
    <div id="beleg-liste" style="margin-top:16px">${belegeListeHtml()}</div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
    </div>
  `);
}

async function belegeAktualisierenImModal(buchungId: string): Promise<void> {
  aktuelleBelege = await zustand.repo.belegeVon(buchungId);
  const liste = document.querySelector<HTMLDivElement>("#beleg-liste");
  if (liste) liste.innerHTML = belegeListeHtml();
}

async function belegeHochladen(buchungId: string, dateien: FileList): Promise<void> {
  for (const datei of Array.from(dateien)) {
    const inhalt = new Uint8Array(await datei.arrayBuffer());
    await zustand.repo.belegAnhaengen({
      buchung_id: buchungId,
      dateiname: datei.name,
      mime: datei.type || mimeVonDateiname(datei.name),
      inhalt,
    });
  }
  await belegeAktualisierenImModal(buchungId);
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function belegOeffnen(id: string): Promise<void> {
  const beleg = aktuelleBelege.find((b) => b.id === id);
  if (!beleg) return;
  const blob = await zustand.repo.belegInhalt(beleg);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function belegLoeschenAktion(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  const beleg = aktuelleBelege.find((b) => b.id === id);
  await zustand.repo.belegLoeschen(id);
  if (beleg) await belegeAktualisierenImModal(beleg.buchung_id);
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

// ---------- Datenimport und -export ----------

interface ImportSitzung {
  dateiname: string;
  format: Importlauf["format"];
  kopfzeile: string[];
  zeilen: (string | number)[][];
  zuordnung: Partial<Record<ImportFeld, number>>;
  kandidaten: ImportKandidat[];
}

let importSitzung: ImportSitzung | null = null;

const IMPORT_FELDER: { feld: ImportFeld; label: string }[] = [
  { feld: "datum", label: "date" },
  { feld: "betrag", label: "betrag" },
  { feld: "text", label: "text" },
  { feld: "text2", label: "text_zusatz" },
  { feld: "belegnr", label: "beleg" },
  { feld: "ust", label: "satz" },
  { feld: "zahlart", label: "zahlart" },
  { feld: "kostenstelle", label: "kst" },
  { feld: "konto", label: "konto" },
  { feld: "gegenkonto", label: "gegen" },
];

const IMPORT_KONTO_TYPEN: Konto["typ"][] = ["erloes", "aufwand", "finanz", "privat", "bestand"];

function ladeDateiHerunter(inhalt: BlobPart, dateiname: string, mime: string): void {
  const blob = new Blob([inhalt], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function buchungenExportieren(): void {
  const sortiert = [...zustand.buchungen].sort((a, b) => a.datum.localeCompare(b.datum));
  const csv = buchungenZuCsv(sortiert);
  ladeDateiHerunter(csv, `buchungen_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
}

function kandidatenNeuBerechnen(): void {
  if (!importSitzung) return;
  const bestehende: DublettenKandidat[] = zustand.buchungen.map((b) => ({
    datum: b.datum,
    betrag: b.betrag_brutto,
    text: b.text,
  }));
  const aktiveRegeln = zustand.importregeln.filter((r) => r.aktiv);
  importSitzung.kandidaten = importSitzung.zeilen.map((zeile) =>
    zeileZuKandidat(zeile, importSitzung!.zuordnung, aktiveRegeln, bestehende),
  );
}

async function importDateiEinlesen(datei: File): Promise<void> {
  const format = formatVonDateiname(datei.name);
  const buffer = await datei.arrayBuffer();
  const roh = inhaltEinlesen(format, buffer);
  if (!roh.zeilen.length) {
    zeigeMeldung(t(zustand.sprache, "import_keine_zeilen"));
    return;
  }
  importSitzung = {
    dateiname: datei.name,
    format: roh.format,
    kopfzeile: roh.kopfzeile,
    zeilen: roh.zeilen,
    zuordnung: spaltenErkennen(roh.kopfzeile),
    kandidaten: [],
  };
  kandidatenNeuBerechnen();
  render();
}

function importAbbrechen(): void {
  importSitzung = null;
  render();
}

async function importUebernehmen(): Promise<void> {
  if (!importSitzung) return;
  const ausgewaehlt = importSitzung.kandidaten.filter((k) => k.uebernehmen);
  if (!ausgewaehlt.length) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  const quelle: Buchung["quelle"] =
    importSitzung.format === "excel"
      ? "import_excel"
      : importSitzung.zuordnung.zahlart != null
        ? "import_kasse"
        : "import_bank";
  const buchungen: Buchung[] = ausgewaehlt.map((k) => ({
    id: uid(),
    datum: k.datum,
    belegnr: k.belegnr,
    text: k.text,
    konto: k.konto,
    gegenkonto: k.gegenkonto,
    betrag_brutto: k.betrag_brutto,
    ust_satz: k.ust_satz,
    quelle,
    storniert: false,
  }));
  await zustand.repo.buchungenUebernehmen({
    buchungen,
    datei: importSitzung.dateiname,
    format: importSitzung.format,
    zeilen: importSitzung.zeilen.length,
  });
  importSitzung = null;
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function importRueckgaengigAktion(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.importRueckgaengig(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

function importZuordnungAuswahl(feld: ImportFeld): string {
  const aktuell = importSitzung?.zuordnung[feld];
  const optionen = importSitzung
    ? importSitzung.kopfzeile
        .map((h, i) => `<option value="${i}" ${aktuell === i ? "selected" : ""}>${escapeHtml(h)}</option>`)
        .join("")
    : "";
  return `<select data-import-zuordnung="${feld}"><option value="">${t(zustand.sprache, "import_spalte_keine")}</option>${optionen}</select>`;
}

function importPruefTabelle(): string {
  if (!importSitzung) return "";
  if (!importSitzung.kandidaten.length) return `<div class="empty">${t(zustand.sprache, "import_keine_zeilen")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th></th><th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "text")}</th>
      <th>${t(zustand.sprache, "betrag")}</th><th>${t(zustand.sprache, "konto")}</th>
      <th>${t(zustand.sprache, "gegen")}</th><th>${t(zustand.sprache, "satz")}</th><th></th>
    </tr></thead><tbody>
      ${importSitzung.kandidaten
        .map(
          (k, i) => `<tr>
            <td><input type="checkbox" data-import-feld="uebernehmen" data-index="${i}" ${k.uebernehmen ? "checked" : ""}></td>
            <td>${escapeHtml(k.datum.split("-").reverse().join("."))}</td>
            <td>${escapeHtml(k.text)}</td>
            <td style="text-align:end;white-space:nowrap">${formatEur(k.betrag_brutto)} €</td>
            <td><select data-import-feld="konto" data-index="${i}">${kontoOptionen(k.konto, IMPORT_KONTO_TYPEN)}</select></td>
            <td><select data-import-feld="gegenkonto" data-index="${i}">${kontoOptionen(k.gegenkonto, IMPORT_KONTO_TYPEN)}</select></td>
            <td><select data-import-feld="ust_satz" data-index="${i}">${[0, 7, 19]
              .map((s) => `<option value="${s}" ${k.ust_satz === s ? "selected" : ""}>${s} %</option>`)
              .join("")}</select></td>
            <td>${k.dublette ? `<span class="pill y">${t(zustand.sprache, "import_dublette")}</span>` : ""}</td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderImportBereich(): string {
  if (!importSitzung) {
    return `<input type="file" accept=".csv,.tsv,.json,.md,.markdown,.xlsx,.xls" data-aktion="import-datei-gewaehlt">
      <div class="hint" style="margin-top:6px">${t(zustand.sprache, "import_hinweis_typen")}</div>`;
  }
  return `
    <div class="hint">${escapeHtml(importSitzung.dateiname)} · ${importSitzung.format.toUpperCase()} · ${importSitzung.zeilen.length} ${t(zustand.sprache, "import_zeilen_spalte")}</div>
    <h3 style="margin:16px 0 8px">${t(zustand.sprache, "import_spalten")}</h3>
    <div class="row" style="flex-wrap:wrap;gap:12px">
      ${IMPORT_FELDER.map((f) => `<div><label class="f">${t(zustand.sprache, f.label)}</label>${importZuordnungAuswahl(f.feld)}</div>`).join("")}
    </div>
    <h3 style="margin:20px 0 8px">${t(zustand.sprache, "import_pruefen")}</h3>
    ${importPruefTabelle()}
    <div class="row" style="margin-top:16px;justify-content:flex-end;gap:8px">
      <button class="btn ghost fit" data-aktion="import-abbrechen">${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="import-uebernehmen">${t(zustand.sprache, "import_uebernehmen")}</button>
    </div>
  `;
}

function importBereichAktualisieren(): void {
  const bereich = document.querySelector<HTMLDivElement>("#import-bereich");
  if (bereich) bereich.innerHTML = renderImportBereich();
}

function renderImportregeln(): string {
  if (!zustand.importregeln.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "stichwoerter")}</th><th>${t(zustand.sprache, "konto")}</th>
      <th>${t(zustand.sprache, "prioritaet")}</th><th>${t(zustand.sprache, "aktiv")}</th><th></th>
    </tr></thead><tbody>
      ${zustand.importregeln
        .map(
          (r) => `<tr>
            <td>${escapeHtml(r.stichwoerter)}</td><td>${escapeHtml(r.konto)}</td>
            <td>${r.prioritaet}</td><td>${r.aktiv ? "✓" : "—"}</td>
            <td style="text-align:end;white-space:nowrap">
              <button class="btn ghost sm" data-aktion="regel-bearbeiten" data-id="${escapeHtml(r.id)}">${icon("edit")}</button>
              <button class="btn danger sm" data-aktion="regel-loeschen" data-id="${escapeHtml(r.id)}">${icon("trash")}</button>
            </td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderImportlaeufe(): string {
  const sortiert = [...zustand.importlaeufe].sort((a, b) => b.datum.localeCompare(a.datum));
  if (!sortiert.length) return `<div class="empty">${t(zustand.sprache, "import_keine_laeufe")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "datei_spalte")}</th>
      <th>${t(zustand.sprache, "format_spalte")}</th><th>${t(zustand.sprache, "import_zeilen_spalte")}</th>
      <th>${t(zustand.sprache, "import_uebernommen_spalte")}</th><th></th>
    </tr></thead><tbody>
      ${sortiert
        .map(
          (l, i) => `<tr>
            <td>${escapeHtml(l.datum.slice(0, 10).split("-").reverse().join("."))}</td>
            <td>${escapeHtml(l.datei)}</td><td>${l.format.toUpperCase()}</td>
            <td>${l.zeilen}</td><td>${l.uebernommen}</td>
            <td style="text-align:end">${
              i === 0
                ? `<button class="btn ghost sm" data-aktion="import-rueckgaengig" data-id="${escapeHtml(l.id)}">${t(zustand.sprache, "rueckgaengig")}</button>`
                : ""
            }</td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderDatenimport(): string {
  return (
    topbarTitel(
      t(zustand.sprache, "imp"),
      `<button class="btn ghost" data-aktion="buchungen-exportieren">${icon("doc")}${t(zustand.sprache, "export_csv")}</button>`,
    ) +
    `<div class="card"><h2 style="margin-top:0">${t(zustand.sprache, "import_datei")}</h2>
      <div id="import-bereich">${renderImportBereich()}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2 style="margin:0">${t(zustand.sprache, "import_regeln_titel")}</h2>
        <div class="row fit" style="gap:8px">
          <button class="btn ghost sm" data-aktion="standardregeln-laden">${t(zustand.sprache, "standardregeln_laden")}</button>
          <button class="btn sm" data-aktion="regel-neu">${icon("plus")}${t(zustand.sprache, "import_regel_neu")}</button>
        </div>
      </div>
      <div style="margin-top:12px">${renderImportregeln()}</div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "import_protokoll_titel")}</h2>
      ${renderImportlaeufe()}
    </div>`
  );
}

function regelFormular(id?: string): void {
  const bestehend = id ? zustand.importregeln.find((r) => r.id === id) : undefined;
  const r = bestehend ?? { id: "", stichwoerter: "", konto: "", prioritaet: 0, aktiv: true };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "import_regel_neu")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row"><div style="flex:2"><label class="f">${t(zustand.sprache, "stichwoerter")}</label>
      <input id="f-stichwoerter" value="${escapeHtml(r.stichwoerter)}" placeholder="sumup,kartenzahlung"></div></div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "konto")}</label>
        <select id="f-regel-konto">${kontoOptionen(r.konto, IMPORT_KONTO_TYPEN)}</select></div>
      <div><label class="f">${t(zustand.sprache, "prioritaet")}</label>
        <input id="f-prioritaet" type="number" value="${r.prioritaet}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <label class="f" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="f-aktiv" ${r.aktiv ? "checked" : ""}> ${t(zustand.sprache, "aktiv")}
      </label>
    </div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="regel-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function regelSpeichern(id: string): Promise<void> {
  const stichwoerter = document.querySelector<HTMLInputElement>("#f-stichwoerter")?.value.trim() ?? "";
  const konto = document.querySelector<HTMLSelectElement>("#f-regel-konto")?.value ?? "";
  if (!stichwoerter || !konto) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await zustand.repo.importregelSpeichern({
    id: id || uid(),
    stichwoerter,
    konto,
    prioritaet: Number(document.querySelector<HTMLInputElement>("#f-prioritaet")?.value ?? 0),
    aktiv: document.querySelector<HTMLInputElement>("#f-aktiv")?.checked ?? true,
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function regelLoeschen(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.importregelLoeschen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

async function standardregelnLaden(): Promise<void> {
  const vorhandene = new Set(zustand.importregeln.map((r) => r.stichwoerter));
  for (const regel of standardImportRegeln()) {
    if (vorhandene.has(regel.stichwoerter)) continue;
    await zustand.repo.importregelSpeichern({
      id: uid(),
      stichwoerter: regel.stichwoerter,
      konto: regel.konto,
      prioritaet: 0,
      aktiv: true,
    });
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

// ---------- Zeiträume (BWA, EÜR, USt-VA, Berichte) ----------

function heutigerMonat(): string {
  return new Date().toISOString().slice(0, 7);
}

function monatsSpanne(monat: string): { von: string; bis: string } {
  const [jahr, m] = monat.split("-").map(Number);
  const letzterTag = new Date(Date.UTC(jahr, m, 0)).getUTCDate();
  return { von: `${monat}-01`, bis: `${monat}-${String(letzterTag).padStart(2, "0")}` };
}

function quartalsSpanne(jahr: number, quartal: number): { von: string; bis: string } {
  const startMonat = (quartal - 1) * 3 + 1;
  const endMonat = startMonat + 2;
  const letzterTag = new Date(Date.UTC(jahr, endMonat, 0)).getUTCDate();
  return {
    von: `${jahr}-${String(startMonat).padStart(2, "0")}-01`,
    bis: `${jahr}-${String(endMonat).padStart(2, "0")}-${String(letzterTag).padStart(2, "0")}`,
  };
}

function jahresSpanne(jahr: number): { von: string; bis: string } {
  return { von: `${jahr}-01-01`, bis: `${jahr}-12-31` };
}

const zeitraeume: Record<string, { von: string; bis: string }> = {};

function zeitraumFuer(gruppe: string): { von: string; bis: string } {
  if (!zeitraeume[gruppe]) zeitraeume[gruppe] = monatsSpanne(heutigerMonat());
  return zeitraeume[gruppe];
}

function zeitraumAuswahlHtml(gruppe: string): string {
  const zr = zeitraumFuer(gruppe);
  return `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:flex-end">
    <div><label class="f">${t(zustand.sprache, "von")}</label>
      <input type="date" data-zeitraum-gruppe="${gruppe}" data-zeitraum-teil="von" value="${zr.von}"></div>
    <div><label class="f">${t(zustand.sprache, "bis")}</label>
      <input type="date" data-zeitraum-gruppe="${gruppe}" data-zeitraum-teil="bis" value="${zr.bis}"></div>
    <button class="btn ghost sm fit" data-aktion="zeitraum-monat" data-zeitraum-gruppe="${gruppe}">${t(zustand.sprache, "bwa_monat")}</button>
    <button class="btn ghost sm fit" data-aktion="zeitraum-quartal" data-zeitraum-gruppe="${gruppe}">${t(zustand.sprache, "zr_quartal")}</button>
    <button class="btn ghost sm fit" data-aktion="zeitraum-jahr" data-zeitraum-gruppe="${gruppe}">${t(zustand.sprache, "zr_jahr")}</button>
  </div>`;
}

// ---------- BWA ----------

let bwaMonat = "";

function bwaZeileHtml(
  label: string,
  spalten: { monat: number; vormonat: number; vorjahresmonat: number; jahrKumuliert: number },
  prozentUmsatz: number,
  fett = false,
): string {
  const stil = fett ? ' style="font-weight:700;border-top:2px solid var(--ink)"' : "";
  return `<tr${stil}>
    <td>${t(zustand.sprache, label)}</td>
    <td class="num">${formatEur(spalten.monat)}</td>
    <td class="num">${formatEur(spalten.vormonat)}</td>
    <td class="num">${formatEur(spalten.vorjahresmonat)}</td>
    <td class="num">${formatEur(spalten.jahrKumuliert)}</td>
    <td class="num">${prozentUmsatz.toFixed(1)} %</td>
  </tr>`;
}

function renderBwa(): string {
  if (!bwaMonat) bwaMonat = heutigerMonat();
  const bericht = bwaBericht(zustand.buchungen, kontoVon, zustand.kleinunternehmer, bwaMonat);
  const umsatzMonat = bericht.zeilen[0]?.monat ?? 0;
  const prozent = (betrag: number) => (umsatzMonat !== 0 ? round2((betrag / umsatzMonat) * 100) : 0);

  const zeilenHtml: string[] = [];
  for (const zeile of bericht.zeilen) {
    zeilenHtml.push(bwaZeileHtml(zeile.label, zeile, zeile.prozentUmsatz));
    if (zeile.gruppe === "ware") zeilenHtml.push(bwaZeileHtml("bwa_rohertrag", bericht.rohertrag, prozent(bericht.rohertrag.monat), true));
    if (zeile.gruppe === "sonst")
      zeilenHtml.push(bwaZeileHtml("bwa_betriebsergebnis", bericht.betriebsergebnis, prozent(bericht.betriebsergebnis.monat), true));
    if (zeile.gruppe === "neutral")
      zeilenHtml.push(
        bwaZeileHtml("bwa_vorlaeufiges_ergebnis", bericht.vorlaeufigesErgebnis, prozent(bericht.vorlaeufigesErgebnis.monat), true),
      );
  }

  return (
    topbarTitel(t(zustand.sprache, "bwa"), `<input type="month" data-aktion="bwa-monat" value="${bwaMonat}">`) +
    `<div class="card"><div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "name")}</th>
      <th class="num">${t(zustand.sprache, "bwa_monat")}</th>
      <th class="num">${t(zustand.sprache, "bwa_vormonat")}</th>
      <th class="num">${t(zustand.sprache, "bwa_vorjahresmonat")}</th>
      <th class="num">${t(zustand.sprache, "bwa_jahr_kumuliert")}</th>
      <th class="num">${t(zustand.sprache, "bwa_prozent_umsatz")}</th>
    </tr></thead><tbody>${zeilenHtml.join("")}</tbody></table></div></div>`
  );
}

// ---------- EÜR ----------

function renderEuer(): string {
  const zr = zeitraumFuer("euer");
  const bericht = euerBericht(zustand.buchungen, kontoVon, zustand.kleinunternehmer, zr.von, zr.bis);

  const zeileHtml = (z: (typeof bericht.zeilen)[number]) => `<tr>
    <td>${z.euer_zeile ?? "—"}</td>
    <td>${escapeHtml(z.name)}</td>
    <td class="num">${formatEur(z.netto)} €</td>
  </tr>`;

  const einnahmenZeilen = bericht.zeilen.filter((z) => z.typ === "erloes");
  const ausgabenZeilen = bericht.zeilen.filter((z) => z.typ === "aufwand");

  const tabelle = (zeilen: EuerZeile[]) =>
    zeilen.length
      ? `<div class="tw"><table><thead><tr>
          <th>${t(zustand.sprache, "zeile")}</th><th>${t(zustand.sprache, "konto")}</th><th class="num">${t(zustand.sprache, "betrag")}</th>
        </tr></thead><tbody>${zeilen.map(zeileHtml).join("")}</tbody></table></div>`
      : `<div class="empty">${t(zustand.sprache, "keine")}</div>`;

  return (
    topbarTitel(t(zustand.sprache, "euer")) +
    `<div class="card">${zeitraumAuswahlHtml("euer")}</div>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "euer_einnahmen")}</h2>
      ${tabelle(einnahmenZeilen)}
      <div class="row" style="justify-content:flex-end;margin-top:8px"><b>${t(zustand.sprache, "summe")}: ${formatEur(bericht.summeEinnahmen)} €</b></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "euer_ausgaben")}</h2>
      ${tabelle(ausgabenZeilen)}
      <div class="row" style="justify-content:flex-end;margin-top:8px"><b>${t(zustand.sprache, "summe")}: ${formatEur(bericht.summeAusgaben)} €</b></div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2 style="margin:0">${t(zustand.sprache, "euer_gewinn")}</h2>
        <b class="${bericht.gewinn >= 0 ? "pos" : "neg"}" style="font-size:20px">${formatEur(bericht.gewinn)} €</b>
      </div>
    </div>
    ${
      bericht.privatZeilen.length
        ? `<div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "euer_privat_titel")}</h2>
      <div class="hint" style="margin-bottom:8px">${t(zustand.sprache, "euer_privat_hinweis")}</div>
      <div class="tw"><table><thead><tr><th>${t(zustand.sprache, "konto")}</th><th class="num">${t(zustand.sprache, "betrag")}</th></tr></thead>
        <tbody>${bericht.privatZeilen.map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="num">${formatEur(p.betrag)} €</td></tr>`).join("")}</tbody></table></div>
    </div>`
        : ""
    }`
  );
}

// ---------- USt-Voranmeldung ----------

function renderUstva(): string {
  const zr = zeitraumFuer("ustva");
  const b = ustVoranmeldung(zustand.buchungen, kontoVon, zustand.kleinunternehmer, zustand.versteuerung, zr.von, zr.bis);

  const kennzahl = (kz: string, label: string, betrag: number) =>
    `<tr><td>${kz}</td><td>${t(zustand.sprache, label)}</td><td class="num">${formatEur(betrag)} €</td></tr>`;

  return (
    topbarTitel(t(zustand.sprache, "ust")) +
    `<div class="card">${zeitraumAuswahlHtml("ustva")}</div>
    <div class="card" style="margin-top:16px"><div class="tw"><table><thead><tr>
      <th>Kz</th><th>${t(zustand.sprache, "name")}</th><th class="num">${t(zustand.sprache, "betrag")}</th>
    </tr></thead><tbody>
      ${kennzahl("81", "ustva_kz81", b.kz81)}
      ${kennzahl("86", "ustva_kz86", b.kz86)}
      ${kennzahl("83", "ustva_kz83", b.kz83)}
      ${kennzahl("66", "ustva_kz66", b.kz66)}
    </tbody></table></div></div>
    <div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between"><span>${t(zustand.sprache, "ustva_summe")}</span><b>${formatEur(b.umsatzsteuerGesamt)} €</b></div>
      <div class="row" style="justify-content:space-between;align-items:center;margin-top:8px">
        <h2 style="margin:0">${t(zustand.sprache, b.zahllast >= 0 ? "ustva_zahllast" : "ustva_erstattung")}</h2>
        <b class="${b.zahllast >= 0 ? "neg" : "pos"}" style="font-size:20px">${formatEur(Math.abs(b.zahllast))} €</b>
      </div>
    </div>
    <div class="hint" style="margin-top:12px">${t(zustand.sprache, "ustva_hinweis")}</div>`
  );
}

// ---------- Berichte: Journal, Summen-Saldenliste, Kontenblätter ----------

let berichteUnterAnsicht: "journal" | "salden" | "kontenblatt" = "journal";
let kontenblattKonto = "";

function berichteBuchungenGefiltert(): Buchung[] {
  const zr = zeitraumFuer("berichte");
  return zustand.buchungen.filter((b) => !b.storniert && b.datum >= zr.von && b.datum <= zr.bis);
}

function renderJournal(): string {
  const buchungen = [...berichteBuchungenGefiltert()].sort((a, b) => a.datum.localeCompare(b.datum));
  if (!buchungen.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "beleg")}</th><th>${t(zustand.sprache, "text")}</th>
      <th>${t(zustand.sprache, "konto")}</th><th>${t(zustand.sprache, "gegen")}</th>
      <th class="num">${t(zustand.sprache, "betrag")}</th><th class="num">${t(zustand.sprache, "satz")}</th>
    </tr></thead><tbody>
      ${buchungen
        .map(
          (b) => `<tr>
            <td>${b.datum.split("-").reverse().join(".")}</td><td>${escapeHtml(b.belegnr ?? "")}</td><td>${escapeHtml(b.text)}</td>
            <td>${escapeHtml(b.konto)}</td><td>${escapeHtml(b.gegenkonto)}</td>
            <td class="num">${formatEur(b.betrag_brutto)} €</td><td class="num">${b.ust_satz} %</td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderSaldenliste(): string {
  const zeilen = summenUndSalden(berichteBuchungenGefiltert(), kontoVon);
  if (!zeilen.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "konto")}</th><th>${t(zustand.sprache, "name")}</th>
      <th class="num">${t(zustand.sprache, "soll")}</th><th class="num">${t(zustand.sprache, "haben")}</th><th class="num">${t(zustand.sprache, "saldo")}</th>
    </tr></thead><tbody>
      ${zeilen
        .map(
          (z) => `<tr>
            <td>${escapeHtml(z.konto)}</td><td>${escapeHtml(z.name)}</td>
            <td class="num">${formatEur(z.soll)}</td><td class="num">${formatEur(z.haben)}</td>
            <td class="num ${z.saldo >= 0 ? "" : "neg"}">${formatEur(z.saldo)}</td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderKontenblattAnsicht(): string {
  const auswahl = `<select data-aktion="kontenblatt-konto-waehlen">
    <option value="">${t(zustand.sprache, "konto_waehlen")}</option>
    ${zustand.konten
      .slice()
      .sort((a, b) => a.nr.localeCompare(b.nr))
      .map((k) => `<option value="${escapeHtml(k.nr)}" ${kontenblattKonto === k.nr ? "selected" : ""}>${escapeHtml(k.nr)} – ${escapeHtml(k.name)}</option>`)
      .join("")}
  </select>`;
  if (!kontenblattKonto) return `<div style="margin-bottom:12px">${auswahl}</div><div class="empty">${t(zustand.sprache, "keine")}</div>`;
  const zeilen = kontenblatt(berichteBuchungenGefiltert(), kontoVon, kontenblattKonto);
  return `<div style="margin-bottom:12px">${auswahl}</div>
    ${
      zeilen.length
        ? `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "beleg")}</th><th>${t(zustand.sprache, "text")}</th><th>${t(zustand.sprache, "gegen")}</th>
      <th class="num">${t(zustand.sprache, "soll")}</th><th class="num">${t(zustand.sprache, "haben")}</th><th class="num">${t(zustand.sprache, "saldo")}</th>
    </tr></thead><tbody>
      ${zeilen
        .map(
          (z) => `<tr>
            <td>${z.datum.split("-").reverse().join(".")}</td><td>${escapeHtml(z.belegnr)}</td><td>${escapeHtml(z.text)}</td><td>${escapeHtml(z.gegenkonto)}</td>
            <td class="num">${z.soll ? formatEur(z.soll) : ""}</td><td class="num">${z.haben ? formatEur(z.haben) : ""}</td>
            <td class="num ${z.saldo >= 0 ? "" : "neg"}"><b>${formatEur(z.saldo)}</b></td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`
        : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
    }`;
}

function renderBerichte(): string {
  const tabs: { key: typeof berichteUnterAnsicht; label: string }[] = [
    { key: "journal", label: "journal_titel" },
    { key: "salden", label: "saldenliste_titel" },
    { key: "kontenblatt", label: "kontenblatt_titel" },
  ];
  const inhalt =
    berichteUnterAnsicht === "journal" ? renderJournal() : berichteUnterAnsicht === "salden" ? renderSaldenliste() : renderKontenblattAnsicht();
  return (
    topbarTitel(t(zustand.sprache, "berichte")) +
    `<div class="seg" style="margin-bottom:16px">${tabs
      .map(
        (tb) =>
          `<button data-aktion="berichte-tab" data-unteransicht="${tb.key}" class="${berichteUnterAnsicht === tb.key ? "on" : ""}">${t(zustand.sprache, tb.label)}</button>`,
      )
      .join("")}</div>
    <div class="card">${zeitraumAuswahlHtml("berichte")}</div>
    <div class="card" style="margin-top:16px">${inhalt}</div>`
  );
}

// ---------- Diagramme ----------

const DIAGRAMM_PALETTE = [
  "#f6ce45",
  "#e0524f",
  "#3ba55c",
  "#2a5ca5",
  "#a33b58",
  "#8c9199",
  "#7b61ff",
  "#00b8a9",
  "#ff8c42",
  "#6b4226",
  "#41454d",
  "#c9184a",
];

function svgLinienChart(reihen: { label: string; farbe: string; werte: number[] }[], beschriftungen: string[]): string {
  const breite = 720;
  const hoehe = 200;
  const padLinks = 16;
  const padUnten = 26;
  const padOben = 16;
  const padRechts = 16;
  const innenBreite = breite - padLinks - padRechts;
  const innenHoehe = hoehe - padOben - padUnten;

  const alleWerte = reihen.flatMap((r) => r.werte);
  const max = Math.max(0, ...alleWerte);
  const min = Math.min(0, ...alleWerte);
  const spanne = max - min || 1;

  const x = (i: number) => padLinks + (innenBreite * i) / Math.max(1, beschriftungen.length - 1);
  const y = (wert: number) => padOben + innenHoehe - ((wert - min) / spanne) * innenHoehe;
  const nulllinieY = y(0);

  const pfade = reihen
    .map((reihe) => {
      const punkte = reihe.werte.map((w, i) => `${x(i)},${y(w)}`).join(" ");
      const punkteKreise = reihe.werte.map((w, i) => `<circle cx="${x(i)}" cy="${y(w)}" r="3" fill="${reihe.farbe}"/>`).join("");
      return `<polyline points="${punkte}" fill="none" stroke="${reihe.farbe}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${punkteKreise}`;
    })
    .join("");

  const beschriftungenHtml = beschriftungen
    .map((b, i) => `<text x="${x(i)}" y="${hoehe - 6}" font-size="10" fill="var(--muted)" text-anchor="middle">${escapeHtml(b)}</text>`)
    .join("");

  const legende = reihen
    .map(
      (r) => `<span style="display:inline-flex;align-items:center;gap:6px;margin-inline-end:16px">
      <span style="width:10px;height:10px;border-radius:50%;background:${r.farbe};display:inline-block"></span>${escapeHtml(r.label)}
    </span>`,
    )
    .join("");

  return `<div class="hint" style="margin-bottom:8px;display:flex;flex-wrap:wrap">${legende}</div>
    <svg viewBox="0 0 ${breite} ${hoehe}" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">
      <line x1="${padLinks}" y1="${nulllinieY}" x2="${breite - padRechts}" y2="${nulllinieY}" stroke="var(--line)" stroke-width="1"/>
      ${pfade}
      ${beschriftungenHtml}
    </svg>`;
}

function svgBalkenChart(werte: { label: string; wert: number }[]): string {
  const breite = 720;
  const hoehe = 200;
  const padLinks = 8;
  const padUnten = 26;
  const padOben = 16;
  const padRechts = 8;
  const innenBreite = breite - padLinks - padRechts;
  const innenHoehe = hoehe - padOben - padUnten;

  const alle = werte.map((w) => w.wert);
  const max = Math.max(0, ...alle);
  const min = Math.min(0, ...alle);
  const spanne = max - min || 1;
  const nulllinieY = padOben + innenHoehe - ((0 - min) / spanne) * innenHoehe;

  const breitePerBalken = innenBreite / Math.max(1, werte.length);
  const balkenBreite = breitePerBalken * 0.6;

  const balken = werte
    .map((w, i) => {
      const balkenY = padOben + innenHoehe - ((w.wert - min) / spanne) * innenHoehe;
      const bx = padLinks + i * breitePerBalken + (breitePerBalken - balkenBreite) / 2;
      const by = Math.min(balkenY, nulllinieY);
      const bh = Math.max(Math.abs(balkenY - nulllinieY), 1);
      const farbe = w.wert >= 0 ? "var(--pos)" : "var(--neg)";
      return `<rect x="${bx}" y="${by}" width="${balkenBreite}" height="${bh}" fill="${farbe}" rx="3"/>
        <text x="${bx + balkenBreite / 2}" y="${hoehe - 6}" font-size="10" fill="var(--muted)" text-anchor="middle">${escapeHtml(w.label)}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${breite} ${hoehe}" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">
    <line x1="${padLinks}" y1="${nulllinieY}" x2="${breite - padRechts}" y2="${nulllinieY}" stroke="var(--line)" stroke-width="1"/>
    ${balken}
  </svg>`;
}

function svgDonutChart(anteile: { label: string; wert: number; farbe: string }[]): string {
  const groesse = 220;
  const radius = 80;
  const innenRadius = 46;
  const mitte = groesse / 2;
  const gesamt = anteile.reduce((s, a) => s + Math.abs(a.wert), 0) || 1;

  let winkelStart = -Math.PI / 2;
  const segmente = anteile
    .map((a) => {
      const anteil = Math.abs(a.wert) / gesamt;
      const winkelEnde = winkelStart + anteil * Math.PI * 2;
      const grossBogen = winkelEnde - winkelStart > Math.PI ? 1 : 0;
      const x1 = mitte + radius * Math.cos(winkelStart);
      const y1 = mitte + radius * Math.sin(winkelStart);
      const x2 = mitte + radius * Math.cos(winkelEnde);
      const y2 = mitte + radius * Math.sin(winkelEnde);
      const ix1 = mitte + innenRadius * Math.cos(winkelEnde);
      const iy1 = mitte + innenRadius * Math.sin(winkelEnde);
      const ix2 = mitte + innenRadius * Math.cos(winkelStart);
      const iy2 = mitte + innenRadius * Math.sin(winkelStart);
      const pfad = `M ${x1} ${y1} A ${radius} ${radius} 0 ${grossBogen} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innenRadius} ${innenRadius} 0 ${grossBogen} 0 ${ix2} ${iy2} Z`;
      winkelStart = winkelEnde;
      return `<path d="${pfad}" fill="${a.farbe}"/>`;
    })
    .join("");

  const legende = anteile
    .map(
      (a) => `<div class="row" style="gap:8px;align-items:center">
        <span class="fit" style="width:10px;height:10px;border-radius:50%;background:${a.farbe};display:inline-block"></span>
        <span>${escapeHtml(a.label)}</span><b class="fit">${formatEur(a.wert)} €</b>
      </div>`,
    )
    .join("");

  return `<div class="row" style="gap:24px;flex-wrap:wrap;align-items:center">
    <svg viewBox="0 0 ${groesse} ${groesse}" style="width:200px;height:200px;flex-shrink:0">${segmente}</svg>
    <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px">${legende}</div>
  </div>`;
}

function renderDiagramme(): string {
  const bisMonat = heutigerMonat();
  const reihe = monatsReihe(zustand.buchungen, kontoVon, zustand.kleinunternehmer, zustand.versteuerung, bisMonat, 12);
  const beschriftungen = reihe.map((r) => `${r.monat.slice(5)}.${r.monat.slice(2, 4)}`);

  const umsatzverlauf = svgLinienChart(
    [{ label: t(zustand.sprache, "bwa_umsatz"), farbe: "var(--pos)", werte: reihe.map((r) => r.umsatz) }],
    beschriftungen,
  );

  const ergebnisChart = svgBalkenChart(reihe.map((r, i) => ({ label: beschriftungen[i], wert: r.ergebnis })));

  const kasseReihe = reihe.map((r) => kassenstand(zustand.buchungen, zustand.kassenAnfangsbestand, "1000", kontoVon, monatsSpanne(r.monat).bis));
  const bankReihe = reihe.map((r) => kassenstand(zustand.buchungen, 0, "1200", kontoVon, monatsSpanne(r.monat).bis));
  const kasseUndBank = svgLinienChart(
    [
      { label: t(zustand.sprache, "kasse"), farbe: "var(--pos)", werte: kasseReihe },
      { label: "Bank", farbe: "#2a5ca5", werte: bankReihe },
    ],
    beschriftungen,
  );

  const personalChart = svgLinienChart(
    [
      { label: t(zustand.sprache, "bwa_umsatz"), farbe: "var(--pos)", werte: reihe.map((r) => r.umsatz) },
      { label: t(zustand.sprache, "bwa_personal"), farbe: "#a33b58", werte: reihe.map((r) => r.personalkosten) },
    ],
    beschriftungen,
  );

  const vorjahrBisMonat = monatVerschieben(bisMonat, -12);
  const vorjahrReihe = monatsReihe(zustand.buchungen, kontoVon, zustand.kleinunternehmer, zustand.versteuerung, vorjahrBisMonat, 12);
  const monatsNamen = beschriftungen.map((_, i) => `M${i + 1}`);
  const vorjahresvergleich = svgLinienChart(
    [
      { label: t(zustand.sprache, "diag_vj_aktuell"), farbe: "var(--pos)", werte: reihe.map((r) => r.umsatz) },
      { label: t(zustand.sprache, "diag_vj_vorjahr"), farbe: "var(--muted)", werte: vorjahrReihe.map((r) => r.umsatz) },
    ],
    monatsNamen,
  );

  const ustChart = svgBalkenChart(reihe.map((r, i) => ({ label: beschriftungen[i], wert: r.ustZahllast })));

  const gruppenAktuellerMonat = summenNachGruppe(
    zustand.buchungen.filter((b) => b.datum.startsWith(bisMonat)),
    kontoVon,
    zustand.kleinunternehmer,
  );
  const kostenGruppen = BWA_GRUPPEN.filter((g) => g.gruppe !== "umsatz" && (gruppenAktuellerMonat[g.gruppe] ?? 0) !== 0);
  const kostenverteilung = kostenGruppen.length
    ? svgDonutChart(
        kostenGruppen.map((g, i) => ({
          label: t(zustand.sprache, g.label),
          wert: Math.abs(gruppenAktuellerMonat[g.gruppe] ?? 0),
          farbe: DIAGRAMM_PALETTE[i % DIAGRAMM_PALETTE.length],
        })),
      )
    : `<div class="empty">${t(zustand.sprache, "keine")}</div>`;

  const karte = (titel: string, inhalt: string) => `<div class="card" style="margin-top:16px"><h2 style="margin-top:0">${t(zustand.sprache, titel)}</h2>${inhalt}</div>`;

  return (
    topbarTitel(t(zustand.sprache, "diagramme")) +
    karte("diag_umsatzverlauf", umsatzverlauf) +
    karte("diag_ergebnis", ergebnisChart) +
    karte("diag_kasse_bank", kasseUndBank) +
    karte("diag_personal", personalChart) +
    karte("diag_vorjahresvergleich", vorjahresvergleich) +
    karte("diag_ustverlauf", ustChart) +
    karte("diag_kostenverteilung", kostenverteilung)
  );
}

// ---------- Belegablage (Kassenbericht, Rechnungen, Belege für den Steuerberater) ----------

let belegablageMonat = "";

const DOKUMENT_TYP_LABEL: Record<DokumentTyp, string> = {
  kassenbericht: "dok_typ_kassenbericht",
  rechnung: "dok_typ_rechnung",
  beleg: "dok_typ_beleg",
  sonstiges: "dok_typ_sonstiges",
};

function dokumentTypOptionen(ausgewaehlt: DokumentTyp): string {
  return (Object.keys(DOKUMENT_TYP_LABEL) as DokumentTyp[])
    .map((typ) => `<option value="${typ}" ${ausgewaehlt === typ ? "selected" : ""}>${t(zustand.sprache, DOKUMENT_TYP_LABEL[typ])}</option>`)
    .join("");
}

function belegablageListeHtml(): string {
  const zeilen = zustand.dokumente.filter((d) => d.datum.startsWith(belegablageMonat));
  if (!zeilen.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "dok_typ")}</th><th>${t(zustand.sprache, "name")}</th><th></th>
    </tr></thead><tbody>
      ${zeilen
        .map(
          (d) => `<tr>
            <td>${d.datum.split("-").reverse().join(".")}</td>
            <td>${t(zustand.sprache, DOKUMENT_TYP_LABEL[d.typ])}</td>
            <td>
              <button class="btn ghost sm" data-aktion="dokument-oeffnen" data-id="${escapeHtml(d.id)}" style="padding:2px 0;box-shadow:none;background:none;color:var(--ink);font-weight:600">${escapeHtml(d.dateiname)}</button>
              <br><span class="hint">${formatGroesse(d.groesse)}</span>
            </td>
            <td style="text-align:end"><button class="btn danger sm" data-aktion="dokument-loeschen" data-id="${escapeHtml(d.id)}">${icon("trash")}</button></td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderBelegablage(): string {
  if (!belegablageMonat) belegablageMonat = heutigerMonat();
  return (
    topbarTitel(t(zustand.sprache, "belegablage")) +
    `<div class="card">
      <h2 style="margin-top:0">${t(zustand.sprache, "dokument_hochladen")}</h2>
      <div class="row" style="align-items:flex-end;flex-wrap:wrap">
        <div><label class="f">${t(zustand.sprache, "date")}</label><input type="date" id="dok-datum" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div><label class="f">${t(zustand.sprache, "dok_typ")}</label><select id="dok-typ">${dokumentTypOptionen("sonstiges")}</select></div>
      </div>
      <div style="margin-top:12px">
        <input type="file" multiple accept="${ERLAUBTE_DATEI_TYPEN}" data-aktion="dokument-datei-gewaehlt">
        <div class="hint" style="margin-top:6px">${t(zustand.sprache, "belegablage_hinweis_typen")}</div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap">
        <div><label class="f">${t(zustand.sprache, "bwa_monat")}</label><input type="month" data-aktion="belegablage-monat" value="${belegablageMonat}"></div>
        <button class="btn fit" data-aktion="monatspaket-herunterladen">${icon("doc")}${t(zustand.sprache, "monatspaket_herunterladen")}</button>
      </div>
      <div style="margin-top:16px">${belegablageListeHtml()}</div>
    </div>`
  );
}

async function dokumenteHochladen(dateien: FileList): Promise<void> {
  const datum = document.querySelector<HTMLInputElement>("#dok-datum")?.value || new Date().toISOString().slice(0, 10);
  const typ = (document.querySelector<HTMLSelectElement>("#dok-typ")?.value as DokumentTyp) ?? "sonstiges";
  for (const datei of Array.from(dateien)) {
    const inhalt = new Uint8Array(await datei.arrayBuffer());
    await zustand.repo.dokumentHinzufuegen({
      typ,
      datum,
      dateiname: datei.name,
      mime: datei.type || mimeVonDateiname(datei.name),
      inhalt,
    });
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function dokumentOeffnen(id: string): Promise<void> {
  const dokument = zustand.dokumente.find((d) => d.id === id);
  if (!dokument) return;
  const blob = await zustand.repo.dokumentInhalt(dokument);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function dokumentLoeschenAktion(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.dokumentLoeschen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

async function monatspaketHerunterladen(): Promise<void> {
  const eintraege = paketEintraege(zustand.dokumente, belegablageMonat);
  const buchungenMonat = buchungenDesMonats(zustand.buchungen, belegablageMonat);
  if (!eintraege.length && !buchungenMonat.length) {
    zeigeMeldung(t(zustand.sprache, "monatspaket_leer"));
    return;
  }
  const dateien: Zippable = {};
  for (const eintrag of eintraege) {
    const blob = await zustand.repo.dokumentInhalt(eintrag.dokument);
    dateien[eintrag.zipPfad] = new Uint8Array(await blob.arrayBuffer());
  }
  if (buchungenMonat.length) {
    dateien[`Buchungen_${belegablageMonat}.csv`] = new TextEncoder().encode(buchungenZuCsv(buchungenMonat));
  }
  const zip = zipSync(dateien);
  ladeDateiHerunter(zip, `Monatspaket_${belegablageMonat}.zip`, "application/zip");
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

// ---------- Mitarbeiter ----------

const BESCHAEFTIGUNGSART_LABEL: Record<Beschaeftigungsart, string> = {
  minijob: "besch_minijob",
  teilzeit: "besch_teilzeit",
  vollzeit: "besch_vollzeit",
  aushilfe: "besch_aushilfe",
};

function renderMitarbeiter(): string {
  const sortiert = [...zustand.mitarbeiter].sort((a, b) => a.name.localeCompare(b.name));
  return (
    topbarTitel(
      t(zustand.sprache, "ma"),
      `<button class="btn" data-aktion="mitarbeiter-neu">${icon("plus")}${t(zustand.sprache, "neu")}</button>`,
    ) +
    `<div class="card">${
      sortiert.length
        ? `<div class="tw"><table><thead><tr>
            <th>${t(zustand.sprache, "name")}</th><th>${t(zustand.sprache, "beschaeftigungsart")}</th>
            <th class="num">${t(zustand.sprache, "stundenlohn")}</th><th class="num">${t(zustand.sprache, "wochenstunden")}</th>
            <th>${t(zustand.sprache, "status")}</th><th></th>
          </tr></thead><tbody>
            ${sortiert
              .map(
                (m) => `<tr>
                  <td><b>${escapeHtml(m.name)}</b>${m.personalnr ? `<br><span class="hint">${escapeHtml(m.personalnr)}</span>` : ""}</td>
                  <td>${t(zustand.sprache, BESCHAEFTIGUNGSART_LABEL[m.beschaeftigungsart])}</td>
                  <td class="num">${formatEur(m.stundenlohn)} €</td>
                  <td class="num">${m.wochenstunden}</td>
                  <td><span class="pill ${m.aktiv ? "g" : "r"}">${t(zustand.sprache, m.aktiv ? "aktiv" : "inaktiv")}</span></td>
                  <td style="text-align:end;white-space:nowrap">
                    <button class="btn ghost sm" data-aktion="mitarbeiter-bearbeiten" data-id="${escapeHtml(m.id)}">${icon("edit")}</button>
                    <button class="btn danger sm" data-aktion="mitarbeiter-loeschen" data-id="${escapeHtml(m.id)}">${icon("trash")}</button>
                  </td>
                </tr>`,
              )
              .join("")}
          </tbody></table></div>`
        : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
    }</div>`
  );
}

function mitarbeiterFormular(id?: string): void {
  const bestehend = id ? zustand.mitarbeiter.find((m) => m.id === id) : undefined;
  const m = bestehend ?? {
    id: "",
    name: "",
    personalnr: "",
    rolle: "",
    beschaeftigungsart: "minijob" as const,
    eintritt: new Date().toISOString().slice(0, 10),
    austritt: undefined as string | undefined,
    stundenlohn: 0,
    wochenstunden: 0,
    urlaubstage_jahr: 20,
    aktiv: true,
    benutzer_id: undefined as string | undefined,
  };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "neu")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div style="flex:2"><label class="f">${t(zustand.sprache, "name")}</label><input id="f-name" value="${escapeHtml(m.name)}"></div>
      <div><label class="f">${t(zustand.sprache, "personalnr")}</label><input id="f-personalnr" value="${escapeHtml(m.personalnr ?? "")}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "rolle")}</label><input id="f-rolle" value="${escapeHtml(m.rolle)}" placeholder="Verkauf"></div>
      <div><label class="f">${t(zustand.sprache, "beschaeftigungsart")}</label>
        <select id="f-beschaeftigungsart">
          ${(["minijob", "teilzeit", "vollzeit", "aushilfe"] as const)
            .map((x) => `<option value="${x}" ${m.beschaeftigungsart === x ? "selected" : ""}>${t(zustand.sprache, BESCHAEFTIGUNGSART_LABEL[x])}</option>`)
            .join("")}
        </select></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "eintritt")}</label><input type="date" id="f-eintritt" value="${m.eintritt}"></div>
      <div><label class="f">${t(zustand.sprache, "austritt")}</label><input type="date" id="f-austritt" value="${m.austritt ?? ""}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "stundenlohn")}</label><input id="f-stundenlohn" value="${m.stundenlohn || ""}" placeholder="12,50"></div>
      <div><label class="f">${t(zustand.sprache, "wochenstunden")}</label><input id="f-wochenstunden" value="${m.wochenstunden || ""}" placeholder="10"></div>
      <div><label class="f">${t(zustand.sprache, "urlaubstage_jahr")}</label><input id="f-urlaubstage" value="${m.urlaubstage_jahr || ""}" placeholder="20"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "benutzerkonto_verknuepfen")}</label>
        <select id="f-benutzer-verknuepfung">
          <option value="">${t(zustand.sprache, "ohne_verknuepfung")}</option>
          ${zustand.benutzerListe
            .map((b) => `<option value="${escapeHtml(b.id)}" ${m.benutzer_id === b.id ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
            .join("")}
        </select></div>
      <label class="f" style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:24px">
        <input type="checkbox" id="f-aktiv" ${m.aktiv ? "checked" : ""}> ${t(zustand.sprache, "aktiv")}
      </label>
    </div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="mitarbeiter-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function mitarbeiterSpeichern(id: string): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#f-name")?.value.trim() ?? "";
  const eintritt = document.querySelector<HTMLInputElement>("#f-eintritt")?.value ?? "";
  if (!name || !eintritt) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await zustand.repo.mitarbeiterSpeichern({
    id: id || uid(),
    name,
    personalnr: document.querySelector<HTMLInputElement>("#f-personalnr")?.value.trim() || undefined,
    rolle: document.querySelector<HTMLInputElement>("#f-rolle")?.value.trim() ?? "",
    beschaeftigungsart: (document.querySelector<HTMLSelectElement>("#f-beschaeftigungsart")?.value ?? "minijob") as Beschaeftigungsart,
    eintritt,
    austritt: document.querySelector<HTMLInputElement>("#f-austritt")?.value || undefined,
    stundenlohn: parseNumber(document.querySelector<HTMLInputElement>("#f-stundenlohn")?.value),
    wochenstunden: parseNumber(document.querySelector<HTMLInputElement>("#f-wochenstunden")?.value),
    urlaubstage_jahr: Math.round(parseNumber(document.querySelector<HTMLInputElement>("#f-urlaubstage")?.value)),
    aktiv: document.querySelector<HTMLInputElement>("#f-aktiv")?.checked ?? true,
    benutzer_id: document.querySelector<HTMLSelectElement>("#f-benutzer-verknuepfung")?.value || undefined,
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function mitarbeiterLoeschen(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  const ergebnis = await zustand.repo.mitarbeiterLoeschen(id);
  if (!ergebnis.ok) {
    zeigeMeldung(ergebnis.grund ?? t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

// ---------- Zeiterfassung ----------

let stundenMitarbeiterId = "";
let stundenMonat = "";

const ZEITEINTRAG_ART_LABEL: Record<ZeiteintragArt, string> = {
  arbeit: "art_arbeit",
  urlaub: "art_urlaub",
  krank: "art_krank",
  feiertag: "art_feiertag",
  frei: "art_frei",
};

const ZEITEINTRAG_STATUS_LABEL: Record<ZeiteintragStatus, string> = {
  entwurf: "zstatus_entwurf",
  eingereicht: "zstatus_eingereicht",
  freigegeben: "zstatus_freigegeben",
  abgelehnt: "zstatus_abgelehnt",
};

const ZEITEINTRAG_STATUS_PILL: Record<ZeiteintragStatus, string> = {
  entwurf: "b",
  eingereicht: "y",
  freigegeben: "g",
  abgelehnt: "r",
};

const ZUSCHLAG_ART_LABEL: Record<Zuschlagsregel["art"], string> = {
  nacht: "zuschlag_nacht",
  sonntag: "zuschlag_sonntag",
  feiertag: "zuschlag_feiertag",
};

function renderZuschlagsregeln(): string {
  if (!zustand.zuschlagsregeln.length) return `<div class="empty">${t(zustand.sprache, "keine")}</div>`;
  return `<div class="tw"><table><thead><tr>
      <th>${t(zustand.sprache, "art")}</th><th>${t(zustand.sprache, "von")}</th><th>${t(zustand.sprache, "bis")}</th>
      <th class="num">%</th><th>${t(zustand.sprache, "aktiv")}</th><th></th>
    </tr></thead><tbody>
      ${zustand.zuschlagsregeln
        .map(
          (r) => `<tr>
            <td>${t(zustand.sprache, ZUSCHLAG_ART_LABEL[r.art])}</td>
            <td>${r.von_uhrzeit ?? "—"}</td><td>${r.bis_uhrzeit ?? "—"}</td>
            <td class="num">${r.prozent} %</td><td>${r.aktiv ? "✓" : "—"}</td>
            <td style="text-align:end;white-space:nowrap">
              <button class="btn ghost sm" data-aktion="zuschlagsregel-bearbeiten" data-id="${escapeHtml(r.id)}">${icon("edit")}</button>
              <button class="btn danger sm" data-aktion="zuschlagsregel-loeschen" data-id="${escapeHtml(r.id)}">${icon("trash")}</button>
            </td>
          </tr>`,
        )
        .join("")}
    </tbody></table></div>`;
}

function renderStunden(): string {
  if (!stundenMonat) stundenMonat = heutigerMonat();
  const istInhaberSicht = darfFremdeStundenSehen(zustand.benutzer.rolle);
  const darfFreigeben = darfStundenFreigeben(zustand.benutzer.rolle);

  if (istInhaberSicht) {
    if (!stundenMitarbeiterId && zustand.mitarbeiter.length) stundenMitarbeiterId = zustand.mitarbeiter[0].id;
  } else {
    stundenMitarbeiterId = zustand.mitarbeiter.find((m) => m.benutzer_id === zustand.benutzer.id)?.id ?? "";
  }

  const mitarbeiterAuswahl = istInhaberSicht
    ? `<select data-aktion="stunden-mitarbeiter-waehlen">
    <option value="">${t(zustand.sprache, "mitarbeiter_waehlen")}</option>
    ${zustand.mitarbeiter
      .map((m) => `<option value="${escapeHtml(m.id)}" ${stundenMitarbeiterId === m.id ? "selected" : ""}>${escapeHtml(m.name)}</option>`)
      .join("")}
  </select>`
    : "";

  if (!istInhaberSicht && !stundenMitarbeiterId) {
    return topbarTitel(t(zustand.sprache, "std")) + `<div class="card"><div class="empty">${t(zustand.sprache, "kein_mitarbeiter_verknuepft")}</div></div>`;
  }

  const mitarbeiter = zustand.mitarbeiter.find((m) => m.id === stundenMitarbeiterId);
  const eintraege = zustand.zeiteintraege
    .filter((z) => z.mitarbeiter_id === stundenMitarbeiterId && z.datum.startsWith(stundenMonat))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const jahr = Number(stundenMonat.slice(0, 4));
  const feiertage = feiertageNrw(jahr);
  const pruefeFeiertag = (datum: string) => istFeiertag(datum, feiertage);
  const regeln = zustand.zuschlagsregeln;

  const zeilenHtml = eintraege.length
    ? `<div class="tw"><table><thead><tr>
        <th>${t(zustand.sprache, "date")}</th><th>${t(zustand.sprache, "art")}</th><th>${t(zustand.sprache, "zeiten")}</th>
        <th class="num">${t(zustand.sprache, "stunden")}</th><th class="num">${t(zustand.sprache, "bruttolohn")}</th>
        <th>${t(zustand.sprache, "status")}</th><th></th>
      </tr></thead><tbody>
        ${eintraege
          .map((z) => {
            const warnung = warnungZehnStunden(z.stunden);
            const lohn = mitarbeiter ? bruttolohnFuerEintrag(z, mitarbeiter.stundenlohn, regeln, pruefeFeiertag) : 0;
            return `<tr>
              <td>${z.datum.split("-").reverse().join(".")}</td>
              <td>${t(zustand.sprache, ZEITEINTRAG_ART_LABEL[z.art])}</td>
              <td>${z.art === "arbeit" && z.von && z.bis ? `${z.von}–${z.bis}` : "—"}</td>
              <td class="num">${z.stunden}${warnung ? ` <span class="pill y" title="${t(zustand.sprache, "warnung_zehn_stunden")}">!</span>` : ""}</td>
              <td class="num">${formatEur(lohn)} €</td>
              <td><span class="pill ${ZEITEINTRAG_STATUS_PILL[z.status]}">${t(zustand.sprache, ZEITEINTRAG_STATUS_LABEL[z.status])}</span></td>
              <td style="text-align:end;white-space:nowrap">
                ${z.status === "entwurf" ? `<button class="btn ghost sm" data-aktion="zeiteintrag-bearbeiten" data-id="${z.id}">${icon("edit")}</button>` : ""}
                ${z.status === "entwurf" ? `<button class="btn ghost sm" data-aktion="zeiteintrag-einreichen" data-id="${z.id}">${t(zustand.sprache, "einreichen")}</button>` : ""}
                ${z.status === "eingereicht" && darfFreigeben ? `<button class="btn ghost sm" data-aktion="zeiteintrag-freigeben" data-id="${z.id}">${t(zustand.sprache, "freigeben")}</button>` : ""}
                ${z.status === "eingereicht" && darfFreigeben ? `<button class="btn ghost sm" data-aktion="zeiteintrag-ablehnen" data-id="${z.id}">${t(zustand.sprache, "ablehnen")}</button>` : ""}
                ${z.status === "entwurf" || z.status === "abgelehnt" ? `<button class="btn danger sm" data-aktion="zeiteintrag-loeschen" data-id="${z.id}">${icon("trash")}</button>` : ""}
              </td>
            </tr>`;
          })
          .join("")}
      </tbody></table></div>`
    : `<div class="empty">${t(zustand.sprache, "keine")}</div>`;

  const summeStunden = round2(eintraege.reduce((s, z) => s + z.stunden, 0));
  const summeLohn = mitarbeiter
    ? round2(eintraege.reduce((s, z) => s + bruttolohnFuerEintrag(z, mitarbeiter.stundenlohn, regeln, pruefeFeiertag), 0))
    : 0;

  return (
    topbarTitel(
      t(zustand.sprache, "std"),
      `<button class="btn" data-aktion="zeiteintrag-neu">${icon("plus")}${t(zustand.sprache, "addb")}</button>`,
    ) +
    `<div class="card">
      <div class="row" style="align-items:flex-end;flex-wrap:wrap">
        <div><label class="f">${t(zustand.sprache, "ma")}</label>${mitarbeiterAuswahl}</div>
        <div><label class="f">${t(zustand.sprache, "bwa_monat")}</label><input type="month" data-aktion="stunden-monat" value="${stundenMonat}"></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">${zeilenHtml}
      ${
        eintraege.length
          ? `<div class="row" style="margin-top:14px;justify-content:flex-end;gap:24px">
        <span class="fit hint">${t(zustand.sprache, "stunden")} <b>${summeStunden}</b></span>
        <span class="fit hint">${t(zustand.sprache, "bruttolohn")} <b>${formatEur(summeLohn)} €</b></span>
      </div>`
          : ""
      }
    </div>
    ${
      darfFreigeben
        ? `<div class="card" style="margin-top:16px">
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2 style="margin:0">${t(zustand.sprache, "zuschlagsregeln_titel")}</h2>
        <div class="row fit" style="gap:8px">
          <button class="btn ghost sm" data-aktion="zuschlagsregeln-laden">${t(zustand.sprache, "standardregeln_laden")}</button>
          <button class="btn sm" data-aktion="zuschlagsregel-neu">${icon("plus")}${t(zustand.sprache, "zuschlagsregel_neu")}</button>
        </div>
      </div>
      <div style="margin-top:12px">${renderZuschlagsregeln()}</div>
    </div>`
        : ""
    }`
  );
}

function zeiteintragArtGeaendert(): void {
  const art = document.querySelector<HTMLSelectElement>("#f-art")?.value;
  const arbeitFelder = document.querySelector<HTMLDivElement>("#f-arbeit-felder");
  if (arbeitFelder) arbeitFelder.hidden = art !== "arbeit";
}

function erfassungsartWaehlen(modus: "zeiten" | "stunden"): void {
  const zeitenGruppe = document.querySelector<HTMLDivElement>("#f-zeiten-gruppe");
  const stundenGruppe = document.querySelector<HTMLDivElement>("#f-stunden-gruppe");
  if (zeitenGruppe) zeitenGruppe.hidden = modus !== "zeiten";
  if (stundenGruppe) stundenGruppe.hidden = modus !== "stunden";
  document.querySelectorAll<HTMLButtonElement>("[data-aktion='erfassungsart-waehlen']").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.modus === modus);
  });
}

function zeiteintragFormular(id?: string): void {
  const bestehend = id ? zustand.zeiteintraege.find((z) => z.id === id) : undefined;
  const z = bestehend ?? {
    id: "",
    mitarbeiter_id: stundenMitarbeiterId,
    datum: new Date().toISOString().slice(0, 10),
    von: undefined as string | undefined,
    bis: undefined as string | undefined,
    pause_min: 0,
    stunden: 0,
    art: "arbeit" as ZeiteintragArt,
    notiz: "",
    status: "entwurf" as ZeiteintragStatus,
  };
  // Neue Einträge starten im Kommen/Gehen-Modus (SPEC.md 5.7 nennt ihn zuerst);
  // beim Bearbeiten wird der ursprünglich genutzte Modus anhand der vorhandenen
  // Felder erkannt.
  const erfassungsart = !bestehend || z.von || z.bis ? "zeiten" : "stunden";
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "addb")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "date")}</label><input type="date" id="f-datum" value="${z.datum}"></div>
      <div><label class="f">${t(zustand.sprache, "art")}</label>
        <select id="f-art" data-aktion="zeiteintrag-art-geaendert">
          ${(["arbeit", "urlaub", "krank", "feiertag", "frei"] as const)
            .map((x) => `<option value="${x}" ${z.art === x ? "selected" : ""}>${t(zustand.sprache, ZEITEINTRAG_ART_LABEL[x])}</option>`)
            .join("")}
        </select></div>
    </div>
    <div id="f-arbeit-felder" ${z.art !== "arbeit" ? "hidden" : ""}>
      <div class="row" style="margin-top:12px">
        <div class="seg fit">
          <button type="button" data-aktion="erfassungsart-waehlen" data-modus="zeiten" class="${erfassungsart === "zeiten" ? "on" : ""}">${t(zustand.sprache, "erfassung_zeiten")}</button>
          <button type="button" data-aktion="erfassungsart-waehlen" data-modus="stunden" class="${erfassungsart === "stunden" ? "on" : ""}">${t(zustand.sprache, "erfassung_stundenzahl")}</button>
        </div>
      </div>
      <div id="f-zeiten-gruppe" class="row" style="margin-top:12px" ${erfassungsart !== "zeiten" ? "hidden" : ""}>
        <div><label class="f">${t(zustand.sprache, "von")}</label><input type="time" id="f-von" value="${z.von ?? ""}"></div>
        <div><label class="f">${t(zustand.sprache, "bis")}</label><input type="time" id="f-bis" value="${z.bis ?? ""}"></div>
        <div><label class="f">${t(zustand.sprache, "pause_min")}</label><input id="f-pause" value="${z.pause_min || ""}" placeholder="30"></div>
      </div>
      <div id="f-stunden-gruppe" class="row" style="margin-top:12px" ${erfassungsart !== "stunden" ? "hidden" : ""}>
        <div><label class="f">${t(zustand.sprache, "stunden")}</label><input id="f-stunden" value="${z.stunden || ""}" placeholder="8"></div>
      </div>
    </div>
    <div class="row" style="margin-top:12px"><div><label class="f">${t(zustand.sprache, "notiz")}</label><input id="f-notiz" value="${escapeHtml(z.notiz ?? "")}"></div></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="zeiteintrag-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function zeiteintragSpeichern(id: string): Promise<void> {
  const datum = document.querySelector<HTMLInputElement>("#f-datum")?.value ?? "";
  const art = (document.querySelector<HTMLSelectElement>("#f-art")?.value ?? "arbeit") as ZeiteintragArt;
  if (!datum || !stundenMitarbeiterId) {
    zeigeMeldung(t(zustand.sprache, "fehler_pflichtfelder"));
    return;
  }
  const stundenGruppeSichtbar = document.querySelector<HTMLDivElement>("#f-stunden-gruppe")?.hidden === false;
  const zeitenModus = art === "arbeit" && !stundenGruppeSichtbar;
  const von = zeitenModus ? document.querySelector<HTMLInputElement>("#f-von")?.value || undefined : undefined;
  const bis = zeitenModus ? document.querySelector<HTMLInputElement>("#f-bis")?.value || undefined : undefined;
  const pause_min = zeitenModus ? Math.round(parseNumber(document.querySelector<HTMLInputElement>("#f-pause")?.value)) : 0;
  const stundenEingabe = art === "arbeit" && stundenGruppeSichtbar ? parseNumber(document.querySelector<HTMLInputElement>("#f-stunden")?.value) : undefined;
  const notiz = document.querySelector<HTMLInputElement>("#f-notiz")?.value.trim() ?? "";

  const stunden = berechneStunden({ datum, von, bis, pause_min, stunden: stundenEingabe, art });

  await zustand.repo.zeiteintragSpeichern({
    id: id || uid(),
    mitarbeiter_id: stundenMitarbeiterId,
    datum,
    von,
    bis,
    pause_min,
    stunden,
    art,
    notiz,
    status: "entwurf",
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function zeiteintragLoeschenAktion(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.zeiteintragLoeschen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

async function zeiteintragEinreichenAktion(id: string): Promise<void> {
  await zustand.repo.zeiteintragEinreichen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function zeiteintragFreigebenAktion(id: string): Promise<void> {
  await zustand.repo.zeiteintragFreigeben(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function zeiteintragAblehnenAktion(id: string): Promise<void> {
  await zustand.repo.zeiteintragAblehnen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

function zuschlagArtGeaendert(): void {
  const art = document.querySelector<HTMLSelectElement>("#f-zuschlag-art")?.value;
  const zeitenGruppe = document.querySelector<HTMLDivElement>("#f-zuschlag-zeiten");
  if (zeitenGruppe) zeitenGruppe.hidden = art !== "nacht";
}

function zuschlagsregelFormular(id?: string): void {
  const bestehend = id ? zustand.zuschlagsregeln.find((r) => r.id === id) : undefined;
  const r = bestehend ?? { id: "", art: "nacht" as const, von_uhrzeit: "22:00", bis_uhrzeit: "06:00", prozent: 25, aktiv: true };
  openModal(`
    <div class="mhead"><h2 style="margin:0">${id ? t(zustand.sprache, "edit") : t(zustand.sprache, "zuschlagsregel_neu")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "art")}</label>
        <select id="f-zuschlag-art" data-aktion="zuschlag-art-geaendert">
          ${(["nacht", "sonntag", "feiertag"] as const)
            .map((x) => `<option value="${x}" ${r.art === x ? "selected" : ""}>${t(zustand.sprache, ZUSCHLAG_ART_LABEL[x])}</option>`)
            .join("")}
        </select></div>
      <div><label class="f">%</label><input id="f-zuschlag-prozent" value="${r.prozent}"></div>
    </div>
    <div id="f-zuschlag-zeiten" class="row" style="margin-top:12px" ${r.art !== "nacht" ? "hidden" : ""}>
      <div><label class="f">${t(zustand.sprache, "von")}</label><input type="time" id="f-zuschlag-von" value="${r.von_uhrzeit ?? ""}"></div>
      <div><label class="f">${t(zustand.sprache, "bis")}</label><input type="time" id="f-zuschlag-bis" value="${r.bis_uhrzeit ?? ""}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <label class="f" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="f-zuschlag-aktiv" ${r.aktiv ? "checked" : ""}> ${t(zustand.sprache, "aktiv")}
      </label>
    </div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="zuschlagsregel-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function zuschlagsregelSpeichern(id: string): Promise<void> {
  const art = (document.querySelector<HTMLSelectElement>("#f-zuschlag-art")?.value ?? "nacht") as Zuschlagsregel["art"];
  const prozent = parseNumber(document.querySelector<HTMLInputElement>("#f-zuschlag-prozent")?.value);
  await zustand.repo.zuschlagsregelSpeichern({
    id: id || uid(),
    art,
    von_uhrzeit: art === "nacht" ? document.querySelector<HTMLInputElement>("#f-zuschlag-von")?.value || undefined : undefined,
    bis_uhrzeit: art === "nacht" ? document.querySelector<HTMLInputElement>("#f-zuschlag-bis")?.value || undefined : undefined,
    prozent,
    aktiv: document.querySelector<HTMLInputElement>("#f-zuschlag-aktiv")?.checked ?? true,
  });
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function zuschlagsregelLoeschenAktion(id: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "loeschen_bestaetigen"))) return;
  await zustand.repo.zuschlagsregelLoeschen(id);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "geloescht"));
}

async function standardZuschlagsregelnLaden(): Promise<void> {
  const vorhandeneArten = new Set(zustand.zuschlagsregeln.map((r) => r.art));
  for (const regel of standardZuschlagsregeln()) {
    if (vorhandeneArten.has(regel.art)) continue;
    await zustand.repo.zuschlagsregelSpeichern({ id: uid(), ...regel });
  }
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

// ---------- Benutzerverwaltung ----------

const ROLLE_LABEL: Record<Rolle, string> = {
  inhaber: "rolle_inhaber",
  buchhalter: "rolle_buchhalter",
  mitarbeiter: "rolle_mitarbeiter",
  steuerberater: "rolle_steuerberater",
};

function renderBenutzer(): string {
  const sortiert = [...zustand.benutzerListe].sort((a, b) => a.name.localeCompare(b.name));
  const bearbeitbar = zustand.repo.modus === "tauri";
  return (
    topbarTitel(
      t(zustand.sprache, "benutzer"),
      bearbeitbar ? `<button class="btn" data-aktion="benutzer-neu">${icon("plus")}${t(zustand.sprache, "neu")}</button>` : "",
    ) +
    `<div class="card">
      ${!bearbeitbar ? `<div class="hint" style="margin-bottom:12px">${t(zustand.sprache, "vorschau_hinweis")}</div>` : ""}
      ${
        sortiert.length
          ? `<div class="tw"><table><thead><tr>
            <th>${t(zustand.sprache, "name")}</th><th>${t(zustand.sprache, "rolle")}</th>
            <th>${t(zustand.sprache, "status")}</th><th>${t(zustand.sprache, "letzter_login")}</th><th></th>
          </tr></thead><tbody>
            ${sortiert
              .map(
                (b) => `<tr>
                  <td><b>${escapeHtml(b.name)}</b>${b.id === zustand.benutzer.id ? ` <span class="hint">(${t(zustand.sprache, "sie_selbst")})</span>` : ""}</td>
                  <td>${t(zustand.sprache, ROLLE_LABEL[b.rolle])}</td>
                  <td><span class="pill ${b.aktiv ? "g" : "r"}">${t(zustand.sprache, b.aktiv ? "aktiv" : "inaktiv")}</span></td>
                  <td>${b.letzter_login ? b.letzter_login.slice(0, 10).split("-").reverse().join(".") : "—"}</td>
                  <td style="text-align:end;white-space:nowrap">
                    ${bearbeitbar ? `<button class="btn ghost sm" data-aktion="benutzer-bearbeiten" data-id="${escapeHtml(b.id)}">${icon("edit")}</button>` : ""}
                  </td>
                </tr>`,
              )
              .join("")}
          </tbody></table></div>`
          : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
      }
    </div>`
  );
}

function benutzerFormular(id?: string): void {
  const bestehend = id ? zustand.benutzerListe.find((b) => b.id === id) : undefined;
  const b = bestehend ?? { id: "", name: "", rolle: "mitarbeiter" as const, aktiv: true };
  const istNeu = !bestehend;
  openModal(`
    <div class="mhead"><h2 style="margin:0">${istNeu ? t(zustand.sprache, "neu") : t(zustand.sprache, "edit")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    <div class="row">
      <div><label class="f">${t(zustand.sprache, "name")}</label><input id="f-benutzer-name" value="${escapeHtml(b.name)}" ${istNeu ? "" : "disabled"}></div>
      <div><label class="f">${t(zustand.sprache, "rolle")}</label>
        <select id="f-benutzer-rolle">
          ${(["inhaber", "buchhalter", "mitarbeiter", "steuerberater"] as const)
            .map((x) => `<option value="${x}" ${b.rolle === x ? "selected" : ""}>${t(zustand.sprache, ROLLE_LABEL[x])}</option>`)
            .join("")}
        </select></div>
    </div>
    ${
      istNeu
        ? `<div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "passwort")}</label><input type="password" id="f-benutzer-passwort"></div>
      <div><label class="f">${t(zustand.sprache, "passwort_wiederholen")}</label><input type="password" id="f-benutzer-passwort2"></div>
    </div>`
        : `<div class="row" style="margin-top:12px">
      <label class="f" style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="f-benutzer-aktiv" ${b.aktiv ? "checked" : ""}> ${t(zustand.sprache, "aktiv")}
      </label>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "neues_passwort")}</label><input type="password" id="f-benutzer-neues-passwort" placeholder="${t(zustand.sprache, "leer_lassen_unveraendert")}"></div>
    </div>`
    }
    <div id="auth-fehler" class="hint" style="color:var(--neg);margin-top:10px"></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      <button class="btn fit" data-aktion="benutzer-speichern" data-id="${id ?? ""}">${t(zustand.sprache, "save")}</button>
    </div>
  `);
}

async function benutzerSpeichernAktion(id: string): Promise<void> {
  if (!id) {
    const name = document.querySelector<HTMLInputElement>("#f-benutzer-name")?.value.trim() ?? "";
    const rolle = (document.querySelector<HTMLSelectElement>("#f-benutzer-rolle")?.value ?? "mitarbeiter") as Rolle;
    const passwort = document.querySelector<HTMLInputElement>("#f-benutzer-passwort")?.value ?? "";
    const passwort2 = document.querySelector<HTMLInputElement>("#f-benutzer-passwort2")?.value ?? "";
    if (!name || passwort.length < 8) {
      zeigeAuthFehler(t(zustand.sprache, "fehler_passwort_kurz"));
      return;
    }
    if (passwort !== passwort2) {
      zeigeAuthFehler(t(zustand.sprache, "fehler_passwoerter_ungleich"));
      return;
    }
    await benutzerAnlegen(name, rolle, passwort);
  } else {
    const rolle = (document.querySelector<HTMLSelectElement>("#f-benutzer-rolle")?.value ?? "mitarbeiter") as Rolle;
    const aktiv = document.querySelector<HTMLInputElement>("#f-benutzer-aktiv")?.checked ?? true;
    await benutzerRolleUndAktivSpeichern(id, rolle, aktiv);
    const neuesPasswort = document.querySelector<HTMLInputElement>("#f-benutzer-neues-passwort")?.value ?? "";
    if (neuesPasswort) {
      if (neuesPasswort.length < 8) {
        zeigeAuthFehler(t(zustand.sprache, "fehler_passwort_kurz"));
        return;
      }
      await benutzerPasswortAendern(id, neuesPasswort);
    }
  }
  await datenNeuLaden();
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

// ---------- Sicherung ----------
//
// Nur mit echtem Tauri-Zugriff sinnvoll (schreibt echte Dateien) — die
// Vorschau im Browser zeigt stattdessen einen Hinweis, siehe renderSicherung.

let sicherungOrdner = "";
let sicherungIntervall: BackupIntervall = "woechentlich";
let sicherungListe: string[] = [];
let googleDriveClientId = "";
let googleDriveAktiv = false;
let googleDriveIstVerbunden = false;

let appVersion = "";
type UpdateStatus = "unbekannt" | "wird_geprueft" | "aktuell" | "fehler";
let updateStatus: UpdateStatus = "unbekannt";

async function sicherungEinstellungenLaden(): Promise<void> {
  sicherungOrdner = (await einstellungLesen("backup_ordner")) ?? "";
  sicherungIntervall = ((await einstellungLesen("backup_intervall")) as BackupIntervall | null) ?? "woechentlich";
  sicherungListe = sicherungOrdner ? await sicherungenAuflisten(sicherungOrdner) : [];
  googleDriveClientId = (await einstellungLesen("google_drive_client_id")) ?? "";
  googleDriveAktiv = (await einstellungLesen("google_drive_aktiv")) === "1";
  googleDriveIstVerbunden = await invoke<boolean>("google_drive_verbunden");
}

function renderSicherung(): string {
  if (zustand.repo.modus !== "tauri") {
    return topbarTitel(t(zustand.sprache, "sich")) + `<div class="card"><div class="hint">${t(zustand.sprache, "vorschau_hinweis")}</div></div>`;
  }

  return (
    topbarTitel(t(zustand.sprache, "sich")) +
    `<div class="card">
      <h2 style="margin-top:0">${t(zustand.sprache, "sicherung_ordner")}</h2>
      <div class="row" style="align-items:flex-end">
        <div style="flex:2"><label class="f">${t(zustand.sprache, "sicherung_ordner")}</label>
          <input value="${escapeHtml(sicherungOrdner || t(zustand.sprache, "sicherung_kein_ordner"))}" disabled></div>
        <button class="btn ghost fit" data-aktion="sicherung-ordner-waehlen">${t(zustand.sprache, "sicherung_ordner_waehlen")}</button>
      </div>
      <div class="row" style="margin-top:12px">
        <div><label class="f">${t(zustand.sprache, "sicherung_intervall")}</label>
          <select data-aktion="sicherung-intervall-geaendert">
            ${(["taeglich", "woechentlich", "monatlich"] as const)
              .map((x) => `<option value="${x}" ${sicherungIntervall === x ? "selected" : ""}>${t(zustand.sprache, `intervall_${x}`)}</option>`)
              .join("")}
          </select></div>
      </div>
      <div class="row" style="margin-top:20px">
        <button class="btn fit" data-aktion="sicherung-jetzt" ${!sicherungOrdner ? "disabled" : ""}>${icon("shield")}${t(zustand.sprache, "sicherung_jetzt")}</button>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "sicherung_vorhandene")}</h2>
      ${
        sicherungListe.length
          ? `<div class="tw"><table><thead><tr><th>${t(zustand.sprache, "name")}</th><th></th></tr></thead><tbody>
        ${sicherungListe
          .map(
            (name) => `<tr><td>${escapeHtml(name)}</td><td style="text-align:end">
              <button class="btn ghost sm" data-aktion="sicherung-wiederherstellen" data-datei="${escapeHtml(name)}">${t(zustand.sprache, "sicherung_wiederherstellen")}</button>
            </td></tr>`,
          )
          .join("")}
      </tbody></table></div>`
          : `<div class="empty">${t(zustand.sprache, "keine")}</div>`
      }
    </div>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">${t(zustand.sprache, "google_drive_titel")}</h2>
      <div class="hint">${t(zustand.sprache, "google_drive_hinweis")}</div>
      <div class="row" style="align-items:flex-end;margin-top:12px">
        <div style="flex:2"><label class="f">${t(zustand.sprache, "google_drive_client_id")}</label>
          <input id="f-google-drive-client-id" value="${escapeHtml(googleDriveClientId)}" ${googleDriveIstVerbunden ? "disabled" : ""}></div>
        <button class="btn ghost fit" data-aktion="google-drive-client-id-speichern" ${googleDriveIstVerbunden ? "disabled" : ""}>${t(zustand.sprache, "save")}</button>
      </div>
      <div class="row" style="margin-top:16px;align-items:center">
        <span class="hint">${t(zustand.sprache, googleDriveIstVerbunden ? "google_drive_verbunden_status" : "google_drive_nicht_verbunden")}</span>
        <div class="sp"></div>
        ${
          googleDriveIstVerbunden
            ? `<button class="btn danger ghost fit" data-aktion="google-drive-trennen">${t(zustand.sprache, "google_drive_trennen")}</button>`
            : `<button class="btn fit" data-aktion="google-drive-verbinden" ${!googleDriveClientId ? "disabled" : ""}>${t(zustand.sprache, "google_drive_verbinden")}</button>`
        }
      </div>
      ${
        googleDriveIstVerbunden
          ? `<label class="row" style="margin-top:16px;align-items:center;gap:8px">
              <input type="checkbox" data-aktion="google-drive-aktiv-geaendert" ${googleDriveAktiv ? "checked" : ""}>
              <span>${t(zustand.sprache, "google_drive_bei_sicherung_hochladen")}</span>
            </label>`
          : ""
      }
    </div>`
  );
}

async function sicherungOrdnerWaehlen(): Promise<void> {
  const gewaehlt = await ordnerWaehlen({ directory: true, multiple: false });
  if (typeof gewaehlt !== "string") return;
  sicherungOrdner = gewaehlt;
  await einstellungSchreiben("backup_ordner", gewaehlt);
  sicherungListe = await sicherungenAuflisten(gewaehlt);
  render();
}

async function sicherungIntervallGeaendert(wert: BackupIntervall): Promise<void> {
  sicherungIntervall = wert;
  await einstellungSchreiben("backup_intervall", wert);
}

function sicherungPassphraseFormular(modus: "erstellen" | "wiederherstellen", dateiname?: string): void {
  openModal(`
    <div class="mhead"><h2 style="margin:0">${t(zustand.sprache, modus === "erstellen" ? "sicherung_jetzt" : "sicherung_wiederherstellen")}</h2>
      <button class="x" data-modal-close>${icon("x")}</button></div>
    ${modus === "erstellen" ? `<div class="hint">${t(zustand.sprache, "sicherung_passphrase_hinweis")}</div>` : ""}
    <div style="margin-top:12px"><label class="f">${t(zustand.sprache, "passwort")}</label><input type="password" id="f-sicherung-passphrase"></div>
    ${
      modus === "erstellen"
        ? `<div style="margin-top:12px"><label class="f">${t(zustand.sprache, "passwort_wiederholen")}</label><input type="password" id="f-sicherung-passphrase2"></div>`
        : ""
    }
    <div id="auth-fehler" class="hint" style="color:var(--neg);margin-top:10px"></div>
    <div id="sicherung-vorschau" style="margin-top:12px"></div>
    <div class="row" style="margin-top:20px;justify-content:flex-end">
      <button class="btn ghost fit" data-modal-close>${t(zustand.sprache, "cancel")}</button>
      ${
        modus === "erstellen"
          ? `<button class="btn fit" data-aktion="sicherung-erstellen-bestaetigen">${t(zustand.sprache, "sicherung_jetzt")}</button>`
          : `<button class="btn fit" data-aktion="sicherung-vorschau-anzeigen" data-datei="${escapeHtml(dateiname ?? "")}">${t(zustand.sprache, "sicherung_vorschau_anzeigen")}</button>`
      }
    </div>
  `);
}

async function sicherungErstellenBestaetigen(): Promise<void> {
  const p1 = document.querySelector<HTMLInputElement>("#f-sicherung-passphrase")?.value ?? "";
  const p2 = document.querySelector<HTMLInputElement>("#f-sicherung-passphrase2")?.value ?? "";
  if (p1.length < 8) {
    zeigeAuthFehler(t(zustand.sprache, "fehler_passwort_kurz"));
    return;
  }
  if (p1 !== p2) {
    zeigeAuthFehler(t(zustand.sprache, "fehler_passwoerter_ungleich"));
    return;
  }
  const dateiname = await sicherungErstellen(sicherungOrdner, p1);
  sicherungListe = await sicherungenAuflisten(sicherungOrdner);
  await sicherungNachGoogleDriveHochladen(dateiname);
  closeModal();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

async function sicherungVorschauAnzeigen(dateiname: string): Promise<void> {
  const passphrase = document.querySelector<HTMLInputElement>("#f-sicherung-passphrase")?.value ?? "";
  const pfad = await pfadJoin(sicherungOrdner, dateiname);
  try {
    const manifest = await sicherungVorschau(pfad, passphrase);
    const vorschauDiv = document.querySelector<HTMLDivElement>("#sicherung-vorschau");
    if (vorschauDiv) {
      vorschauDiv.innerHTML = `
        <div class="hint">${t(zustand.sprache, "sicherung_erstellt_am")}: ${new Date(manifest.erstellt_am).toLocaleString()}</div>
        <ul style="margin:8px 0">${manifest.mandanten.map((m) => `<li>${escapeHtml(m.name)}</li>`).join("")}</ul>
        <button class="btn danger fit" data-aktion="sicherung-einspielen-bestaetigen" data-datei="${escapeHtml(dateiname)}">${t(zustand.sprache, "sicherung_wirklich_einspielen")}</button>
      `;
    }
  } catch {
    zeigeAuthFehler(t(zustand.sprache, "sicherung_falsches_passwort"));
  }
}

async function sicherungEinspielenBestaetigen(dateiname: string): Promise<void> {
  if (!confirm(t(zustand.sprache, "sicherung_einspielen_bestaetigen"))) return;
  const passphrase = document.querySelector<HTMLInputElement>("#f-sicherung-passphrase")?.value ?? "";
  const pfad = await pfadJoin(sicherungOrdner, dateiname);
  await sicherungEinspielen(pfad, passphrase);
  closeModal();
  zeigeMeldung(t(zustand.sprache, "sicherung_eingespielt_neu_starten"));
}

async function sicherungNachGoogleDriveHochladen(dateiname: string): Promise<void> {
  if (!googleDriveIstVerbunden || !googleDriveAktiv) return;
  try {
    const pfad = await pfadJoin(sicherungOrdner, dateiname);
    const inhalt = await readFile(pfad);
    await invoke("google_drive_datei_hochladen", {
      clientId: googleDriveClientId,
      dateiname,
      inhalt: Array.from(inhalt),
    });
  } catch (fehler) {
    zeigeMeldung(t(zustand.sprache, "google_drive_upload_fehlgeschlagen") + ": " + String(fehler));
  }
}

// ---------- Google Drive (Sicherung, SPEC.md Abschnitt 9) ----------

async function googleDriveClientIdSpeichern(): Promise<void> {
  const wert = document.querySelector<HTMLInputElement>("#f-google-drive-client-id")?.value.trim() ?? "";
  googleDriveClientId = wert;
  await einstellungSchreiben("google_drive_client_id", wert);
  render();
}

async function googleDriveVerbinden(): Promise<void> {
  try {
    await invoke("google_drive_autorisieren", { clientId: googleDriveClientId });
    googleDriveIstVerbunden = true;
    render();
    zeigeMeldung(t(zustand.sprache, "google_drive_verbunden_status"));
  } catch (fehler) {
    zeigeMeldung(t(zustand.sprache, "google_drive_verbindung_fehlgeschlagen") + ": " + String(fehler));
  }
}

async function googleDriveTrennenAktion(): Promise<void> {
  await invoke("google_drive_trennen");
  googleDriveIstVerbunden = false;
  googleDriveAktiv = false;
  await einstellungSchreiben("google_drive_aktiv", "0");
  render();
}

async function googleDriveAktivGeaendert(aktiv: boolean): Promise<void> {
  googleDriveAktiv = aktiv;
  await einstellungSchreiben("google_drive_aktiv", aktiv ? "1" : "0");
}

// ---------- Firmenprofil (Einstellungen und Erstinbetriebnahme-Assistent) ----------

function firmenprofilFelder(p: MandantEinstellungen): string {
  return `
    <div class="row">
      <div style="flex:2"><label class="f">${t(zustand.sprache, "firma")}</label><input id="f-firma-firma" value="${escapeHtml(p.firma)}"></div>
      <div style="flex:1"><label class="f">${t(zustand.sprache, "inhaber")}</label><input id="f-firma-inhaber" value="${escapeHtml(p.inhaber)}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div style="flex:2"><label class="f">${t(zustand.sprache, "strasse")}</label><input id="f-firma-strasse" value="${escapeHtml(p.strasse)}"></div>
      <div style="flex:1"><label class="f">${t(zustand.sprache, "plz")}</label><input id="f-firma-plz" value="${escapeHtml(p.plz)}"></div>
      <div style="flex:1"><label class="f">${t(zustand.sprache, "ort")}</label><input id="f-firma-ort" value="${escapeHtml(p.ort)}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "stnr")}</label><input id="f-firma-stnr" value="${escapeHtml(p.stnr)}"></div>
      <div><label class="f">${t(zustand.sprache, "ustid")}</label><input id="f-firma-ustid" value="${escapeHtml(p.ustid)}"></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div><label class="f">${t(zustand.sprache, "tel")}</label><input id="f-firma-tel" value="${escapeHtml(p.tel)}"></div>
      <div><label class="f">${t(zustand.sprache, "mail")}</label><input id="f-firma-mail" value="${escapeHtml(p.mail)}"></div>
    </div>
    <div class="row" style="margin-top:12px;align-items:flex-end">
      <div><label class="f">${t(zustand.sprache, "kassenanfangsbestand")}</label><input type="number" step="0.01" id="f-firma-kasse" value="${p.kassenAnfangsbestand}"></div>
      <div><label class="f">${t(zustand.sprache, "versteuerung")}</label>
        <select id="f-firma-versteuerung">
          <option value="ist" ${p.versteuerung === "ist" ? "selected" : ""}>${t(zustand.sprache, "versteuerung_ist")}</option>
          <option value="soll" ${p.versteuerung === "soll" ? "selected" : ""}>${t(zustand.sprache, "versteuerung_soll")}</option>
        </select>
      </div>
      <div><label class="f">${t(zustand.sprache, "voranmeldung")}</label>
        <select id="f-firma-voranmeldung">
          ${(["monatlich", "quartalsweise", "jaehrlich"] as const)
            .map((x) => `<option value="${x}" ${p.voranmeldung === x ? "selected" : ""}>${t(zustand.sprache, `intervall_${x}`)}</option>`)
            .join("")}
        </select>
      </div>
    </div>
    <label class="row" style="margin-top:12px;align-items:center;gap:8px">
      <input type="checkbox" id="f-firma-kleinunternehmer" ${p.kleinunternehmer ? "checked" : ""}>
      <span>${t(zustand.sprache, "kleinunternehmer_label")}</span>
    </label>
    <div style="margin-top:16px">
      <label class="f">${t(zustand.sprache, "logo")}</label>
      <div class="row" style="align-items:center;gap:12px">
        ${zustand.logoObjectUrl ? `<img src="${zustand.logoObjectUrl}" alt="Logo" style="height:48px;max-width:160px;object-fit:contain">` : `<span class="hint">${t(zustand.sprache, "kein_logo")}</span>`}
        <input type="file" accept="image/png,image/jpeg,image/svg+xml" data-aktion="logo-datei-gewaehlt">
        ${zustand.logoObjectUrl ? `<button class="btn ghost sm fit" data-aktion="logo-entfernen">${t(zustand.sprache, "logo_entfernen")}</button>` : ""}
      </div>
    </div>
  `;
}

function firmenprofilAusFormular(bisherigesLogoPfad: string | null): MandantEinstellungen {
  return {
    firma: document.querySelector<HTMLInputElement>("#f-firma-firma")?.value.trim() ?? "",
    inhaber: document.querySelector<HTMLInputElement>("#f-firma-inhaber")?.value.trim() ?? "",
    strasse: document.querySelector<HTMLInputElement>("#f-firma-strasse")?.value.trim() ?? "",
    plz: document.querySelector<HTMLInputElement>("#f-firma-plz")?.value.trim() ?? "",
    ort: document.querySelector<HTMLInputElement>("#f-firma-ort")?.value.trim() ?? "",
    land: "DE",
    stnr: document.querySelector<HTMLInputElement>("#f-firma-stnr")?.value.trim() ?? "",
    ustid: document.querySelector<HTMLInputElement>("#f-firma-ustid")?.value.trim() ?? "",
    tel: document.querySelector<HTMLInputElement>("#f-firma-tel")?.value.trim() ?? "",
    mail: document.querySelector<HTMLInputElement>("#f-firma-mail")?.value.trim() ?? "",
    logoPfad: bisherigesLogoPfad,
    kassenAnfangsbestand: parseNumber(document.querySelector<HTMLInputElement>("#f-firma-kasse")?.value ?? "0"),
    kleinunternehmer: document.querySelector<HTMLInputElement>("#f-firma-kleinunternehmer")?.checked ?? false,
    versteuerung: (document.querySelector<HTMLSelectElement>("#f-firma-versteuerung")?.value as MandantEinstellungen["versteuerung"]) ?? "ist",
    voranmeldung: (document.querySelector<HTMLSelectElement>("#f-firma-voranmeldung")?.value as MandantEinstellungen["voranmeldung"]) ?? "monatlich",
  };
}

async function logoDateiGewaehlt(dateien: FileList): Promise<void> {
  const datei = dateien[0];
  if (!datei) return;
  const inhalt = new Uint8Array(await datei.arrayBuffer());
  await zustand.repo.logoSpeichern({ dateiname: datei.name, mime: datei.type, inhalt });
  await datenNeuLaden();
  render();
}

async function logoEntfernenAktion(): Promise<void> {
  await zustand.repo.logoEntfernen();
  await datenNeuLaden();
  render();
}

function renderEinstellungen(): string {
  const updateKarte =
    zustand.repo.modus === "tauri"
      ? `<div class="card" style="margin-top:16px">
          <h2 style="margin-top:0">${t(zustand.sprache, "update_titel")}</h2>
          <div class="row" style="align-items:center">
            <span class="hint" style="flex:1">${t(zustand.sprache, "update_version")}: ${escapeHtml(appVersion)}</span>
            <button class="btn ghost fit" data-aktion="update-pruefen" ${updateStatus === "wird_geprueft" ? "disabled" : ""}>${t(zustand.sprache, "update_pruefen")}</button>
          </div>
          ${updateStatus === "aktuell" ? `<div class="hint" style="margin-top:8px">${t(zustand.sprache, "update_aktuell")}</div>` : ""}
          ${updateStatus === "fehler" ? `<div class="hint" style="margin-top:8px;color:var(--neg)">${t(zustand.sprache, "update_fehler")}</div>` : ""}
        </div>`
      : "";
  return (
    topbarTitel(t(zustand.sprache, "einst")) +
    `<div class="card">${firmenprofilFelder(zustand.firmenprofil)}
      <div class="row" style="margin-top:20px;justify-content:flex-end">
        <button class="btn fit" data-aktion="firmenprofil-speichern">${t(zustand.sprache, "save")}</button>
      </div>
    </div>${updateKarte}`
  );
}

async function updatePruefenAktion(): Promise<void> {
  updateStatus = "wird_geprueft";
  render();
  try {
    const update = await updateSuchen();
    if (update) {
      if (confirm(`${t(zustand.sprache, "update_verfuegbar")} (${update.version})`)) {
        await update.downloadAndInstall();
        await relaunch();
        return;
      }
      updateStatus = "unbekannt";
    } else {
      updateStatus = "aktuell";
    }
  } catch (fehler) {
    updateStatus = "fehler";
    zeigeMeldung(t(zustand.sprache, "update_fehler") + ": " + String(fehler));
  }
  render();
}

async function firmenprofilSpeichernAktion(): Promise<void> {
  const profil = firmenprofilAusFormular(zustand.firmenprofil.logoPfad);
  await zustand.repo.mandantEinstellungenSpeichern(profil);
  await datenNeuLaden();
  render();
  zeigeMeldung(t(zustand.sprache, "gespeichert"));
}

function renderErstinbetriebnahme(): string {
  return `
    <div class="card" style="max-width:640px;margin:40px auto">
      <h1 style="margin-top:0">${t(zustand.sprache, "erstinbetriebnahme_titel")}</h1>
      <p class="hint">${t(zustand.sprache, "erstinbetriebnahme_hinweis")}</p>
      ${firmenprofilFelder(zustand.firmenprofil)}
      <div class="row" style="margin-top:20px;justify-content:flex-end">
        <button class="btn ghost fit" data-aktion="erstinbetriebnahme-ueberspringen">${t(zustand.sprache, "erstinbetriebnahme_ueberspringen")}</button>
        <button class="btn fit" data-aktion="erstinbetriebnahme-abschliessen">${t(zustand.sprache, "erstinbetriebnahme_abschliessen")}</button>
      </div>
    </div>`;
}

async function erstinbetriebnahmeAbschliessenAktion(): Promise<void> {
  const profil = firmenprofilAusFormular(zustand.firmenprofil.logoPfad);
  await zustand.repo.mandantEinstellungenSpeichern(profil);
  await zustand.repo.erstinbetriebnahmeAbschliessen();
  await datenNeuLaden();
  appPhase = "app";
  render();
}

async function erstinbetriebnahmeUeberspringenAktion(): Promise<void> {
  await zustand.repo.erstinbetriebnahmeAbschliessen();
  appPhase = "app";
  render();
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
    case "kasse":
      return renderKasse();
    case "gutscheine":
      return renderGutscheine();
    case "datenimport":
      return renderDatenimport();
    case "bwa":
      return renderBwa();
    case "euer":
      return renderEuer();
    case "ustva":
      return renderUstva();
    case "berichte":
      return renderBerichte();
    case "diagramme":
      return renderDiagramme();
    case "belegablage":
      return renderBelegablage();
    case "mitarbeiter":
      return renderMitarbeiter();
    case "stunden":
      return renderStunden();
    case "benutzer":
      return renderBenutzer();
    case "sicherung":
      return renderSicherung();
    case "einstellungen":
      return renderEinstellungen();
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

  if (appPhase === "ersteinrichtung" || appPhase === "login") {
    document.documentElement.dir = SPRACHEN.find((s) => s.code === authSprache)?.rtl ? "rtl" : "ltr";
    document.documentElement.lang = authSprache;
    app.innerHTML = appPhase === "ersteinrichtung" ? renderErsteinrichtung() : renderLogin();
    return;
  }

  if (appPhase === "erstinbetriebnahme") {
    document.documentElement.dir = SPRACHEN.find((s) => s.code === zustand.sprache)?.rtl ? "rtl" : "ltr";
    document.documentElement.lang = zustand.sprache;
    app.innerHTML = renderErstinbetriebnahme();
    return;
  }

  document.documentElement.dir = SPRACHEN.find((s) => s.code === zustand.sprache)?.rtl ? "rtl" : "ltr";
  document.documentElement.lang = zustand.sprache;

  app.innerHTML = `
    <div class="app">
      <aside>
        <div class="brand"><b>K</b><span>Kontor</span></div>
        <div class="mand">${renderSprachSchalter(zustand.sprache)}</div>
        <nav>${renderNav()}</nav>
        <div class="row" style="padding:12px 16px;align-items:center;gap:8px">
          <span class="hint fit" style="flex:1">${escapeHtml(zustand.benutzer.name)}</span>
          ${zustand.repo.modus === "tauri" ? `<button class="btn ghost sm fit" data-aktion="abmelden">${t(zustand.sprache, "abmelden")}</button>` : ""}
        </div>
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
      if (appPhase === "app") zustand.sprache = sprachBtn.dataset.sprache as Sprache;
      else authSprache = sprachBtn.dataset.sprache as Sprache;
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
    const datei = aktionBtn.dataset.datei;

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
      case "kasse-konto-waehlen":
        if (nr === "1000" || nr === "1210") {
          zustand.kassenKonto = nr;
          render();
        }
        break;
      case "gutschein-ausgeben-neu":
        gutscheinAusgebenFormular();
        break;
      case "gutschein-ausgeben-speichern":
        void gutscheinAusgebenSpeichern();
        break;
      case "gutschein-einloesen-neu":
        if (id) gutscheinEinloesenFormular(id);
        break;
      case "gutschein-einloesen-speichern":
        if (id) void gutscheinEinloesenSpeichern(id);
        break;
      case "buchung-belege":
        if (id) void belegeFormular(id);
        break;
      case "beleg-oeffnen":
        if (id) void belegOeffnen(id);
        break;
      case "beleg-loeschen":
        if (id) void belegLoeschenAktion(id);
        break;
      case "buchungen-exportieren":
        buchungenExportieren();
        break;
      case "import-abbrechen":
        importAbbrechen();
        break;
      case "import-uebernehmen":
        void importUebernehmen();
        break;
      case "import-rueckgaengig":
        if (id) void importRueckgaengigAktion(id);
        break;
      case "regel-neu":
        regelFormular();
        break;
      case "regel-bearbeiten":
        if (id) regelFormular(id);
        break;
      case "regel-speichern":
        void regelSpeichern(id ?? "");
        break;
      case "regel-loeschen":
        if (id) void regelLoeschen(id);
        break;
      case "standardregeln-laden":
        void standardregelnLaden();
        break;
      case "zeitraum-monat": {
        const gruppe = aktionBtn.dataset.zeitraumGruppe;
        if (gruppe) Object.assign(zeitraumFuer(gruppe), monatsSpanne(heutigerMonat()));
        render();
        break;
      }
      case "zeitraum-quartal": {
        const gruppe = aktionBtn.dataset.zeitraumGruppe;
        if (gruppe) {
          const heute = new Date();
          Object.assign(zeitraumFuer(gruppe), quartalsSpanne(heute.getFullYear(), Math.floor(heute.getMonth() / 3) + 1));
        }
        render();
        break;
      }
      case "zeitraum-jahr": {
        const gruppe = aktionBtn.dataset.zeitraumGruppe;
        if (gruppe) Object.assign(zeitraumFuer(gruppe), jahresSpanne(new Date().getFullYear()));
        render();
        break;
      }
      case "berichte-tab":
        berichteUnterAnsicht = (aktionBtn.dataset.unteransicht as typeof berichteUnterAnsicht) ?? "journal";
        render();
        break;
      case "dokument-oeffnen":
        if (id) void dokumentOeffnen(id);
        break;
      case "dokument-loeschen":
        if (id) void dokumentLoeschenAktion(id);
        break;
      case "monatspaket-herunterladen":
        void monatspaketHerunterladen();
        break;
      case "mitarbeiter-neu":
        mitarbeiterFormular();
        break;
      case "mitarbeiter-bearbeiten":
        if (id) mitarbeiterFormular(id);
        break;
      case "mitarbeiter-speichern":
        void mitarbeiterSpeichern(id ?? "");
        break;
      case "mitarbeiter-loeschen":
        if (id) void mitarbeiterLoeschen(id);
        break;
      case "zeiteintrag-neu":
        zeiteintragFormular();
        break;
      case "zeiteintrag-bearbeiten":
        if (id) zeiteintragFormular(id);
        break;
      case "zeiteintrag-speichern":
        void zeiteintragSpeichern(id ?? "");
        break;
      case "zeiteintrag-loeschen":
        if (id) void zeiteintragLoeschenAktion(id);
        break;
      case "zeiteintrag-einreichen":
        if (id) void zeiteintragEinreichenAktion(id);
        break;
      case "zeiteintrag-freigeben":
        if (id) void zeiteintragFreigebenAktion(id);
        break;
      case "zeiteintrag-ablehnen":
        if (id) void zeiteintragAblehnenAktion(id);
        break;
      case "erfassungsart-waehlen":
        erfassungsartWaehlen((aktionBtn.dataset.modus as "zeiten" | "stunden") ?? "zeiten");
        break;
      case "zuschlagsregel-neu":
        zuschlagsregelFormular();
        break;
      case "zuschlagsregel-bearbeiten":
        if (id) zuschlagsregelFormular(id);
        break;
      case "zuschlagsregel-speichern":
        void zuschlagsregelSpeichern(id ?? "");
        break;
      case "zuschlagsregel-loeschen":
        if (id) void zuschlagsregelLoeschenAktion(id);
        break;
      case "zuschlagsregeln-laden":
        void standardZuschlagsregelnLaden();
        break;
      case "ersteinrichtung-anlegen":
        void ersteinrichtungAnlegen();
        break;
      case "login-absenden":
        void loginAbsenden();
        break;
      case "abmelden":
        abmelden();
        break;
      case "benutzer-neu":
        benutzerFormular();
        break;
      case "benutzer-bearbeiten":
        if (id) benutzerFormular(id);
        break;
      case "benutzer-speichern":
        void benutzerSpeichernAktion(id ?? "");
        break;
      case "sicherung-ordner-waehlen":
        void sicherungOrdnerWaehlen();
        break;
      case "sicherung-jetzt":
        sicherungPassphraseFormular("erstellen");
        break;
      case "sicherung-erstellen-bestaetigen":
        void sicherungErstellenBestaetigen();
        break;
      case "sicherung-wiederherstellen":
        if (datei) sicherungPassphraseFormular("wiederherstellen", datei);
        break;
      case "sicherung-vorschau-anzeigen":
        if (datei) void sicherungVorschauAnzeigen(datei);
        break;
      case "sicherung-einspielen-bestaetigen":
        if (datei) void sicherungEinspielenBestaetigen(datei);
        break;
      case "google-drive-client-id-speichern":
        void googleDriveClientIdSpeichern();
        break;
      case "google-drive-verbinden":
        void googleDriveVerbinden();
        break;
      case "google-drive-trennen":
        void googleDriveTrennenAktion();
        break;
      case "firmenprofil-speichern":
        void firmenprofilSpeichernAktion();
        break;
      case "logo-entfernen":
        void logoEntfernenAktion();
        break;
      case "erstinbetriebnahme-abschliessen":
        void erstinbetriebnahmeAbschliessenAktion();
        break;
      case "erstinbetriebnahme-ueberspringen":
        void erstinbetriebnahmeUeberspringenAktion();
        break;
      case "update-pruefen":
        void updatePruefenAktion();
        break;
    }
  });

  document.addEventListener("change", (ereignis) => {
    const ziel = ereignis.target as HTMLElement;
    if (ziel.closest("[data-aktion='buchung-konto-geaendert']")) {
      buchungKontoGeaendert();
    }
    const sicherungIntervallSelect = ziel.closest<HTMLSelectElement>("[data-aktion='sicherung-intervall-geaendert']");
    if (sicherungIntervallSelect) {
      void sicherungIntervallGeaendert(sicherungIntervallSelect.value as BackupIntervall);
    }
    const googleDriveAktivBox = ziel.closest<HTMLInputElement>("[data-aktion='google-drive-aktiv-geaendert']");
    if (googleDriveAktivBox) {
      void googleDriveAktivGeaendert(googleDriveAktivBox.checked);
    }
    const logoDatei = ziel.closest<HTMLInputElement>("[data-aktion='logo-datei-gewaehlt']");
    if (logoDatei && logoDatei.files?.length) {
      void logoDateiGewaehlt(logoDatei.files);
      logoDatei.value = "";
    }
    const belegDatei = ziel.closest<HTMLInputElement>("[data-aktion='beleg-datei-gewaehlt']");
    if (belegDatei && belegDatei.files?.length) {
      const buchungId = belegDatei.dataset.buchungId ?? "";
      void belegeHochladen(buchungId, belegDatei.files);
      belegDatei.value = "";
    }

    const importDatei = ziel.closest<HTMLInputElement>("[data-aktion='import-datei-gewaehlt']");
    if (importDatei && importDatei.files?.length) {
      void importDateiEinlesen(importDatei.files[0]);
      importDatei.value = "";
    }

    const zuordnungSelect = ziel.closest<HTMLSelectElement>("[data-import-zuordnung]");
    if (zuordnungSelect && importSitzung) {
      const feld = zuordnungSelect.dataset.importZuordnung as ImportFeld;
      if (zuordnungSelect.value === "") delete importSitzung.zuordnung[feld];
      else importSitzung.zuordnung[feld] = Number(zuordnungSelect.value);
      kandidatenNeuBerechnen();
      importBereichAktualisieren();
    }

    const zeilenFeld = ziel.closest<HTMLInputElement | HTMLSelectElement>("[data-import-feld]");
    if (zeilenFeld && importSitzung) {
      const index = Number(zeilenFeld.dataset.index);
      const kandidat = importSitzung.kandidaten[index];
      const feld = zeilenFeld.dataset.importFeld;
      if (kandidat && feld) {
        if (feld === "uebernehmen") kandidat.uebernehmen = (zeilenFeld as HTMLInputElement).checked;
        else if (feld === "ust_satz") kandidat.ust_satz = Number(zeilenFeld.value);
        else if (feld === "konto") kandidat.konto = zeilenFeld.value;
        else if (feld === "gegenkonto") kandidat.gegenkonto = zeilenFeld.value;
      }
    }

    const bwaMonatFeld = ziel.closest<HTMLInputElement>("[data-aktion='bwa-monat']");
    if (bwaMonatFeld) {
      bwaMonat = bwaMonatFeld.value;
      render();
    }

    const zeitraumFeld = ziel.closest<HTMLInputElement>("[data-zeitraum-gruppe][data-zeitraum-teil]");
    if (zeitraumFeld) {
      const gruppe = zeitraumFeld.dataset.zeitraumGruppe!;
      const zr = zeitraumFuer(gruppe);
      if (zeitraumFeld.dataset.zeitraumTeil === "von") zr.von = zeitraumFeld.value;
      else zr.bis = zeitraumFeld.value;
      render();
    }

    const kontenblattSelect = ziel.closest<HTMLSelectElement>("[data-aktion='kontenblatt-konto-waehlen']");
    if (kontenblattSelect) {
      kontenblattKonto = kontenblattSelect.value;
      render();
    }

    const dokumentDatei = ziel.closest<HTMLInputElement>("[data-aktion='dokument-datei-gewaehlt']");
    if (dokumentDatei && dokumentDatei.files?.length) {
      void dokumenteHochladen(dokumentDatei.files);
      dokumentDatei.value = "";
    }

    const belegablageMonatFeld = ziel.closest<HTMLInputElement>("[data-aktion='belegablage-monat']");
    if (belegablageMonatFeld) {
      belegablageMonat = belegablageMonatFeld.value;
      render();
    }

    const stundenMitarbeiterSelect = ziel.closest<HTMLSelectElement>("[data-aktion='stunden-mitarbeiter-waehlen']");
    if (stundenMitarbeiterSelect) {
      stundenMitarbeiterId = stundenMitarbeiterSelect.value;
      render();
    }

    const stundenMonatFeld = ziel.closest<HTMLInputElement>("[data-aktion='stunden-monat']");
    if (stundenMonatFeld) {
      stundenMonat = stundenMonatFeld.value;
      render();
    }

    if (ziel.closest("[data-aktion='zeiteintrag-art-geaendert']")) {
      zeiteintragArtGeaendert();
    }

    if (ziel.closest("[data-aktion='zuschlag-art-geaendert']")) {
      zuschlagArtGeaendert();
    }
  });

  document.addEventListener("keydown", (ereignis) => {
    if (ereignis.key === "Escape") closeModal();
  });
}

// ---------- Zugang (Ersteinrichtung, Login) ----------
//
// Die Vorschau ohne Tauri überspringt den Zugang vollständig (synthetische
// Inhaber-Sitzung), weil sie ohnehin nichts dauerhaft speichert und keine
// eigene zentrale Datenbank hat. Im echten Tauri-Fenster steht vor der
// eigentlichen App immer Ersteinrichtung (kein Benutzer vorhanden) oder Login.

type AppPhase = "ersteinrichtung" | "login" | "erstinbetriebnahme" | "app";
let appPhase: AppPhase = "app";
let authSprache: Sprache = "de";
let angemeldeterBenutzer: Benutzer | null = null;

function zeigeAuthFehler(text: string): void {
  const el = document.querySelector<HTMLDivElement>("#auth-fehler");
  if (el) el.textContent = text;
}

function renderErsteinrichtung(): string {
  return `
    <div class="card" style="max-width:420px;margin:80px auto">
      <h1 style="margin-top:0">Kontor</h1>
      <p class="hint">${t(authSprache, "ersteinrichtung_hinweis")}</p>
      <div style="margin-top:16px">${renderSprachSchalter(authSprache)}</div>
      <div style="margin-top:16px"><label class="f">${t(authSprache, "name")}</label><input id="f-eu-name" placeholder="Max Mustermann"></div>
      <div style="margin-top:12px"><label class="f">${t(authSprache, "passwort")}</label><input type="password" id="f-eu-passwort"></div>
      <div style="margin-top:12px"><label class="f">${t(authSprache, "passwort_wiederholen")}</label><input type="password" id="f-eu-passwort2"></div>
      <button class="btn" style="margin-top:20px;width:100%" data-aktion="ersteinrichtung-anlegen">${t(authSprache, "ersteinrichtung_anlegen")}</button>
      <div id="auth-fehler" class="hint" style="color:var(--neg);margin-top:10px"></div>
    </div>`;
}

function renderLogin(): string {
  return `
    <div class="card" style="max-width:360px;margin:100px auto">
      <h1 style="margin-top:0">Kontor</h1>
      <div style="margin-top:16px">${renderSprachSchalter(authSprache)}</div>
      <div style="margin-top:16px"><label class="f">${t(authSprache, "name")}</label><input id="f-login-name"></div>
      <div style="margin-top:12px"><label class="f">${t(authSprache, "passwort")}</label><input type="password" id="f-login-passwort"></div>
      <button class="btn" style="margin-top:20px;width:100%" data-aktion="login-absenden">${t(authSprache, "anmelden")}</button>
      <div id="auth-fehler" class="hint" style="color:var(--neg);margin-top:10px"></div>
    </div>`;
}

async function ersteinrichtungAnlegen(): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#f-eu-name")?.value.trim() ?? "";
  const passwort = document.querySelector<HTMLInputElement>("#f-eu-passwort")?.value ?? "";
  const passwort2 = document.querySelector<HTMLInputElement>("#f-eu-passwort2")?.value ?? "";
  if (!name || passwort.length < 8) {
    zeigeAuthFehler(t(authSprache, "fehler_passwort_kurz"));
    return;
  }
  if (passwort !== passwort2) {
    zeigeAuthFehler(t(authSprache, "fehler_passwoerter_ungleich"));
    return;
  }
  angemeldeterBenutzer = await ersteBenutzerAnlegen(name, passwort);
  appPhase = "app";
  await appStarten();
}

async function loginAbsenden(): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#f-login-name")?.value.trim() ?? "";
  const passwort = document.querySelector<HTMLInputElement>("#f-login-passwort")?.value ?? "";
  const benutzer = await benutzerAnmelden(name, passwort);
  if (!benutzer) {
    zeigeAuthFehler(t(authSprache, "fehler_login"));
    return;
  }
  angemeldeterBenutzer = benutzer;
  appPhase = "app";
  await appStarten();
}

function abmelden(): void {
  angemeldeterBenutzer = null;
  appPhase = "login";
  render();
}

async function appStarten(): Promise<void> {
  const repo = await erstelleDatenquelle();
  const benutzer = angemeldeterBenutzer!;
  zustand = {
    tab: standardTab(benutzer.rolle),
    sprache: authSprache,
    repo,
    benutzer,
    benutzerListe: [],
    kannBuchungenBearbeiten: buchungenZugriff(benutzer.rolle) === "voll",
    konten: [],
    kostenstellen: [],
    buchungen: [],
    gutscheine: [],
    kassenAnfangsbestand: 0,
    kleinunternehmer: false,
    versteuerung: "ist",
    voranmeldung: "monatlich",
    firmenprofil: {
      firma: "",
      inhaber: "",
      strasse: "",
      plz: "",
      ort: "",
      land: "DE",
      stnr: "",
      ustid: "",
      tel: "",
      mail: "",
      logoPfad: null,
      kassenAnfangsbestand: 0,
      kleinunternehmer: false,
      versteuerung: "ist",
      voranmeldung: "monatlich",
    },
    logoObjectUrl: null,
    gutscheinSumme: 0,
    kassenKonto: "1000",
    importregeln: [],
    importlaeufe: [],
    dokumente: [],
    mitarbeiter: [],
    zeiteintraege: [],
    zuschlagsregeln: [],
  };
  await datenNeuLaden();
  if (repo.modus === "tauri") {
    await sicherungEinstellungenLaden();
    appVersion = await getVersion();
    if (!(await repo.erstinbetriebnahmeAbgeschlossen())) {
      appPhase = "erstinbetriebnahme";
    }
  }
  render();
}

async function start(): Promise<void> {
  einrichten();
  if (!istTauri()) {
    angemeldeterBenutzer = { id: "vorschau", name: "Vorschau", rolle: "inhaber", aktiv: true };
    appPhase = "app";
    await appStarten();
    return;
  }
  const anzahl = await benutzerAnzahl();
  appPhase = anzahl === 0 ? "ersteinrichtung" : "login";
  render();
}

void start();
