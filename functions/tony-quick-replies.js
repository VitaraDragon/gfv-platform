/**
 * Quick reply deterministiche Tony — config > codice (QUICK_REPLY_MAP).
 * Binario A: consultazione numeri/elenco da ctx.azienda senza Gemini.
 */

const {
  getModuliAttiviFromCtx,
  isQuickReplyAllowed,
  quickReplyBlockedMessage,
  filterScadenzeQuickReplyText,
} = require("./tony-module-gate");

function normalizeItTony(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function flexIncludes(hay, needle) {
  const h = normalizeItTony(hay);
  const n = normalizeItTony(needle);
  if (!n || n.length < 2) return false;
  return h.includes(n);
}

function matchTipoLavoro(message, tipiLavoro) {
  const msg = normalizeItTony(message);
  const list = Array.isArray(tipiLavoro) ? tipiLavoro : [];
  let best = null;
  let bestLen = 0;
  for (const t of list) {
    const nome = String(t.nome || t.tipoLavoro || "").trim();
    if (!nome) continue;
    const nn = normalizeItTony(nome);
    if (nn.length >= 4 && msg.includes(nn)) {
      if (nn.length > bestLen) {
        best = nome;
        bestLen = nn.length;
      }
    }
  }
  if (best) return best;

  const synonyms = [
    { re: /\baratur/, name: "aratura" },
    { re: /\berpic/, name: "erpicatura" },
    { re: /\bdiserb/, name: "diserbo" },
    { re: /\bpotatur/, name: "potatura" },
    { re: /\bvendemm/, name: "vendemmia" },
    { re: /\btrinci/, name: "trinciatura" },
    { re: /\bfres/, name: "fresatura" },
    { re: /\bsemina\b/, name: "semina" },
  ];
  let hint = null;
  for (const syn of synonyms) {
    if (syn.re.test(msg)) {
      hint = syn.name;
      break;
    }
  }
  if (!hint) return null;
  for (const t of list) {
    const nome = String(t.nome || t.tipoLavoro || "").trim();
    if (!nome) continue;
    const nn = normalizeItTony(nome);
    if (nn.includes(hint) || hint.includes(nn.split(/\s+/)[0] || "")) {
      if (nn.length > bestLen) {
        best = nome;
        bestLen = nn.length;
      }
    }
  }
  return best;
}

function resolveCategoriaFromMessage(message, categorie, colture) {
  const msg = normalizeItTony(message);
  const cats = Array.isArray(categorie) ? categorie : [];
  const cols = Array.isArray(colture) ? colture : [];

  for (const c of cats) {
    const nome = String(c.nome || "").trim();
    if (nome.length >= 4 && msg.includes(normalizeItTony(nome))) {
      return { categoriaId: c.id, nomeCategoria: nome, colturaRichiesta: null };
    }
  }
  if (/\bseminativ/.test(msg)) {
    const cat = cats.find((c) => flexIncludes(c.nome, "seminativo"));
    if (cat) return { categoriaId: cat.id, nomeCategoria: cat.nome, colturaRichiesta: null };
  }
  if (/\bvignet/.test(msg)) {
    const cat = cats.find((c) => flexIncludes(c.nome, "vigneto"));
    if (cat) return { categoriaId: cat.id, nomeCategoria: cat.nome, colturaRichiesta: null };
  }
  if (/\bfruttet/.test(msg)) {
    const cat = cats.find((c) => flexIncludes(c.nome, "frutteto"));
    if (cat) return { categoriaId: cat.id, nomeCategoria: cat.nome, colturaRichiesta: null };
  }

  for (const col of cols) {
    const nome = String(col.nome || "").trim();
    if (nome.length >= 3 && msg.includes(normalizeItTony(nome))) {
      const cat = cats.find((c) => c.id === col.categoriaId);
      return {
        categoriaId: col.categoriaId || (cat && cat.id),
        nomeCategoria: (cat && cat.nome) || "coltura",
        colturaRichiesta: nome,
      };
    }
  }
  return null;
}

function resolveTipoCampo(message) {
  const msg = normalizeItTony(message);
  if (/\bmontagna\b/.test(msg)) return "montagna";
  if (/\bcollina\b/.test(msg)) return "collina";
  if (/\bpianura\b/.test(msg)) return "pianura";
  return null;
}

function tariffaFinale(t) {
  const base = Number(t.tariffaBase) || 0;
  const coeff = Number(t.coefficiente);
  const c = Number.isFinite(coeff) && coeff > 0 ? coeff : 1;
  return Math.round(base * c * 100) / 100;
}

/**
 * Algoritmo DOMANDE SUI COSTI (allineato a SYSTEM_INSTRUCTION_ADVANCED).
 * @returns {string|null}
 */
function resolveTariffaDeterministica(azienda, message) {
  if (!azienda || typeof message !== "string") return null;
  const tariffe = (azienda.tariffe || []).filter((t) => t.attiva !== false);
  if (!tariffe.length) {
    return "Non ho tariffe attive nel listino. Verifica in Gestione Tariffe.";
  }

  const catInfo = resolveCategoriaFromMessage(message, azienda.categorie, azienda.colture);
  const tipoCampo = resolveTipoCampo(message);
  const tipoLavoroNome = matchTipoLavoro(message, azienda.tipiLavoro);

  if (!tipoLavoroNome) {
    return null;
  }

  const msgNorm = normalizeItTony(message);
  const matchTariffa = (pool, requireColtura) => {
    return pool.find((t) => {
      if (tipoCampo && String(t.tipoCampo || "").toLowerCase() !== tipoCampo) return false;
      const tl = String(t.tipoLavoro || "");
      if (!flexIncludes(tl, tipoLavoroNome) && !flexIncludes(tipoLavoroNome, tl)) return false;
      if (catInfo && catInfo.categoriaId && String(t.categoriaColturaId || "") !== String(catInfo.categoriaId)) {
        return false;
      }
      const col = String(t.coltura || "").trim();
      if (requireColtura && catInfo && catInfo.colturaRichiesta) {
        return flexIncludes(col, catInfo.colturaRichiesta);
      }
      if (!requireColtura) {
        return !col;
      }
      return false;
    });
  };

  let specifica = null;
  if (catInfo && catInfo.colturaRichiesta) {
    specifica = matchTariffa(tariffe, true);
  }
  let generica = matchTariffa(tariffe, false);
  if (!generica && catInfo) {
    generica = tariffe.find((t) => {
      if (tipoCampo && String(t.tipoCampo || "").toLowerCase() !== tipoCampo) return false;
      const tl = String(t.tipoLavoro || "");
      if (!flexIncludes(tl, tipoLavoroNome) && !flexIncludes(tipoLavoroNome, tl)) return false;
      if (catInfo.categoriaId && String(t.categoriaColturaId || "") !== String(catInfo.categoriaId)) return false;
      return !String(t.coltura || "").trim();
    });
  }

  const picked = specifica || generica;
  if (!picked) {
    const catLabel = (catInfo && catInfo.nomeCategoria) || "quella categoria";
    const campoLabel = tipoCampo || "quel tipo di campo";
    return `Non ho trovato una tariffa attiva per ${tipoLavoroNome} nel ${catLabel} in ${campoLabel}. Verifica in Gestione Tariffe.`;
  }

  const euro = tariffaFinale(picked);
  const campoTxt = tipoCampo ? ` in ${tipoCampo}` : "";
  if (specifica) {
    return `Costa ${euro} euro per ettaro (${tipoLavoroNome}${campoTxt}).`;
  }
  if (catInfo && catInfo.colturaRichiesta) {
    return `Non c'è una tariffa specifica per ${catInfo.colturaRichiesta}, ma la tariffa generica per ${catInfo.nomeCategoria}${campoTxt} costa ${euro} euro per ettaro.`;
  }
  return `Costa ${euro} euro per ettaro (${tipoLavoroNome}${campoTxt}).`;
}

function formatGuastiAperti(guasti) {
  const list = Array.isArray(guasti) ? guasti : [];
  if (list.length === 0) return "Non risultano guasti aperti nel parco macchine.";
  const n = list.length;
  const lines = list.slice(0, 5).map((g) => {
    const mac = g.macchina || g.nome || "Macchina";
    const gr = g.gravita ? ` (${g.gravita})` : "";
    return `${mac}${gr}`;
  });
  let text = n === 1 ? "C'è 1 guasto aperto" : `Ci sono ${n} guasti aperti`;
  text += ": " + lines.join("; ");
  if (n > 5) text += `; e altri ${n - 5}.`;
  else text += ".";
  return text;
}

/** invia | accetta_manager | null — allineato a index.js */
function detectPreventivoListActionVerb(message) {
  const msgNorm = normalizeItTony(message);
  if (!/\bpreventiv/.test(msgNorm)) return null;
  const invia = /\b(invia|invio|manda|spedisc|inviare|mandare|spedire)\b/.test(msgNorm);
  const accetta = /\b(accetta|accettare|accettalo)\b/.test(msgNorm);
  if (invia && accetta) {
    const mInv = msgNorm.match(/\b(invia|invio|manda|spedisc)\b/);
    const mAcc = msgNorm.match(/\b(accetta|accettare|accettalo)\b/);
    const iInv = mInv ? msgNorm.indexOf(mInv[0]) : 9999;
    const iAcc = mAcc ? msgNorm.indexOf(mAcc[0]) : 9999;
    return iInv < iAcc ? "invia" : "accetta_manager";
  }
  if (invia) return "invia";
  if (accetta) return "accetta_manager";
  return null;
}

function isTonyOperationalCreationIntent(message) {
  if (!message || typeof message !== "string") return false;
  const msg = normalizeItTony(message);
  if (
    /\b(crea|nuovo|compila|prepara|programma|pianifica|assegna|schedula)\s*(un?\s*)?(lavoro|attivit|preventivo|offerta|quotazione)/.test(
      msg
    )
  ) {
    return true;
  }
  if (
    /\b(crea|nuovo|programma|pianifica|assegna|schedula)\s*(un?\s*)?(potatur|erpicatur|trinciatur|vendemmi|fresatur)/.test(
      msg
    )
  ) {
    return true;
  }
  if (/\b(preventivo|offerta|quotazione)\s+(per|di|del|della)\b/.test(msg)) return true;
  if (/\b(preventiv\w*|preventio)\b/.test(msg) && /\b(crea|nuovo|compila|prepara|fai|fammi)\b/.test(msg)) return true;
  if (/\b(mi\s+fai\s+(un\s+)?preventivo|compila\s+(il\s+)?form)\b/.test(msg)) return true;
  if (/\b(dobbiamo|devo|devi|voglio|vogliamo)\s+(trinciare|erpicare|potare|arare|fresare|seminare)\b/.test(msg)) {
    return true;
  }
  return false;
}

/**
 * Messaggio utente che corregge tipo/sottocategoria lavoro nel form (es. preventivo aperto),
 * non una domanda meteo operativa.
 */
function isTonyPreventivoFormFieldCorrection(message, ctx) {
  if (!message || typeof message !== "string") return false;
  const msg = normalizeItTony(message);
  const hasWorkWord = /\b(trinciatur\w*|erpicatur\w*|potatur\w*|diserb\w*|aratur\w*|fresatur\w*|semin\w*|lavorazion\w*)\b/.test(msg);
  const hasFormHint =
    /\b(sottocategor|tipo\s+lavoro|tra\s+le\s+file|sulla\s+fila|pieno\s+campo|lavorazione\s+(è|e'))\b/.test(msg) ||
    /^[\s]*(è|e'|e\s)\s+/.test(msg);
  const hasPlanning =
    /\b(posso|conviene|meglio|programm|domani|oggi|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|pioggia|meteo|alternativ|consigli)\b/.test(
      msg
    );
  if (!hasWorkWord || !hasFormHint || hasPlanning) return false;
  if (ctx && ctx.form) {
    const fid = String(ctx.form.formId || ctx.form.modalId || "");
    if (fid === "preventivo-form" || /preventivo/i.test(fid)) return true;
  }
  if (ctx && ctx.page && /preventivo/i.test(String(ctx.page.pageType || ctx.page.url || ""))) return true;
  if (/\b(sottocategor|tipo\s+lavoro)\b/.test(msg)) return true;
  return false;
}

function shouldSkipQuickReply(message, ctx) {
  if (!message || typeof message !== "string") return true;
  if (detectPreventivoListActionVerb(message)) return true;
  if (isTonyOperationalCreationIntent(message)) return true;
  if (isTonyPreventivoFormFieldCorrection(message, ctx)) return true;
  const msg = normalizeItTony(message);
  if (ctx && ctx.form) {
    const fid = String(ctx.form.formId || ctx.form.modalId || "");
    if (fid.includes("trattamento") || fid === "form-trattamento") return true;
    if (fid === "preventivo-form" || /preventivo/i.test(fid)) return true;
  }
  if (/\b(ok\s+salva|salva\s+(il|l'|la)|confermo\s+il\s+salvataggio|registra\s+(lo\s+)?scarico)\b/.test(msg)) {
    return true;
  }
  return false;
}

const QUICK_REPLY_MAP = [
  {
    id: "query_scorte",
    keywords: [
      /sotto\s*scorta/i,
      /scorte\s+basse/i,
      /scorte\s+minime/i,
      /\besaurit/i,
      /giacenz/i,
      /prodott\w+\s+(sotto|in\s+sotto)/i,
    ],
    tierRequired: "T1",
    domains: ["magazzino"],
    execute(ctx) {
      const a = ctx.azienda || {};
      const summary = typeof a.summarySottoScorta === "string" ? a.summarySottoScorta.trim() : "";
      const det = Array.isArray(a.prodottiSottoScorta) ? a.prodottiSottoScorta : [];
      if (summary) return summary;
      if (det.length === 0) return "Non risultano prodotti sotto scorta tra quelli con soglia impostata.";
      const lines = det.slice(0, 8).map((p) => {
        const nome = p.nome || p.codice || "Prodotto";
        const giac = p.giacenza != null ? p.giacenza : "?";
        const sog = p.sogliaMinima != null ? p.sogliaMinima : p.scortaMinima;
        return `${nome}: giacenza ${giac}, soglia ${sog != null ? sog : "—"}`;
      });
      return `${det.length} prodotti sotto scorta: ${lines.join("; ")}${det.length > 8 ? "…" : ""}.`;
    },
  },
  {
    id: "query_scadenze",
    keywords: [/scadenze?/i, /affitt/i, /revisione/i, /assicurazione/i, /cosa\s+scade/i],
    tierRequired: "T1",
    domains: ["scadenze", "macchine", "terreni"],
    execute(ctx, message) {
      const msg = normalizeItTony(message);
      if (/\btariff|clienti|preventiv|moviment|scort|guast/i.test(msg) && !/scaden/i.test(msg)) {
        return null;
      }
      const a = ctx.azienda || {};
      const summary = typeof a.summaryScadenze === "string" ? a.summaryScadenze.trim() : "";
      const moduliAttivi = getModuliAttiviFromCtx(ctx);
      if (summary) return filterScadenzeQuickReplyText(summary, moduliAttivi);
      return "Non ho riepilogo scadenze disponibile al momento.";
    },
  },
  {
    id: "query_tariffa_costo",
    keywords: [
      /quanto\s+costa/i,
      /\bcosta\s+(aratur|erpic|diserb|potatur|vendemm|semin|trinci)/i,
      /\btariffa\s+(per|di)/i,
      /€\s*\/\s*ha/i,
      /euro\s+per\s+ettaro/i,
      /listino/i,
    ],
    tierRequired: "T2",
    domains: ["conto_terzi", "tariffe"],
    execute(ctx, message) {
      return resolveTariffaDeterministica(ctx.azienda, message);
    },
  },
  {
    id: "query_conteggi_clienti",
    keywords: [
      /quanti\s+clienti/i,
      /quante\s+clienti/i,
      /numero\s+(di\s+)?clienti/i,
      /clienti\s+attivi/i,
      /clienti\s+sospesi/i,
    ],
    tierRequired: "T2",
    domains: ["conto_terzi", "clienti"],
    execute(ctx, message) {
      const msg = normalizeItTony(message);
      const clienti = ctx.azienda && Array.isArray(ctx.azienda.clienti) ? ctx.azienda.clienti : [];
      if (!clienti.length) return "Non ho clienti nel contesto aziendale.";
      if (/\battiv/.test(msg)) {
        const n = clienti.filter((c) => String(c.stato || "").toLowerCase() === "attivo").length;
        return `Ci sono ${n} clienti attivi su ${clienti.length} totali.`;
      }
      if (/\bsospes/.test(msg)) {
        const n = clienti.filter((c) => String(c.stato || "").toLowerCase() === "sospeso").length;
        return `Ci sono ${n} clienti sospesi su ${clienti.length} totali.`;
      }
      if (/\barchiviat/.test(msg)) {
        const n = clienti.filter((c) => String(c.stato || "").toLowerCase() === "archiviato").length;
        return `Ci sono ${n} clienti archiviati su ${clienti.length} totali.`;
      }
      return `In anagrafica ci sono ${clienti.length} clienti.`;
    },
  },
  {
    id: "query_conteggi_preventivi",
    keywords: [/quanti\s+preventiv/i, /quante\s+preventiv/i, /numero\s+(di\s+)?preventiv/i],
    tierRequired: "T2",
    domains: ["conto_terzi", "preventivi"],
    execute(ctx, message) {
      const msg = normalizeItTony(message);
      const prev = ctx.azienda && Array.isArray(ctx.azienda.preventivi) ? ctx.azienda.preventivi : [];
      if (!prev.length) return "Non ho preventivi nel contesto aziendale.";
      if (/\bbozz/.test(msg)) {
        const n = prev.filter((p) => String(p.stato || "") === "bozza").length;
        return `Ci sono ${n} preventivi in bozza su ${prev.length} totali.`;
      }
      if (/\binviat/.test(msg)) {
        const n = prev.filter((p) => String(p.stato || "") === "inviato").length;
        return `Ci sono ${n} preventivi inviati su ${prev.length} totali.`;
      }
      if (/\baccettat/.test(msg)) {
        const n = prev.filter((p) => String(p.stato || "").includes("accettat")).length;
        return `Ci sono ${n} preventivi accettati su ${prev.length} totali.`;
      }
      return `In gestione ci sono ${prev.length} preventivi.`;
    },
  },
  {
    id: "query_conteggi_tariffe",
    keywords: [/quante\s+tariffe/i, /quanti\s+tariffe/i, /numero\s+(di\s+)?tariffe/i, /tariffe\s+attive/i],
    tierRequired: "T2",
    domains: ["conto_terzi", "tariffe"],
    execute(ctx, message) {
      const msg = normalizeItTony(message);
      const tar = ctx.azienda && Array.isArray(ctx.azienda.tariffe) ? ctx.azienda.tariffe : [];
      if (!tar.length) return "Non ho tariffe nel contesto aziendale.";
      if (/\battiv/.test(msg)) {
        const n = tar.filter((t) => t.attiva === true).length;
        return `Ci sono ${n} tariffe attive su ${tar.length} totali.`;
      }
      if (/\bdisattiv/.test(msg)) {
        const n = tar.filter((t) => t.attiva === false).length;
        return `Ci sono ${n} tariffe disattivate su ${tar.length} totali.`;
      }
      return `Nel listino ci sono ${tar.length} tariffe.`;
    },
  },
  {
    id: "query_movimenti_recenti",
    keywords: [
      /ultimi\s+movimenti/i,
      /movimenti\s+recenti/i,
      /ultimi\s+(carichi|scarichi)/i,
      /carichi\s+e\s+scarichi/i,
      /cosa\s+[eè]\s+(entrato|uscito)/i,
    ],
    tierRequired: "T4",
    domains: ["magazzino"],
    execute(ctx) {
      const a = ctx.azienda || {};
      const summary = typeof a.summaryMovimentiRecenti === "string" ? a.summaryMovimentiRecenti.trim() : "";
      if (summary) return summary;
      const mov = Array.isArray(a.movimentiRecenti) ? a.movimentiRecenti : [];
      if (!mov.length) return "Non risultano movimenti magazzino recenti nel contesto.";
      return `Ho ${mov.length} movimenti recenti in anagrafica; apri Movimenti per l'elenco completo filtrabile.`;
    },
  },
  {
    id: "query_guasti_aperti",
    keywords: [/guasti?\s+apert/i, /quanti\s+guasti/i, /guasti?\s+da\s+(risolver|ripar)/i, /officina/i],
    tierRequired: "T1",
    domains: ["macchine"],
    execute(ctx, message) {
      const msg = normalizeItTony(message);
      if (/\bportami|\bapri\s+(la\s+)?pagina/i.test(msg)) return null;
      return formatGuastiAperti(ctx.azienda && ctx.azienda.guastiAperti);
    },
  },
];

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command?: object|null }|null}
 */
function tryTonyQuickReplies(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  const history = input && input.history;
  if (shouldSkipQuickReply(message, ctx)) return null;
  const moduliAttivi = getModuliAttiviFromCtx(ctx);

  for (const entry of QUICK_REPLY_MAP) {
    const keywords = entry.keywords || [];
    const matched = keywords.some((kw) => {
      if (kw instanceof RegExp) return kw.test(message);
      return String(message || "").toLowerCase().includes(String(kw).toLowerCase());
    });
    if (!matched) continue;
    if (!isQuickReplyAllowed(entry.id, moduliAttivi)) {
      return {
        id: entry.id + "_module_blocked",
        text: quickReplyBlockedMessage(entry.id, moduliAttivi),
        command: null,
      };
    }
    try {
      const text = entry.execute(ctx, message, history);
      if (text != null && String(text).trim()) {
        return { id: entry.id, text: String(text).trim(), command: null };
      }
    } catch (e) {
      console.warn("[Tony Quick Reply]", entry.id, e.message);
    }
  }
  return null;
}

module.exports = {
  QUICK_REPLY_MAP,
  tryTonyQuickReplies,
  resolveTariffaDeterministica,
  normalizeItTony,
  shouldSkipQuickReply,
  isTonyOperationalCreationIntent,
  isTonyPreventivoFormFieldCorrection,
};
