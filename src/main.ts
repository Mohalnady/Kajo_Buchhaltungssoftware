import "./style.css";
import { SPRACHEN, t, type Sprache } from "./i18n.ts";
import { calc } from "./lib/buchungen.ts";
import { kassenstand } from "./lib/kasse.ts";
import { offeneGutscheinSumme } from "./lib/gutschein.ts";
import { formatEur } from "./lib/numbers.ts";
import {
  DEMO_KASSEN_ANFANGSBESTAND,
  DEMO_KLEINUNTERNEHMER,
  demoBuchungen,
  demoGutscheine,
  demoKonten,
} from "./demodaten.ts";

// P1-Grundgerüst: Navigation und Design aus dem Prototyp (referenz/prototyp.html),
// aber als echte TypeScript-Struktur statt einer HTML-Datei. Die Rechenkerne unter
// src/lib/ sind bereits fertig und getestet; die hier sichtbaren Bereiche füllen
// sich Phase für Phase (siehe SPEC.md Abschnitt 10).

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
};

function icon(name: string): string {
  return `<svg class="i" viewBox="0 0 24 24"><path d="${ICONS[name] ?? ""}"/></svg>`;
}

const NAV: NavEintrag[] = [
  { typ: "ziel", key: "dashboard", label: "dash", icon: "dash" },
  { typ: "ziel", key: "buchungen", label: "buch", icon: "book", phase: "P1" },
  { typ: "ziel", key: "kasse", label: "kasse", icon: "cash", phase: "P1" },
  { typ: "trenner", label: "ausw" },
  { typ: "ziel", key: "bwa", label: "bwa", icon: "chart", phase: "P2" },
  { typ: "ziel", key: "euer", label: "euer", icon: "doc", phase: "P2" },
  { typ: "ziel", key: "ustva", label: "ust", icon: "pct", phase: "P2" },
  { typ: "trenner", label: "pers" },
  { typ: "ziel", key: "mitarbeiter", label: "ma", icon: "users", phase: "P4" },
  { typ: "ziel", key: "stunden", label: "std", icon: "clock", phase: "P4" },
  { typ: "trenner", label: "verw" },
  { typ: "ziel", key: "konten", label: "konten", icon: "list", phase: "P1" },
  { typ: "ziel", key: "kostenstellen", label: "ks", icon: "tagg", phase: "P1" },
  { typ: "ziel", key: "datenimport", label: "imp", icon: "imp", phase: "P3" },
  { typ: "ziel", key: "mandanten", label: "mand", icon: "build", phase: "P5" },
  { typ: "ziel", key: "einstellungen", label: "einst", icon: "gear" },
  { typ: "ziel", key: "sicherung", label: "sich", icon: "shield", phase: "P5" },
];

interface Zustand {
  tab: string;
  sprache: Sprache;
}
const zustand: Zustand = { tab: "dashboard", sprache: "de" };

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

function aktuelleNavPhase(): string | undefined {
  const eintrag = NAV.find((n) => n.typ === "ziel" && n.key === zustand.tab);
  return eintrag && eintrag.typ === "ziel" ? eintrag.phase : undefined;
}

function aktuellerTitel(): string {
  const eintrag = NAV.find((n) => n.typ === "ziel" && n.key === zustand.tab);
  return eintrag ? t(zustand.sprache, eintrag.label) : "";
}

function renderDashboard(): string {
  const konten = demoKonten();
  const kontoVon = (nr: string) => konten.find((k) => k.nr === nr);
  const buchungen = demoBuchungen();

  const a = calc(buchungen, kontoVon, DEMO_KLEINUNTERNEHMER);
  const bestand = kassenstand(buchungen, DEMO_KASSEN_ANFANGSBESTAND, "1000", kontoVon);
  const bestandNegativ = bestand < 0;
  const gutscheinSumme = offeneGutscheinSumme(demoGutscheine());

  const kpis: { lbl: string; val: string; ton: "pos" | "neg" | ""; hinweis?: string }[] = [
    { lbl: t(zustand.sprache, "ein"), val: formatEur(a.ein) + " €", ton: "pos" },
    { lbl: t(zustand.sprache, "aus"), val: formatEur(a.aus) + " €", ton: "neg" },
    { lbl: t(zustand.sprache, "erg"), val: formatEur(a.ergebnis) + " €", ton: a.ergebnis >= 0 ? "pos" : "neg" },
    {
      lbl: t(zustand.sprache, "zahllast"),
      val: DEMO_KLEINUNTERNEHMER ? t(zustand.sprache, "kleinunternehmer_hinweis") : formatEur(a.zahllast) + " €",
      ton: "",
    },
    {
      lbl: t(zustand.sprache, "kasseb"),
      val: formatEur(bestand) + " €",
      ton: bestandNegativ ? "neg" : "",
      hinweis: bestandNegativ ? t(zustand.sprache, "kasse_negativ") : undefined,
    },
    { lbl: t(zustand.sprache, "gutscheine"), val: formatEur(gutscheinSumme) + " €", ton: "" },
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
    <div class="hint" style="margin-top:10px">${t(zustand.sprache, "beispieldaten")}</div>
  `;
}

function topbarTitel(titel: string): string {
  return `<div class="topbar"><h1>${titel}</h1></div>`;
}

function renderInhalt(): string {
  if (zustand.tab === "dashboard") {
    return renderDashboard();
  }
  const phase = aktuelleNavPhase();
  return topbarTitel(aktuellerTitel()) + `
    <div class="card"><div class="soon">
      ${phase ? `<span class="ph">${t(zustand.sprache, "phase")} ${phase}</span>` : ""}
      <h2 style="margin:0">${aktuellerTitel()}</h2>
      <p class="hint" style="max-width:420px;margin:0">${t(zustand.sprache, "bereich_im_bau")}</p>
    </div></div>`;
}

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

  app.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      zustand.tab = btn.dataset.tab!;
      render();
    });
  });
  app.querySelectorAll<HTMLButtonElement>("[data-sprache]").forEach((btn) => {
    btn.addEventListener("click", () => {
      zustand.sprache = btn.dataset.sprache as Sprache;
      render();
    });
  });
}

render();
