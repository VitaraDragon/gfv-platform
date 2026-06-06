/**
 * FILTER_TABLE + SUM_COLUMN deterministico (binario B, Fase 4).
 * Solo pageType noti + richieste ovvie; in dubbio → null (fallback Gemini).
 */

const {
  normalizeItTony,
  shouldSkipQuickReply,
  isTonyOperationalCreationIntent,
} = require("./tony-quick-replies");

const SUPPORTED_PAGE_TYPES = new Set([
  "lavori",
  "terreni",
  "tariffe",
  "prodotti",
  "movimenti",
  "attivita",
  "clienti",
  "preventivi",
  "vendemmia",
  "tracciabilita_consumi",
]);

const FILTER_VERB_RE =
  /\b(filtra|mostra\s+solo|solo\s+gli|solo\s+le|solo\s+i|reset\s+filtri|pulisci\s+filtri|tutti\s+i\s+|mostra\s+tutti|azzera\s+filtri)\b/i;

const RESET_RE = /\b(reset\s+filtri|pulisci\s+filtri|azzera\s+filtri|mostra\s+tutti|tutti\s+i\s+|senza\s+filtri)\b/i;

function getPageType(ctx) {
  const page = (ctx && ctx.page) || {};
  const ctd = page.currentTableData;
  if (ctd && ctd.pageType) return String(ctd.pageType);
  if (page.pageType) return String(page.pageType);
  return null;
}

function isFilterRequest(message) {
  const msg = normalizeItTony(message);
  if (!msg) return false;
  if (/\b(portami|vai\s+a|apri\s+la\s+pagina)\b/i.test(msg) && !FILTER_VERB_RE.test(msg)) return false;
  if (FILTER_VERB_RE.test(msg)) return true;
  // Frasi ovvie su lista già aperta (canary: «solo attivi» su prodotti)
  if (
    /\bsolo\s+attiv\w*/i.test(msg) ||
    /\bsolo\s+disattiv\w*/i.test(msg) ||
    /\bsolo\s+entrat\w*/i.test(msg) ||
    /\bsolo\s+uscit\w*/i.test(msg) ||
    /\bin\s+corso\b/i.test(msg) ||
    /\bin\s+ritardo\b/i.test(msg)
  ) {
    return true;
  }
  if (/\bfiltra\s+per\b/i.test(msg)) return true;
  return false;
}

function isResetRequest(message) {
  return RESET_RE.test(normalizeItTony(message));
}

