import { createRequire } from "module";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const {
  sliceContextAziendaToTier,
  resolveEffectiveTierMax,
  normalizeTierMax,
  tierRankNum,
} = require("../functions/tony-context-tier.js");

const fullCtx = {
  summaryScadenze: "ok",
  summarySottoScorta: "2 sotto scorta",
  prodottiSottoScorta: [{ id: "p1" }],
  guastiAperti: [{ id: "g1" }],
  clienti: [{ id: "c1" }],
  preventivi: [{ id: "pr1" }],
  tariffe: [{ id: "t1" }],
  tipiLavoro: [{ id: "tl1" }],
  categorie: [{ id: "cat1" }],
  colture: [{ id: "col1" }],
  poderi: [{ id: "pod1" }],
  terreni: [{ id: "ter1" }],
  terreniClienti: [],
  macchine: [{ id: "m1" }],
  trattori: [{ id: "tr1" }],
  attrezzi: [{ id: "at1" }],
  prodotti: [{ id: "prod1" }],
  movimentiRecenti: [{ id: "mov1" }],
  summaryMovimentiRecenti: "mov summary",
  meteo: { disponibile: true },
};

describe("sliceContextAziendaToTier", () => {
  it("T4 restituisce copia completa", () => {
    const sliced = sliceContextAziendaToTier(fullCtx, "T4");
    expect(sliced.terreni).toHaveLength(1);
    expect(sliced.prodotti).toHaveLength(1);
    expect(sliced.movimentiRecenti).toHaveLength(1);
  });

  it("T1 include solo summary e guasti", () => {
    const sliced = sliceContextAziendaToTier(fullCtx, "T1");
    expect(sliced.summaryScadenze).toBe("ok");
    expect(sliced.guastiAperti).toHaveLength(1);
    expect(sliced.clienti).toBeUndefined();
    expect(sliced.terreni).toBeUndefined();
    expect(sliced.prodotti).toBeUndefined();
    expect(sliced._contextTier).toBe("T1");
  });

  it("T2 include business senza terreni", () => {
    const sliced = sliceContextAziendaToTier(fullCtx, "T2");
    expect(sliced.tariffe).toHaveLength(1);
    expect(sliced.clienti).toHaveLength(1);
    expect(sliced.terreni).toBeUndefined();
    expect(sliced.trattori).toBeUndefined();
  });

  it("T3 include terreni e mezzi", () => {
    const sliced = sliceContextAziendaToTier(fullCtx, "T3");
    expect(sliced.terreni).toHaveLength(1);
    expect(sliced.trattori).toHaveLength(1);
    expect(sliced.prodotti).toBeUndefined();
  });

  it("preserva meteo indipendentemente dal tier", () => {
    const sliced = sliceContextAziendaToTier(fullCtx, "T1");
    expect(sliced.meteo).toEqual({ disponibile: true });
  });
});

describe("resolveEffectiveTierMax", () => {
  it("boost tier per quick reply tariffa (T2)", () => {
    const tier = resolveEffectiveTierMax({
      tierCalculated: "T1",
      quickReplyCandidate: "query_tariffa_costo",
      binario: "A",
      ambiguous: false,
      confidence: "high",
    });
    expect(tierRankNum(tier)).toBeGreaterThanOrEqual(2);
  });

  it("binario C ambiguo → T4", () => {
    const tier = resolveEffectiveTierMax({
      tierCalculated: "T3",
      binario: "C",
      ambiguous: true,
      confidence: "low",
    });
    expect(tier).toBe("T4");
  });

  it("T4_full legacy → T4", () => {
    expect(normalizeTierMax("T4_full")).toBe("T4");
  });
});
