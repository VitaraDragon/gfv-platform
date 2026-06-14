import { describe, it, expect } from "vitest";
import {
  tryTonyLavoroEntityParse,
  enrichLavoroCommandFormData,
  slimContextForLavoroFormFollowUp,
  isTonyLavoroCreationIntent,
  resolveWeekdayDate,
  extractDurationDays,
  resolvePerson,
} from "../functions/tony-lavoro-entity-parser.js";

/** Fixture allineata a PLAN §1.3 (campo reale 2026-05-25). */
const FIXTURE_CTX = {
  azienda: {
    terreni: [
      { id: "terr-trebbiano", nome: "Trebbiano", coltura: "Vite da Vino" },
      { id: "terr-pinot", nome: "Pinot", coltura: "Vite da Vino" },
    ],
    tipiLavoro: [
      { nome: "Erpicatura Generale" },
      { nome: "Erpicatura Meccanica" },
      { nome: "Trinciatura tra le file" },
    ],
    trattori: [
      { id: "tr-agrifull", nome: "Agrifull", cavalli: 55 },
      { id: "tr-t5", nome: "Nuovo T5", cavalli: 80 },
    ],
    attrezzi: [
      { id: "at-erpice", nome: "Erpice rotante", cavalliMinimiRichiesti: 40 },
      { id: "at-trincia", nome: "Trincia 2m", cavalliMinimiRichiesti: 50 },
    ],
  },
  lavori: {
    operaiList: [{ id: "MAvfR5HdLuca", nome: "Luca", cognome: "Rossi" }],
    caposquadraList: [{ id: "cap-mario", nome: "Mario", cognome: "Bianchi" }],
    trattoriList: [{ id: "tr-agrifull", nome: "Agrifull" }],
    attrezziList: [{ id: "at-erpice", nome: "Erpice rotante" }],
  },
};

const MSG_13 =
  "crea un lavoro per luca… erpicatura trebbiano con agrifull e erpice rotante… inizio mercoledì e durata 1 giorno";

