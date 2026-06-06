import { createRequire } from "module";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const { classifyTonyIntentShadow, previewQuickReplyMatch } = require("../functions/tony-intent-router.js");

const ctxManager = {
  moduli_attivi: ["tony", "contoTerzi", "magazzino", "parcoMacchine"],
  dashboard: { moduli_attivi: ["tony", "contoTerzi", "magazzino", "parcoMacchine"] },
};

describe("classifyTonyIntentShadow", () => {
  it("classifica consultazione tariffa come binario A tier T2", () => {
    const r = classifyTonyIntentShadow({
      message: "quanto costa trinciatura in collina?",
      ctx: ctxManager,
    });
    expect(r.shadowMode).toBe(false);
    expect(r.tierEnforcement).toBe(true);
    expect(r.binario).toBe("A");
    expect(r.tierUsed).toBe(r.tierCalculated);
    expect(["T2", "T4"]).toContain(r.tierCalculated);
    expect(r.quickReplyCandidate).toBe("query_tariffa_costo");
  });

  it("classifica crea lavoro come binario C", () => {
    const r = classifyTonyIntentShadow({
      message: "crea un lavoro di erpicatura nel casetti",
      ctx: ctxManager,
    });
    expect(r.binario).toBe("C");
    expect(r.tierCalculated).toBe("T4");
  });

  it("classifica navigazione come binario B", () => {
    const r = classifyTonyIntentShadow({
      message: "portami alle tariffe",
      ctx: ctxManager,
    });
    expect(r.binario).toBe("B");
    expect(r.domains).toContain("navigazione");
  });

  it("profilo campo → T0", () => {
    const r = classifyTonyIntentShadow({
      message: "segna le ore di oggi",
      ctx: ctxManager,
      tonyFieldProfile: "operaio",
    });
    expect(r.tierCalculated).toBe("T0");
    expect(r.binario).toBe("C");
  });

  it("form attività aperto → binario C tier almeno T3", () => {
    const r = classifyTonyIntentShadow({
      message: "terreno larghetta",
      ctx: ctxManager,
      formId: "attivita-form",
    });
    expect(r.binario).toBe("C");
    expect(r.tierCalculated).toBe("T3");
    expect(r.domains).toContain("form_operativo");
  });

  it("messaggio multi-dominio marcato ambiguous", () => {
    const r = classifyTonyIntentShadow({
      message: "domani trattamento con erpice, ho scorte di concime e che meteo c'è?",
      ctx: ctxManager,
    });
    expect(r.ambiguous).toBe(true);
    expect(r.tierCalculated).toBe("T4");
    expect(r.tierUsed).toBe("T4");
    expect(r.confidence).toBe("low");
  });

  it("classifica meteo operativo (trinciare domani) come binario A", () => {
    const r = classifyTonyIntentShadow({
      message: "posso trinciare domani nel seminativo?",
      ctx: { ...ctxManager, moduli_attivi: [...ctxManager.moduli_attivi, "meteo"] },
    });
    expect(r.binario).toBe("A");
    expect(r.tierUsed).not.toBe("T4_full");
  });

  it("crea lavoro usa tierUsed T4", () => {
    const r = classifyTonyIntentShadow({
      message: "crea un lavoro di erpicatura nel casetti",
      ctx: ctxManager,
    });
    expect(r.tierUsed).toBe("T4");
  });
});

describe("previewQuickReplyMatch", () => {
  it("non matcha se modulo mancante", () => {
    const id = previewQuickReplyMatch("quanto costa trinciatura?", {
      moduli_attivi: ["tony"],
      dashboard: { moduli_attivi: ["tony"] },
    });
    expect(id).toBeNull();
  });
});
