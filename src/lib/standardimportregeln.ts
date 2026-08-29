// Startregeln für den Datenimport. Siehe SPEC.md Abschnitt 6 "Startregeln".
// Werden nicht automatisch angelegt, sondern auf Wunsch geladen ("Standardregeln
// laden") — Vorgaben sind Startwerte, keine Zwänge.

export interface StandardImportRegel {
  stichwoerter: string;
  konto: string;
}

export function standardImportRegeln(): StandardImportRegel[] {
  return [
    { stichwoerter: "sumup,kartenumsatz,kartenzahlung", konto: "1360" },
    { stichwoerter: "bareinzahlung,tageskasse,einzahlung", konto: "1360" },
    { stichwoerter: "großhandel,grosshandel,süßwaren,suesswaren,wareneingang,lieferant", konto: "3300" },
    { stichwoerter: "stadtwerke,strom,gas,wasser,energie", konto: "4240" },
    { stichwoerter: "miete,mietverwaltung,pacht", konto: "4210" },
    { stichwoerter: "lohn,gehalt,minijob", konto: "4100" },
    { stichwoerter: "versicherung", konto: "4360" },
    { stichwoerter: "telekom,vodafone,internet,telefon", konto: "4920" },
    { stichwoerter: "steuerberat,buchführung", konto: "4955" },
    { stichwoerter: "werbung,anzeige,google,meta", konto: "4600" },
    { stichwoerter: "gebühr,entgelt,kontoführung", konto: "4970" },
  ];
}