describe("tony-lavoro-entity-parser", () => {
  it("isTonyLavoroCreationIntent riconosce crea lavoro", () => {
    expect(isTonyLavoroCreationIntent(MSG_13, {})).toBe(true);
    expect(isTonyLavoroCreationIntent("crea un preventivo per Rossi", {})).toBe(false);
  });

  it("§1.3 — entity-first: ≥12 campi, earlyReturn, operaio e mezzi senza ambiguità", () => {
    const hit = tryTonyLavoroEntityParse({ message: MSG_13, ctx: FIXTURE_CTX });
    expect(hit).not.toBeNull();
    expect(hit.earlyReturn).toBe(true);
    expect(hit.fieldsCount).toBeGreaterThanOrEqual(12);
    expect(hit.coreCount).toBeGreaterThanOrEqual(8);
    const fd = hit.formData;
    expect(fd["lavoro-terreno"]).toBeTruthy();
    expect(String(fd["lavoro-operaio"] || "").toLowerCase()).toContain("luca");
    expect(fd["tipo-assegnazione"]).toBe("autonomo");
    expect(String(fd["lavoro-trattore"] || "").toLowerCase()).toContain("agrifull");
    expect(String(fd["lavoro-attrezzo"] || "").toLowerCase()).toContain("erpice");
    expect(fd["lavoro-durata"]).toBe("1");
    expect(fd["lavoro-data-inizio"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(hit.text.toLowerCase()).not.toMatch(/a chi lo assegno/);
    expect(hit.text.toLowerCase()).not.toMatch(/quale trattore/);
    expect(hit.command.type).toBe("OPEN_MODAL");
    expect(hit.command.id).toBe("lavoro-modal");
  });

  it("form già aperto → INJECT_FORM_DATA", () => {
    const hit = tryTonyLavoroEntityParse({
      message: MSG_13,
      ctx: { ...FIXTURE_CTX, form: { formId: "lavoro-form" } },
    });
    expect(hit.command.type).toBe("INJECT_FORM_DATA");
    expect(hit.command.formId).toBe("lavoro-form");
  });

  it("due trattori agrifull → ambiguità trattore", () => {
    const ctx = {
      ...FIXTURE_CTX,
      azienda: {
        ...FIXTURE_CTX.azienda,
        trattori: [
          { id: "t1", nome: "Agrifull 55" },
          { id: "t2", nome: "Agrifull 80" },
        ],
      },
    };
    const hit = tryTonyLavoroEntityParse({
      message: "crea lavoro erpicatura pinot con agrifull per luca domani 1 giorno",
      ctx,
    });
    expect(hit).not.toBeNull();
    expect(hit.ambiguities.some((a) => a.field === "trattore")).toBe(true);
    expect(hit.text).toBe("Ti porto a gestione lavori.");
    const hitOpen = tryTonyLavoroEntityParse({
      message: "crea lavoro erpicatura pinot con agrifull per luca domani 1 giorno",
      ctx: { ...ctx, form: { formId: "lavoro-form" } },
    });
    expect(hitOpen.text).toMatch(/trattore/i);
  });

  it("canary pinot/luca/trincia — regressione base", () => {
    const hit = tryTonyLavoroEntityParse({
      message: "crea un lavoro di trinciatura nel pinot per luca",
      ctx: FIXTURE_CTX,
    });
    expect(hit).not.toBeNull();
    expect(hit.formData["lavoro-terreno"]).toBeTruthy();
    expect(String(hit.formData["lavoro-operaio"] || "").toLowerCase()).toContain("luca");
    expect(String(hit.formData["lavoro-tipo-lavoro"] || "").toLowerCase()).toMatch(/trinciatur/);
  });

  it("enrichLavoroCommandFormData riempie gap Gemini", () => {
    const partial = { "lavoro-nome": "Test" };
    const enriched = enrichLavoroCommandFormData(partial, MSG_13, FIXTURE_CTX);
    expect(enriched["lavoro-operaio"]).toBeTruthy();
    expect(enriched["lavoro-trattore"]).toBeTruthy();
    expect(Object.keys(enriched).length).toBeGreaterThan(3);
  });

  it("slimContextForLavoroFormFollowUp omette items lavori", () => {
    const slim = slimContextForLavoroFormFollowUp({
      form: { formId: "lavoro-form" },
      page: {
        currentTableData: { pageType: "lavori", summary: "68 lavori", items: [{ id: "1" }] },
      },
    });
    expect(slim.page.currentTableData.items).toEqual([]);
    expect(slim.page.currentTableData._slimFollowUp).toBe(true);
  });

  it("resolveWeekdayDate mercoledì → ISO", () => {
    expect(resolveWeekdayDate("inizio mercoledì")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("extractDurationDays 1 giorno", () => {
    expect(extractDurationDays("durata 1 giorno")).toBe(1);
    expect(extractDurationDays("un giorno")).toBe(1);
    expect(extractDurationDays("per un giorno")).toBe(1);
    expect(extractDurationDays("il lavoro dura un giorno")).toBe(1);
  });

  it("extractDurationDays durata 1 senza 'giorno' (canary 3b-C1)", () => {
    expect(extractDurationDays("inizio mercoledì durata 1")).toBe(1);
    expect(extractDurationDays("durata di 3")).toBe(3);
  });

  it("canary 3b-C1 — messaggio completo con durata 1", () => {
    const msg =
      "crea un lavoro per luca erpicatura trebbiano con nuovo t5 e erpice rotante inizio mercoledì durata 1";
    const hit = tryTonyLavoroEntityParse({ message: msg, ctx: FIXTURE_CTX });
    expect(hit).not.toBeNull();
    expect(hit.formData["lavoro-durata"]).toBe("1");
    expect(hit.fieldsCount).toBeGreaterThanOrEqual(13);
  });

  it("resolvePerson per luca univoco", () => {
    const p = resolvePerson("lavoro per luca nel trebbiano", FIXTURE_CTX.lavori.operaiList, FIXTURE_CTX.lavori.caposquadraList);
    expect(p.ambiguous).toBe(false);
    expect(String(p.label || "").toLowerCase()).toContain("luca");
  });

  it("due operai luca → ambiguità operaio (entity-first)", () => {
    const ctx = {
      ...FIXTURE_CTX,
      lavori: {
        ...FIXTURE_CTX.lavori,
        operaiList: [
          { id: "op-lr", nome: "Luca", cognome: "Rossi" },
          { id: "op-lb", nome: "Luca", cognome: "Bianchi" },
        ],
      },
    };
    const hit = tryTonyLavoroEntityParse({
      message: "crea lavoro erpicatura pinot per luca domani 1 giorno",
      ctx: { ...ctx, form: { formId: "lavoro-form" } },
    });
    expect(hit).not.toBeNull();
    expect(hit.ambiguities.some((a) => a.field === "operaio")).toBe(true);
    expect(hit.formData["lavoro-operaio"]).toBeFalsy();
    expect(hit.text.toLowerCase()).toMatch(/a chi lo assegno/);
    expect(hit.text).toMatch(/Luca Rossi/);
    expect(hit.text).toMatch(/Luca Bianchi/);
  });

  it("senza trattore nel messaggio — non imposta trattore se 2+ compatibili con erpice", () => {
    const ctx2tr = {
      ...FIXTURE_CTX,
      azienda: {
        ...FIXTURE_CTX.azienda,
        trattori: [
          { id: "tr-agrifull", nome: "Agrifull", cavalli: 85 },
          { id: "tr-t5", nome: "Nuovo T5", cavalli: 90 },
        ],
        attrezzi: [{ id: "at-erpice", nome: "Erpice rotante", cavalliMinimiRichiesti: 80 }],
      },
    };
    const msg = "crea lavoro per luca inizio mercoledì durata 1 giorno erpicatura larghetta";
    const hit = tryTonyLavoroEntityParse({ message: msg, ctx: ctx2tr });
    expect(hit).not.toBeNull();
    expect(hit.formData["lavoro-attrezzo"]).toBeFalsy();
    expect(hit.formData["lavoro-trattore"]).toBeFalsy();
    expect(hit.text).toBe("Ti porto a gestione lavori.");
    expect(hit.text.toLowerCase()).not.toContain("attrezzo");
  });

  it("OPEN_MODAL — 2 erpici nel tenant, form chiuso: solo navigazione senza domanda attrezzo", () => {
    const ctxMulti = {
      ...FIXTURE_CTX,
      azienda: {
        ...FIXTURE_CTX.azienda,
        attrezzi: [
          { id: "at-200", nome: "erpice rotante 200", cavalliMinimiRichiesti: 40 },
          { id: "at-350", nome: "erpice rotante 350", cavalliMinimiRichiesti: 100 },
        ],
      },
    };
    const msg = "crea lavoro per luca inizio mercoledì durata 1 giorno erpicatura larghetta";
    const hit = tryTonyLavoroEntityParse({ message: msg, ctx: ctxMulti });
    expect(hit).not.toBeNull();
    expect(hit.text).toBe("Ti porto a gestione lavori.");
    expect(hit.ambiguities.some((a) => a.field === "attrezzo")).toBe(false);
  });

  it("enrichLavoroCommandFormData rimuove trattore Gemini non dichiarato", () => {
    const ctx2tr = {
      ...FIXTURE_CTX,
      azienda: {
        ...FIXTURE_CTX.azienda,
        trattori: [
          { id: "tr-agrifull", nome: "Agrifull", cavalli: 85 },
          { id: "tr-t5", nome: "Nuovo T5", cavalli: 90 },
        ],
        attrezzi: [{ id: "at-erpice", nome: "Erpice rotante", cavalliMinimiRichiesti: 80 }],
      },
    };
    const msg = "crea lavoro per luca inizio mercoledì durata 1 erpicatura larghetta";
    const geminiFd = {
      "lavoro-trattore": "Agrifull",
      "lavoro-attrezzo": "Erpice rotante",
      "lavoro-tipo-lavoro": "Erpicatura Tra le File",
    };
    const enriched = enrichLavoroCommandFormData(geminiFd, msg, ctx2tr);
    expect(enriched["lavoro-attrezzo"]).toBeTruthy();
    expect(enriched["lavoro-trattore"]).toBeFalsy();
  });
});
