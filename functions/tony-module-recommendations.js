"use strict";

const path = require("path");
const { hasActiveModule } = require("./tony-module-gate");

const CONFIG = require(path.join(__dirname, "config", "tony-module-recommendations.json"));

const SKIP_IDS = new Set(
  (CONFIG.skipModuleIds || []).map((id) => String(id).toLowerCase())
);

function normModuleId(id) {
  return String(id || "").toLowerCase();
}

function isModuleActive(activeModules, moduleId) {
  return hasActiveModule(activeModules, moduleId);
}

function isModuleAvailable(entry) {
  return entry && entry.available !== false;
}

/**
 * Conteggi grezzi da Firestore (anche dati legacy con modulo disattivato).
 */
function computeRawSignals(azienda) {
  const terreni = Array.isArray(azienda?.terreni) ? azienda.terreni : [];
  const terreniClienti = Array.isArray(azienda?.terreniClienti) ? azienda.terreniClienti : [];
  const clienti = Array.isArray(azienda?.clienti) ? azienda.clienti : [];
  const preventivi = Array.isArray(azienda?.preventivi) ? azienda.preventivi : [];
  const macchine = Array.isArray(azienda?.macchine) ? azienda.macchine : [];
  const prodotti = Array.isArray(azienda?.prodotti) ? azienda.prodotti : [];
  const tipiLavoro = Array.isArray(azienda?.tipiLavoro) ? azienda.tipiLavoro : [];
  const guastiAperti = Array.isArray(azienda?.guastiAperti) ? azienda.guastiAperti : [];

  const byCategory = {};
  terreni.forEach((t) => {
    const cat = String(t.coltura_categoria || "Altro").trim() || "Altro";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  const lavoriClientiTotal = clienti.reduce((sum, c) => {
    const n = c.totaleLavori != null ? Number(c.totaleLavori) : 0;
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const hasTrattamentiHint = tipiLavoro.some((t) =>
    /trattament|concim|diserb|fitofarm/i.test(String(t.nome || ""))
  );
  const hasMeccanicoHint = tipiLavoro.some((t) =>
    /trinciat|erpicat|fresat|aratur|ripass|estirpat|meccanic/i.test(String(t.nome || ""))
  );

  return {
    totalTerreni: terreni.length,
    terreniClientiCount: terreniClienti.length,
    clientiCount: clienti.length,
    preventiviCount: preventivi.length,
    macchineCount: macchine.length,
    prodottiCount: prodotti.length,
    guastiApertiCount: guastiAperti.length,
    lavoriClientiTotal,
    byCategory,
    hasTrattamentiHint,
    hasMeccanicoHint,
  };
}

/**
 * Segnali per trigger «scoperta» modulo: senza modulo attivo non usiamo dati che
 * l'utente non potrebbe aver creato dall'app (allineato a filterAziendaByModuliAttivi).
 */
function computeSignals(azienda, activeModules) {
  const raw = computeRawSignals(azienda);
  const signals = { ...raw };

  if (!hasActiveModule(activeModules, "contoTerzi")) {
    signals.terreniClientiCount = 0;
    signals.clientiCount = 0;
    signals.preventiviCount = 0;
    signals.lavoriClientiTotal = 0;
  }
  if (!hasActiveModule(activeModules, "parcoMacchine")) {
    signals.macchineCount = 0;
    signals.guastiApertiCount = 0;
  }
  if (!hasActiveModule(activeModules, "magazzino")) {
    signals.prodottiCount = 0;
  }

  return { signals, raw };
}

function buildSignalsSummary(signals, activeModules) {
  const parts = [];
  if (signals.totalTerreni > 0) {
    const cats = Object.entries(signals.byCategory)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, n]) => `${n} ${cat}`)
      .join(", ");
    parts.push(`${signals.totalTerreni} terreni aziendali (${cats})`);
  }
  if (hasActiveModule(activeModules, "contoTerzi")) {
    if (signals.terreniClientiCount > 0) {
      parts.push(`${signals.terreniClientiCount} terreni clienti`);
    }
    if (signals.clientiCount > 0) parts.push(`${signals.clientiCount} clienti`);
    if (signals.preventiviCount > 0) parts.push(`${signals.preventiviCount} preventivi`);
  }
  if (hasActiveModule(activeModules, "parcoMacchine") && signals.macchineCount > 0) {
    parts.push(`${signals.macchineCount} macchine`);
  }
  return parts.join("; ") || "pochi dati strutturati";
}

function addReactivationHints(raw, activeModules, addHint) {
  if (!isModuleActive(activeModules, "contoTerzi")) {
    const parts = [];
    if (raw.clientiCount > 0) parts.push(`${raw.clientiCount} clienti`);
    if (raw.terreniClientiCount > 0) parts.push(`${raw.terreniClientiCount} terreni clienti`);
    if (raw.preventiviCount > 0) parts.push(`${raw.preventiviCount} preventivi`);
    if (parts.length > 0) {
      addHint("contoTerzi", {
        kind: "reactivate",
        priority: 78,
        reason: `Hai ancora dati conto terzi in archivio (${parts.join(", ")}) — riattiva il modulo per usarli`,
      });
    }
  }
  if (!isModuleActive(activeModules, "magazzino") && raw.prodottiCount > 0) {
    addHint("magazzino", {
      kind: "reactivate",
      priority: 76,
      reason: `Hai ancora ${raw.prodottiCount} prodotti in anagrafica — riattiva Magazzino per gestirli`,
    });
  }
  if (
    !isModuleActive(activeModules, "parcoMacchine") &&
    (raw.macchineCount > 0 || raw.guastiApertiCount > 0)
  ) {
    const parts = [];
    if (raw.macchineCount > 0) parts.push(`${raw.macchineCount} macchine`);
    if (raw.guastiApertiCount > 0) parts.push(`${raw.guastiApertiCount} guasti aperti`);
    addHint("parcoMacchine", {
      kind: "reactivate",
      priority: 76,
      reason: `Hai ancora dati parco macchine in archivio (${parts.join(", ")}) — riattiva il modulo`,
    });
  }
}

function categoryShare(signals, category) {
  const total = signals.totalTerreni;
  if (total <= 0) return { count: 0, share: 0 };
  const count = signals.byCategory[category] || 0;
  return { count, share: count / total };
}

function evaluateTrigger(trigger, signals) {
  if (!trigger || !trigger.type) return { match: false, weight: 0, detail: "" };

  const weight = Number(trigger.weight) || 50;

  switch (trigger.type) {
    case "categoryShare": {
      const cat = trigger.category || "";
      const { count, share } = categoryShare(signals, cat);
      const minCount = Number(trigger.minCount) || 1;
      const minShare = Number(trigger.minShare) || 0;
      if (count >= minCount && share >= minShare) {
        return {
          match: true,
          weight,
          detail: `${count} appezzamenti ${cat}`,
        };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "terreniMin": {
      const min = Number(trigger.min) || 1;
      if (signals.totalTerreni >= min) {
        return { match: true, weight, detail: `${signals.totalTerreni} terreni aziendali` };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "terreniClientiMin": {
      const min = Number(trigger.min) || 1;
      if (signals.terreniClientiCount >= min) {
        return {
          match: true,
          weight,
          detail: `${signals.terreniClientiCount} terreni di clienti`,
        };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "clientiMin": {
      const min = Number(trigger.min) || 1;
      if (signals.clientiCount >= min) {
        return { match: true, weight, detail: `${signals.clientiCount} clienti` };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "preventiviMin": {
      const min = Number(trigger.min) || 1;
      if (signals.preventiviCount >= min) {
        return { match: true, weight, detail: `${signals.preventiviCount} preventivi` };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "macchineMin": {
      const min = Number(trigger.min) || 1;
      if (signals.macchineCount >= min) {
        return { match: true, weight, detail: `${signals.macchineCount} macchine registrate` };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "prodottiMin": {
      const min = Number(trigger.min) || 1;
      if (signals.prodottiCount >= min) {
        return { match: true, weight, detail: `${signals.prodottiCount} prodotti in anagrafica` };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "guastiMin": {
      const min = Number(trigger.min) || 1;
      if (signals.guastiApertiCount >= min) {
        return {
          match: true,
          weight,
          detail: `${signals.guastiApertiCount} guasti aperti`,
        };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "lavoriClientiMin": {
      const min = Number(trigger.min) || 1;
      if (signals.lavoriClientiTotal >= min) {
        return {
          match: true,
          weight,
          detail: `${signals.lavoriClientiTotal} lavori per clienti`,
        };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "trattamentiHint": {
      if (signals.hasTrattamentiHint) {
        return { match: true, weight, detail: "tipi lavoro da trattamenti/concimazioni" };
      }
      return { match: false, weight: 0, detail: "" };
    }
    case "meccanicoHint": {
      if (signals.hasMeccanicoHint) {
        return { match: true, weight, detail: "lavorazioni meccaniche nel catalogo" };
      }
      return { match: false, weight: 0, detail: "" };
    }
    default:
      return { match: false, weight: 0, detail: "" };
  }
}

function findModuleEntry(moduleId) {
  const want = normModuleId(moduleId);
  return (CONFIG.modules || []).find((m) => normModuleId(m.id) === want) || null;
}

/**
 * Calcola suggerimenti moduli da segnali azienda + moduli già attivi.
 * @param {object} azienda - contesto azienda (prima del filtro moduli)
 * @param {string[]} activeModules
 * @param {{ maxHints?: number }} [options]
 */
function buildModuleRecommendationHints(azienda, activeModules, options) {
  const maxHints = options && options.maxHints != null ? options.maxHints : 3;
  const modules = Array.isArray(activeModules) ? activeModules : [];
  const { signals, raw } = computeSignals(azienda || {}, modules);
  const signalsSummary = buildSignalsSummary(signals, modules);
  const scored = new Map();

  function addHint(moduleId, payload) {
    const id = normModuleId(moduleId);
    if (SKIP_IDS.has(id) || isModuleActive(activeModules, id)) return;
    const entry = findModuleEntry(id);
    if (!entry || !isModuleAvailable(entry)) return;
    const prev = scored.get(id);
    const priority = payload.priority || 0;
    if (!prev || priority > prev.priority) {
      scored.set(id, {
        moduleId: entry.id,
        label: entry.label || entry.id,
        reason: payload.reason,
        kind: payload.kind || "trigger",
        sourceModule: payload.sourceModule || null,
        priority,
      });
    }
  }

  for (const entry of CONFIG.modules || []) {
    if (!isModuleAvailable(entry) || SKIP_IDS.has(normModuleId(entry.id))) continue;
    if (isModuleActive(activeModules, entry.id)) continue;

    let best = null;
    for (const trigger of entry.triggers || []) {
      const ev = evaluateTrigger(trigger, signals);
      if (ev.match) {
        if (!best || ev.weight > best.weight) {
          best = {
            weight: ev.weight,
            detail: ev.detail,
          };
        }
      }
    }
    if (best) {
      addHint(entry.id, {
        kind: "trigger",
        priority: best.weight,
        reason: `Hai ${best.detail}`,
      });
    }
  }

  addReactivationHints(raw, modules, addHint);

  for (const activeId of activeModules || []) {
    const activeEntry = findModuleEntry(activeId);
    if (!activeEntry || !activeEntry.complements) continue;
    const complements = activeEntry.complements;
    for (const [targetId, complementReason] of Object.entries(complements)) {
      if (isModuleActive(activeModules, targetId)) continue;
      const targetEntry = findModuleEntry(targetId);
      if (!targetEntry || !isModuleAvailable(targetEntry)) continue;
      addHint(targetId, {
        kind: "complement",
        sourceModule: activeEntry.id,
        priority: 72,
        reason: `Con ${activeEntry.label} attivo: ${complementReason}`,
      });
    }
  }

  const hints = Array.from(scored.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxHints);

  return { hints, signalsSummary, signals };
}

function isModuleAdvisorQuestion(message) {
  const m = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!m || m.length < 4) return false;
  return (
    /\b(quali|che)\s+modul/.test(m) ||
    /\bmodul\w*\s+(servono|utile|utili|attivare|consigli|mi\s+consigli)/.test(m) ||
    /\bcosa\s+(attivare|mi\s+serve|mi\s+conviene)/.test(m) ||
    /\bconsigli\w*\s+modul/.test(m) ||
    /\bquale\s+modulo/.test(m) ||
    /\bsfruttare\s+(meglio|in\s+pieno)\s+l'?app/.test(m) ||
    /\baltri\s+modul/.test(m) ||
    /\bmodulo\s+(aggiuntivo|extra)/.test(m)
  );
}

function formatModuleAdvisorReply(hints) {
  const list = Array.isArray(hints) ? hints : [];
  if (list.length === 0) {
    return (
      "Per ora non ho abbastanza dati sulla tua azienda per suggerire moduli specifici. " +
      "Continua a usare terreni e attività, oppure apri la pagina Abbonamento per vedere tutti i moduli disponibili."
    );
  }
  const parts = list.slice(0, 2).map((h) => {
    const label = h.label || h.moduleId;
    const reason = String(h.reason || "").trim();
    return reason ? `${label}: ${reason}.` : `${label}.`;
  });
  return (
    "In base ai dati della tua azienda ti suggerirei questi moduli. " +
    parts.join(" ") +
    " Puoi attivarli dalla pagina Abbonamento quando ti servono."
  );
}

function tryTonyModuleAdvisorQuickReply(message, azienda, activeModules) {
  if (!isModuleAdvisorQuestion(message)) return null;
  const { hints } = buildModuleRecommendationHints(azienda, activeModules, { maxHints: 2 });
  return {
    id: "module_advisor",
    text: formatModuleAdvisorReply(hints),
  };
}

const TONY_MODULE_RECOMMENDATION_RULES = `
CONSIGLI MODULI (Tony Guida — piano Base, non Free):
- In azienda.consigliModuli trovi suggerimenti calcolati da dati reali (terreni core, moduli già attivi). Usa SOLO quelli; non inventare moduli né prezzi.
- kind "trigger": modulo nuovo utile in base a ciò che può fare oggi in app (es. terreni a vite → Vigneto). kind "reactivate": modulo disattivato ma dati ancora in archivio — invita a riattivare, non a «scoprire» il modulo.
- Senza Conto Terzi attivo NON citare clienti/preventivi dall'archivio se non c'è un hint "reactivate" in consigliModuli (l'utente nuovo non può aver creato quei dati).
- Suggerisci altri moduli SOLO se: (1) l'utente chiede quali moduli servono, cosa attivare o come sfruttare meglio l'app; (2) stai spiegando un flusso incompleto perché manca un modulo; (3) opzionale in chiusura — una sola frase, non in ogni risposta.
- NON suggerire moduli su domande sul contenuto di tabella o lista già aperta.
- NON suggerire moduli già presenti in moduli_attivi.
- Max uno o due moduli per risposta, con motivo concreto dalla reason in consigliModuli.
- Invita ad attivare da pagina Abbonamento, senza pressione commerciale.
- NON usare questo blocco per promuovere Tony Avanzato (è automazione, diverso dai moduli di business).
`;

module.exports = {
  buildModuleRecommendationHints,
  computeSignals,
  isModuleAdvisorQuestion,
  formatModuleAdvisorReply,
  tryTonyModuleAdvisorQuickReply,
  TONY_MODULE_RECOMMENDATION_RULES,
};
