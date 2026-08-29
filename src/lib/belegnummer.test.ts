import { describe, expect, it } from "vitest";
import { naechsteBelegnummer } from "./belegnummer.ts";

describe("naechsteBelegnummer", () => {
  it("beginnt bei 001, wenn noch keine Belegnummer im Jahr existiert", () => {
    expect(naechsteBelegnummer([], "2026")).toBe("RE-2026-001");
  });

  it("zählt fortlaufend hoch", () => {
    expect(naechsteBelegnummer(["RE-2026-001", "RE-2026-002"], "2026")).toBe("RE-2026-003");
  });

  it("ignoriert Lücken und nimmt die höchste vergebene Nummer", () => {
    expect(naechsteBelegnummer(["RE-2026-001", "RE-2026-005"], "2026")).toBe("RE-2026-006");
  });

  it("beginnt im neuen Jahr wieder bei 001", () => {
    expect(naechsteBelegnummer(["RE-2025-014"], "2026")).toBe("RE-2026-001");
  });

  it("ignoriert Belegnummern mit anderem Präfix", () => {
    expect(naechsteBelegnummer(["GS-2026-001"], "2026")).toBe("RE-2026-001");
  });

  it("ignoriert nicht erkennbare Belegnummern statt abzustürzen", () => {
    expect(naechsteBelegnummer(["freihändig eingetragen", ""], "2026")).toBe("RE-2026-001");
  });

  it("unterstützt einen eigenen Präfix", () => {
    expect(naechsteBelegnummer(["GS-2026-003"], "2026", "GS")).toBe("GS-2026-004");
  });
});