function extractTerrenoToken(message) {
  const m = String(message || "").match(
    /\b(?:filtra(?:\s+per)?|solo(?:\s+il)?|per)\s+(?:il\s+|l[''])?([a-zàèéìòù0-9][a-zàèéìòù0-9\s'-]{1,40})/i
  );
  if (m && m[1]) return m[1].trim();
  const m2 = String(message || "").match(/\bnel\s+([a-zàèéìòù][a-zàèéìòù0-9\s'-]{2,30})\b/i);
  if (m2 && m2[1]) return m2[1].trim();
  return null;
}

function resolveTerrenoValue(token, ctx) {
  if (!token) return null;
  const normTok = normalizeItTony(token);
  const page = (ctx && ctx.page) || {};
  const items = (page.currentTableData && page.currentTableData.items) || [];
  const names = new Set();
  for (const it of items) {
    const n = String(it.terreno || it.terrenoNome || it.nomeTerreno || "").trim();
    if (n) names.add(n);
  }
  const terreni = (ctx.azienda && ctx.azienda.terreni) || [];
  for (const t of terreni) {
    const n = String(t.nome || "").trim();
    if (n) names.add(n);
  }
  let best = null;
  let bestLen = 0;
  for (const n of names) {
    const nn = normalizeItTony(n);
    if (nn.includes(normTok) || normTok.includes(nn)) {
      if (nn.length > bestLen) {
        best = n;
        bestLen = nn.length;
      }
    }
  }
  return best;
}

function resolveProdottiAttivo(message) {
  const msg = normalizeItTony(message);
  if (/\bdisattiv|non\s+attiv/i.test(msg)) return "false";
  if (/\b(solo\s+)?attiv/i.test(msg)) return "true";
  return null;
}

function resolveTariffeAttiva(message) {
  const msg = normalizeItTony(message);
  if (/\bdisattiv/i.test(msg)) return "false";
  if (/\b(solo\s+)?attiv/i.test(msg)) return "true";
  return null;
}

function resolveLavoriStato(message) {
  const msg = normalizeItTony(message);
  if (/\b(in\s+corso|corso)\b/.test(msg)) return "in_corso";
  if (/\bcompletat/.test(msg)) return "completato";
  if (/\bprogrammat/.test(msg)) return "programmato";
  if (/\britard/.test(msg)) return "in_ritardo";
  return null;
}

function trySumColumnQuickReply(message, ctx) {
  const msg = normalizeItTony(message);
  if (!/\b(quanto|totale|somma|quintali|kg|litri|superficie|ettari|ha\b)/i.test(msg)) return null;
  const pageType = getPageType(ctx);
  const page = (ctx && ctx.page) || {};
  const ctd = page.currentTableData || {};

  if (pageType === "vendemmia" && Array.isArray(ctd.vendemmiaAggregates) && ctd.vendemmiaAggregates.length) {
    const varietaTok = extractTerrenoToken(message) || msg.match(/\b(pinot|trebbiano|sangiovese|chardonnay)\w*/i)?.[0];
    let agg = ctd.vendemmiaAggregates;
    if (varietaTok) {
      const vn = normalizeItTony(varietaTok);
      agg = agg.filter((a) => normalizeItTony(String(a.varieta || "")).includes(vn));
    }
    if (!agg.length) return null;
    const lines = agg.slice(0, 5).map((a) => {
      const q = a.totaleQli != null ? a.totaleQli : a.quantitaQli;
      return `${a.varieta || "Varietà"}: ${q != null ? q : "?"} qli`;
    });
    return {
      id: "sum_column_vendemmia",
      text: `Totale vendemmia in lista: ${lines.join("; ")}.`,
      command: null,
    };
  }

  if (pageType === "tracciabilita_consumi" && Array.isArray(ctd.consumiAggregates) && ctd.consumiAggregates.length) {
    const terreno = resolveTerrenoValue(extractTerrenoToken(message), ctx);
    let agg = ctd.consumiAggregates;
    if (terreno) {
      const tn = normalizeItTony(terreno);
      agg = agg.filter((a) => normalizeItTony(String(a.terreno || "")).includes(tn));
    }
    if (!agg.length) return null;
    const lines = agg.slice(0, 5).map((a) => {
      const q = a.quantitaTotale != null ? a.quantitaTotale : "?";
      const u = a.unitaMisura || "";
      return `${a.prodotto || "Prodotto"} (${a.terreno || "terreno"}): ${q} ${u}`.trim();
    });
    return {
      id: "sum_column_consumi",
      text: lines.join("; "),
      command: null,
    };
  }

  return null;
}

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command?: object|null }|null}
 */
function tryTonyFilterTableQuickReply(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  if (shouldSkipQuickReply(message, ctx)) return null;
  if (isTonyOperationalCreationIntent(message)) return null;

  const sumHit = trySumColumnQuickReply(message, ctx);
  if (sumHit) return sumHit;

  if (!isFilterRequest(message)) return null;

  const pageType = getPageType(ctx);
  if (!pageType || !SUPPORTED_PAGE_TYPES.has(pageType)) return null;

  if (isResetRequest(message)) {
    return {
      id: "filter_table_reset",
      text: "Azzero i filtri della tabella.",
      command: { type: "FILTER_TABLE", params: { filterType: "reset", value: "" } },
    };
  }

  if (pageType === "prodotti") {
    const attivo = resolveProdottiAttivo(message);
    if (attivo) {
      return {
        id: "filter_table_prodotti_attivo",
        text: attivo === "true" ? "Mostro solo i prodotti attivi." : "Mostro solo i prodotti disattivati.",
        command: { type: "FILTER_TABLE", params: { attivo } },
      };
    }
  }

  if (pageType === "tariffe") {
    const attiva = resolveTariffeAttiva(message);
    if (attiva) {
      return {
        id: "filter_table_tariffe_attiva",
        text: attiva === "true" ? "Mostro solo le tariffe attive." : "Mostro le tariffe disattivate.",
        command: { type: "FILTER_TABLE", params: { attiva } },
      };
    }
  }

  if (pageType === "lavori") {
    const stato = resolveLavoriStato(message);
    if (stato) {
      const labels = {
        in_corso: "in corso",
        completato: "completati",
        programmato: "programmati",
        in_ritardo: "in ritardo",
      };
      return {
        id: "filter_table_lavori_stato",
        text: `Filtro i lavori ${labels[stato] || stato}.`,
        command: { type: "FILTER_TABLE", params: { stato } },
      };
    }
    const token = extractTerrenoToken(message);
    const terreno = resolveTerrenoValue(token, ctx);
    if (terreno) {
      return {
        id: "filter_table_lavori_terreno",
        text: `Filtro i lavori per ${terreno}.`,
        command: { type: "FILTER_TABLE", params: { terreno } },
      };
    }
  }

  if (pageType === "terreni") {
    const token = extractTerrenoToken(message);
    if (token && /\baffitt/i.test(normalizeItTony(message))) {
      return {
        id: "filter_table_terreni_possesso",
        text: "Mostro i terreni in affitto.",
        command: { type: "FILTER_TABLE", params: { possesso: "affitto" } },
      };
    }
    if (/\bseminativ/i.test(normalizeItTony(message))) {
      return {
        id: "filter_table_terreni_categoria",
        text: "Filtro per categoria seminativo.",
        command: { type: "FILTER_TABLE", params: { categoria: "Seminativo" } },
      };
    }
  }

  if (pageType === "movimenti") {
    const msg = normalizeItTony(message);
    if (/\b(solo\s+)?entrat/i.test(msg)) {
      return {
        id: "filter_table_movimenti_entrata",
        text: "Mostro solo le entrate.",
        command: { type: "FILTER_TABLE", params: { tipo: "entrata" } },
      };
    }
    if (/\b(solo\s+)?uscit/i.test(msg)) {
      return {
        id: "filter_table_movimenti_uscita",
        text: "Mostro solo le uscite.",
        command: { type: "FILTER_TABLE", params: { tipo: "uscita" } },
      };
    }
  }

  return null;
}

module.exports = {
  SUPPORTED_PAGE_TYPES,
  tryTonyFilterTableQuickReply,
  trySumColumnQuickReply,
  isFilterRequest,
  getPageType,
};
