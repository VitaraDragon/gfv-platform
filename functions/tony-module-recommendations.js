"use strict";

const path = require("path");
const { hasActiveModule } = require("./tony-module-gate");

const CONFIG = require(path.join(__dirname, "config", "tony-module-recommendations.json"));
const BUNDLES_CATALOG = require(path.join(__dirname, "config", "tony-bundles-catalog.json"));

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

function getModuleMonthlyPrice(moduleId) {
  const prices = BUNDLES_CATALOG.moduleMonthlyPrices || {};
  const key = String(moduleId || "");
  if (prices[key] != null) return Number(prices[key]) || 0;
  const entry = findModuleEntry(moduleId);
  return entry && entry.monthlyPrice != null ? Number(entry.monthlyPrice) || 0 : 0;
}

function findBundleEntry(bundleId) {
  const want = String(bundleId || "").toLowerCase();
  return (BUNDLES_CATALOG.bundles || []).find((b) => String(b.id).toLowerCase() === want) || null;
}

/** Stessa base (es. vite+squadre), terzo modulo diverso: non proporre l'alternativa se l'altro è già attivo. */
const BUNDLE_ALTERNATIVES = {
  "vigneto-operativo": ["operativo-vigneto"],
  "operativo-vigneto": ["vigneto-operativo"],
  "frutteto-operativo": ["frutticoltore-campo"],
  "frutticoltore-campo": ["frutteto-operativo"],
};

function alternativeBundleIdsToSkip(activeBundles) {
  const skip = new Set();
  (Array.isArray(activeBundles) ? activeBundles : []).forEach((id) => {
    const alts = BUNDLE_ALTERNATIVES[String(id || "")];
    if (alts) alts.forEach((altId) => skip.add(altId));
  });
  return skip;
}

function expandActiveModules(activeModules, activeBundles) {
  const all = new Set(Array.isArray(activeModules) ? activeModules : []);
  (Array.isArray(activeBundles) ? activeBundles : []).forEach((bundleId) => {
    const bundle = findBundleEntry(bundleId);
    if (bundle && Array.isArray(bundle.modules)) {
      bundle.modules.forEach((m) => all.add(m));
    }
  });
  return all;
}

function moduleLabel(moduleId) {
  const extra = {
    tony: "Tony Avanzato",
    contoTerzi: "Conto Terzi",
    parcoMacchine: "Parco Macchine",
    manodopera: "Manodopera",
    magazzino: "Prodotti e Magazzino",
    report: "Report/Bilancio",
  };
  if (extra[moduleId]) return extra[moduleId];
  const entry = findModuleEntry(moduleId);
  return (entry && entry.label) || moduleId;
}

/** Testo prezzi/risparmi leggibile anche a voce (TTS): «7 euro al mese», non «€7/mese». */
function formatEuroPerMonth(amount) {
  const n = Math.round(Number(amount) || 0);
  return `${n} euro al mese`;
}

function formatSavingsPhrase(monthlySavings, suffix) {
  const tail = suffix ? ` ${suffix}` : "";
  return `risparmi circa ${formatEuroPerMonth(monthlySavings)}${tail}`;
}

/** Unisce moduli dal client Tony e dal tenant Firestore (il client può essere incompleto). */
function mergeActiveModuleIds(clientModules, tenantModules) {
  const set = new Set();
  (Array.isArray(clientModules) ? clientModules : []).forEach((m) => {
    if (m != null && String(m).trim()) set.add(String(m).trim());
  });
  (Array.isArray(tenantModules) ? tenantModules : []).forEach((m) => {
    if (m != null && String(m).trim()) set.add(String(m).trim());
  });
  return Array.from(set);
}

function compareBundleHints(a, b) {
  if (a.kind === "bundle_convert" && b.kind !== "bundle_convert") return -1;
  if (b.kind === "bundle_convert" && a.kind !== "bundle_convert") return 1;
  if (a.bundleId === "gfv-completo" && b.bundleId !== "gfv-completo") return 1;
  if (b.bundleId === "gfv-completo" && a.bundleId !== "gfv-completo") return -1;
  const missA = (a.missingModules && a.missingModules.length) || 0;
  const missB = (b.missingModules && b.missingModules.length) || 0;
  if (missA !== missB) return missA - missB;
  return b.priority - a.priority;
}

/** Per la risposta utente: conversione mirata prima; GFV opzionale se richiesto esplicitamente. */
function pickBundleHintsForDisplay(bundleHints, max, options) {
  const opts = options || {};
  const limit = max != null ? max : 2;
  const all = Array.isArray(bundleHints) ? [...bundleHints].sort(compareBundleHints) : [];
  const converts = all.filter((b) => b.kind === "bundle_convert");
  const expands = all.filter((b) => b.kind === "bundle_expand");
  const gfv = expands.find((b) => b.bundleId === "gfv-completo");
  const smallExpands = expands.filter((b) => b.bundleId !== "gfv-completo");
  const picked = [];

  if (converts.length > 0) picked.push(converts[0]);

  if (opts.preferGfvCompleto && gfv) {
    if (!picked.some((p) => p.bundleId === gfv.bundleId) && picked.length < limit) {
      picked.push(gfv);
    }
  }

  for (const e of smallExpands) {
    if (picked.length >= limit) break;
    if (picked.some((p) => p.bundleId === e.bundleId)) continue;
    picked.push(e);
  }

  if (
    opts.includeGfvCompleto &&
    gfv &&
    !picked.some((p) => p.bundleId === gfv.bundleId) &&
    picked.length < limit
  ) {
    picked.push(gfv);
  }

  return picked.slice(0, limit);
}

/**
 * Bundle consigliati: conversione da singoli (risparmio) o espansione con moduli mancanti.
 */
function buildBundleRecommendationHints(activeModules, activeBundles, options) {
  const activeBundleIds = new Set(
    (Array.isArray(activeBundles) ? activeBundles : []).map((id) => String(id))
  );
  const allActive = expandActiveModules(activeModules, activeBundles);
  const skipAlternativeBundles = alternativeBundleIdsToSkip(
    Array.from(activeBundleIds)
  );
  const scored = [];

  for (const bundle of BUNDLES_CATALOG.bundles || []) {
    if (activeBundleIds.has(bundle.id)) continue;
    if (skipAlternativeBundles.has(bundle.id)) continue;

    const bundleModules = Array.isArray(bundle.modules) ? bundle.modules : [];
    const availableMods = bundleModules.filter((modId) => {
      const entry = findModuleEntry(modId);
      return !entry || entry.available !== false;
    });
    if (availableMods.length === 0) continue;

    const existingMods = availableMods.filter((m) => allActive.has(m));
    const missingMods = availableMods.filter((m) => !allActive.has(m));
    const singlesTotal = availableMods.reduce((sum, m) => sum + getModuleMonthlyPrice(m), 0);
    const monthlyPrice = Number(bundle.monthlyPrice) || 0;
    const monthlySavings = singlesTotal - monthlyPrice;
    if (monthlySavings <= 0) continue;

    let kind = null;
    let priority = 0;
    let reason = "";

    if (existingMods.length >= 2 && missingMods.length === 0) {
      kind = "bundle_convert";
      priority = 90 + existingMods.length;
      reason =
        `Hai già ${existingMods.map(moduleLabel).join(", ")} come singoli; ` +
        `con il bundle ${bundle.label} ${formatSavingsPhrase(monthlySavings, "(addebito annuale anticipato).")}`;
    } else if (existingMods.length >= 1 && missingMods.length > 0) {
      kind = "bundle_expand";
      priority = 78 + existingMods.length + missingMods.length;
      reason =
        `Hai già ${existingMods.map(moduleLabel).join(", ")}; ` +
        `con ${bundle.label} aggiungi ${missingMods.map(moduleLabel).join(", ")} ` +
        `e ${formatSavingsPhrase(monthlySavings, "rispetto ai moduli singoli.")}`;
      // Con bundle già attivo: non proporre un secondo bundle se i soli moduli mancanti costano meno
      if (activeBundleIds.size > 0) {
        const marginalSingles = missingMods.reduce(
          (sum, modId) => sum + getModuleMonthlyPrice(modId),
          0
        );
        if (marginalSingles > 0 && marginalSingles < monthlyPrice) continue;
      }
    }

    if (!kind) continue;

    scored.push({
      kind,
      bundleId: bundle.id,
      label: bundle.label || bundle.id,
      reason,
      priority,
      missingModules: missingMods,
      monthlyPrice,
      monthlySavings,
    });
  }

  const sorted = scored.sort(compareBundleHints);
  const limit = options && options.maxBundleHints != null ? options.maxBundleHints : null;
  return limit != null ? sorted.slice(0, limit) : sorted;
}

/**
 * Calcola suggerimenti moduli da segnali azienda + moduli già attivi.
 * @param {object} azienda - contesto azienda (prima del filtro moduli)
 * @param {string[]} activeModules
 * @param {{ maxHints?: number, maxBundleHints?: number, activeBundles?: string[] }} [options]
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

  const activeBundles = options && Array.isArray(options.activeBundles) ? options.activeBundles : [];
  const bundleHintsAll = buildBundleRecommendationHints(modules, activeBundles, options);
  const bundleHints = bundleHintsAll.slice(0, 4);

  return { hints, bundleHints, bundleHintsAll, signalsSummary, signals };
}

function normalizeAdvisorMessage(message) {
  return String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseRequestedModuleIds(message) {
  const m = normalizeAdvisorMessage(message);
  const ids = [];
  const rules = [
    ["tony", /\btony\b|\bassistente\s+ia\b/],
    ["frutteto", /\bfrutteto\b|\bfrutteti\b/],
    ["contoTerzi", /\bconto\s+terzi\b|\bcontoterzi\b/],
    ["vigneto", /\bvigneto\b|\bvigneti\b|\bvite\b/],
    ["magazzino", /\bmagazzino\b|\bprodotti\s+e\s+magazzino\b/],
    ["manodopera", /\bmanodopera\b/],
    ["parcoMacchine", /\bparco\s+macchine\b|\bmacchine\b/],
    ["meteo", /\bmeteo\b/],
    ["report", /\breport\b|\bbilancio\b/],
  ];
  for (const [id, re] of rules) {
    if (re.test(m) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function parseMentionedBundleIds(message) {
  const m = normalizeAdvisorMessage(message);
  const ids = [];
  const rules = [
    ["gfv-completo", /\bgfv\s+completo\b/],
    ["frutticoltore-campo", /\bfrutticoltor\w*\s+campo\b/],
    ["frutteto-operativo", /\bfrutteto\s+operativo\b/],
    ["operativo-vigneto", /\bviticoltor\w*\s+campo\b/],
    ["vigneto-operativo", /\bviticoltor\w*\s+operativo\b/],
    ["conto-terzi-operativo", /\bservizi\s+conto\s+terzi\b/],
    ["business-completo", /\bbusiness\s+conto\s+terzi\b/],
    ["operativo-completo", /\boperativo\s+completo\b/],
    ["coltura-meteo", /\bcoltur\w*\s+e\s+meteo\b/],
  ];
  for (const [id, re] of rules) {
    if (re.test(m) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function isStackedBundleQuestion(message) {
  if (parseMentionedBundleIds(message).length === 0) return false;
  const m = normalizeAdvisorMessage(message);
  return (
    /\b(conviene|convenient\w*|meglio|piu\s+conveniente|risparmi\w*|econom\w*)\b/.test(m) ||
    /\battivare\s+(il\s+|un\s+|lo\s+)?bundle\b/.test(m) ||
    /\b(avrei|avendo|tener\w+|manten\w+|insieme\s+a|oltre\s+a|in\s+piu)\b/.test(m) ||
    /\b(magazzino\s+e\s+macchine|macchine\s+e\s+magazzino)\b/.test(m)
  );
}

function isModuleAddQuestion(message) {
  const m = normalizeAdvisorMessage(message);
  if (!m) return false;
  const asksAdd =
    /\b(se\s+)?volessi\s+aggiungere\b/.test(m) ||
    /\baggiungere\s+anche\b/.test(m) ||
    /\bvorrei\s+aggiungere\b/.test(m) ||
    /\battivare\s+anche\b/.test(m) ||
    /\bvolessi\s+anche\b/.test(m);
  return asksAdd && parseRequestedModuleIds(message).length >= 1;
}

function classifyAdvisorQuestion(message) {
  const m = normalizeAdvisorMessage(message);
  if (!m || m.length < 4) return null;

  if (isModuleAddQuestion(message)) return "module_add";

  if (isStackedBundleQuestion(message)) return "stacked_bundle";

  if (
    /\b(singol\w*|modul\w*)\s+(o|oppure|\/)\s+bundle|\bbundle\s+(o|oppure|\/)\s+(modul|singol|altri)|\bmodul\w*\s+singol\w*\s+(o|oppure)\s+(i\s+)?bundle|\bbundle\s+o\s+altri\s+modul|\bconviene\s+attivare[\s\S]{0,45}\bbundle|\battivar\w*\s+singolar\w*\s+o\s+attiv\w*\s+un\s+bundle|\bmeglio\s+(i\s+)?bundle|\bconviene\s+(piu\s+)?(i\s+)?(modul|singol|bundle)|\bconviene\s+riattivare|\bbundle\s+o\s+modul|\bmodul\w*\s+o\s+(un\s+)?bundle|\battivare\s+i\s+modul\w*\s+o\s+i\s+bundle|\briattivare\s+(i\s+)?modul\w*[\s\S]{0,50}\bbundle|\bbundle[\s\S]{0,50}\briattivare|\bmodul\w*\s+singol\w*\s+oppure\s*$|\bche\s+cosa[\s\S]{0,60}\bconviene[\s\S]{0,60}\b(modul|bundle)/.test(
      m
    )
  ) {
    return "singoli_vs_bundle";
  }
  if (
    /\b(quali|che|quale)\s+bundle/.test(m) ||
    /\bbundle\s+(servono|utile|utili|consigli|mi\s+consigli|dovrei)/.test(m) ||
    /\bbundle\s+dovrei\s+attivare/.test(m) ||
    /\bdovrei\s+attivare\s+(i\s+)?bundle/.test(m) ||
    /\bpacchett\w*\s+(servono|utile|consigli)/.test(m) ||
    /\bmi\s+conviene\s+un\s+bundle/.test(m) ||
    /\bconviene\s+attivare\s+un\s+bundle/.test(m)
  ) {
    return "bundle";
  }
  if (
    /\b(quali|che)\s+modul/.test(m) ||
    /\bmodul\w*\s+(servono|utile|utili|attivare|consigli|mi\s+consigli)/.test(m) ||
    /\bcosa\s+(attivare|mi\s+serve)\b/.test(m) ||
    /\bconsigli\w*\s+modul/.test(m) ||
    /\bquale\s+modulo/.test(m) ||
    /\bsfruttare\s+(meglio|in\s+pieno)\s+l'?app/.test(m) ||
    /\bmodulo\s+(aggiuntivo|extra)/.test(m)
  ) {
    return "module";
  }
  return null;
}

function isModuleAdvisorQuestion(message) {
  return classifyAdvisorQuestion(message) != null;
}

function formatBundleFocusedReply(hints, bundleHints, bundleHintsAll, pickOptions) {
  const bundles = pickBundleHintsForDisplay(
    Array.isArray(bundleHintsAll) && bundleHintsAll.length > 0 ? bundleHintsAll : bundleHints,
    2,
    pickOptions
  );
  const reactivates = (Array.isArray(hints) ? hints : [])
    .filter((h) => h.kind === "reactivate")
    .slice(0, 1);

  if (bundles.length === 0) {
    return formatModuleAdvisorReply(hints, bundleHints);
  }

  const parts = bundles.map((b) => {
    const label = b.label || b.bundleId;
    const reason = String(b.reason || "").trim();
    return reason ? `${label}: ${reason}.` : `${label}.`;
  });
  reactivates.forEach((h) => {
    const reason = String(h.reason || "").trim();
    parts.push(reason ? `${h.label || h.moduleId}: ${reason}.` : `${h.label || h.moduleId}.`);
  });

  return (
    "Per i bundle, in base alla tua situazione: " +
    parts.join(" ") +
    " Puoi attivarli dalla pagina Abbonamento."
  );
}

function formatSingoliVsBundleReply(hints, bundleHints, bundleHintsAll, activeBundles) {
  const bundles = pickBundleHintsForDisplay(
    Array.isArray(bundleHintsAll) && bundleHintsAll.length > 0 ? bundleHintsAll : bundleHints,
    3,
    { includeGfvCompleto: true }
  );
  const converts = bundles.filter((b) => b.kind === "bundle_convert");
  const expands = bundles.filter((b) => b.kind === "bundle_expand");
  const reactivates = (Array.isArray(hints) ? hints : [])
    .filter((h) => h.kind === "reactivate")
    .slice(0, 2);
  const activeBundleLabels = (Array.isArray(activeBundles) ? activeBundles : [])
    .map((id) => findBundleEntry(id))
    .filter(Boolean)
    .map((b) => b.label || b.id);

  if (bundles.length === 0 && reactivates.length === 0 && activeBundleLabels.length === 0) {
    return (
      "Non ho abbastanza elementi per confrontare singoli e bundle nel tuo caso. " +
      "Apri la pagina Abbonamento per vedere prezzi e pacchetti."
    );
  }

  const parts = [];

  if (converts.length > 0) {
    const b = converts[0];
    parts.push(
      `Conviene partire dal bundle ${b.label}: ${String(b.reason || "").trim()}. ` +
        "Non perdi moduli già attivi, paghi meno che tenerli separati."
    );
  } else if (activeBundleLabels.length > 0) {
    parts.push(
      `Hai già ${activeBundleLabels.join(" e ")} attivo: il risparmio bundle ce l'hai già. ` +
        "Non serve un altro pacchetto vite+squadre; per funzioni extra valuta moduli singoli o un bundle più grande."
    );
  } else {
    parts.push(
      "I bundle convengono quando attivi più moduli collegati: costano meno dei singoli messi insieme."
    );
  }

  const expandPick = expands.find((b) => b.bundleId !== (converts[0] && converts[0].bundleId));
  if (expandPick) {
    parts.push(
      `Se vuoi ampliare l'app, valuta anche ${expandPick.label}: ${String(expandPick.reason || "").trim()}.`
    );
  }

  if (reactivates.length > 0) {
    const reacText = reactivates
      .map((h) => `${h.label || h.moduleId}: ${String(h.reason || "").trim()}.`)
      .join(" ");
    parts.push(`Separatamente, per moduli che avevi già usato: ${reacText}`);
  }

  parts.push("Dettagli e attivazione in pagina Abbonamento.");
  return parts.join(" ");
}

/**
 * Confronto margine: tenant con bundle già attivo chiede se aggiungere un altro pacchetto.
 */
function formatStackedBundleAdvisorReply(targetBundleId, hints, activeModules, activeBundles) {
  const target = findBundleEntry(targetBundleId);
  if (!target) return null;

  const activeBundleEntries = (Array.isArray(activeBundles) ? activeBundles : [])
    .map((id) => findBundleEntry(id))
    .filter(Boolean);
  const activeLabels = activeBundleEntries.map((b) => b.label || b.id).join(" e ");
  const allActive = expandActiveModules(activeModules, activeBundles);
  const skipAlts = alternativeBundleIdsToSkip(activeBundles || []);

  if ((activeBundles || []).includes(targetBundleId)) {
    return `Hai già ${target.label} attivo. Dettagli in pagina Abbonamento.`;
  }

  if (skipAlts.has(targetBundleId)) {
    const siblingActive = activeBundleEntries.find((entry) =>
      (BUNDLE_ALTERNATIVES[entry.id] || []).includes(targetBundleId)
    );
    const siblingLabel = siblingActive ? siblingActive.label : activeLabels;
    const targetLabels = (target.modules || []).map(moduleLabel).join(", ");
    return (
      `Hai già ${siblingLabel}: ${target.label} è il pacchetto gemello (${targetLabels}) ` +
      "con terzo modulo diverso. Non conviene passare all'altro; per funzioni extra usa moduli singoli. " +
      "Dettagli in pagina Abbonamento."
    );
  }

  const targetModules = Array.isArray(target.modules) ? target.modules : [];
  const missingMods = targetModules.filter((modId) => !allActive.has(modId));
  const notInTarget = [...allActive].filter((modId) => !targetModules.includes(modId));

  const activeBundlesMonthly = activeBundleEntries.reduce(
    (sum, b) => sum + (Number(b.monthlyPrice) || 0),
    0
  );
  const targetMonthly = Number(target.monthlyPrice) || 0;
  const marginalSingles = missingMods.reduce(
    (sum, modId) => sum + getModuleMonthlyPrice(modId),
    0
  );
  const stackedMonthly = activeBundlesMonthly + targetMonthly;
  const singlesStackMonthly = activeBundlesMonthly + marginalSingles;

  const parts = [];
  parts.push(
    `${target.label} include ${targetModules.map(moduleLabel).join(", ")} (${formatEuroPerMonth(targetMonthly)}).`
  );

  if (activeLabels && notInTarget.length > 0) {
    parts.push(
      `Con ${activeLabels} attivo tieni anche ${notInTarget.map(moduleLabel).join(", ")}: ` +
        `${target.label} non toglie moduli fuori dal pacchetto, restano quelli che hai già.`
    );
  }

  if (missingMods.length === 0) {
    parts.push("I moduli di questo pacchetto li hai già: non serve aggiungere il bundle.");
  } else if (marginalSingles > 0 && marginalSingles < targetMonthly) {
    const missLabels = missingMods.map(moduleLabel).join(" e ");
    parts.push(
      `Ti mancano ${missLabels}: come singoli ${formatEuroPerMonth(marginalSingles)} in più ` +
        `(totale circa ${formatEuroPerMonth(singlesStackMonthly)}), ` +
        `contro ${formatEuroPerMonth(stackedMonthly)} aggiungendo anche ${target.label}. ` +
        `Conviene ${missLabels} come moduli singoli, non un secondo bundle.`
    );
  } else {
    parts.push(
      `Aggiungere ${target.label} porta il totale indicativo a ${formatEuroPerMonth(stackedMonthly)} ` +
        `rispetto a ${formatEuroPerMonth(singlesStackMonthly)} con i singoli mancanti.`
    );
  }

  const reactivates = (Array.isArray(hints) ? hints : [])
    .filter(
      (h) =>
        h.kind === "reactivate" &&
        missingMods.some((id) => normModuleId(id) === normModuleId(h.moduleId))
    )
    .slice(0, 2);
  if (reactivates.length > 0) {
    parts.push(
      reactivates
        .map((h) => `${h.label}: ${String(h.reason || "").trim()}.`)
        .join(" ")
    );
  }

  parts.push("Dettagli in pagina Abbonamento.");
  return parts.join(" ");
}

function formatModuleAddAdvisorReply(requestedIds, hints, bundleHintsAll) {
  const labels = requestedIds.map((id) => moduleLabel(id));
  const preferGfv = requestedIds.length >= 2;
  const picked = pickBundleHintsForDisplay(bundleHintsAll, preferGfv ? 2 : 1, {
    preferGfvCompleto: preferGfv,
    includeGfvCompleto: preferGfv,
  });
  const reactivates = (Array.isArray(hints) ? hints : [])
    .filter(
      (h) =>
        h.kind === "reactivate" &&
        requestedIds.some((id) => normModuleId(id) === normModuleId(h.moduleId))
    )
    .slice(0, 1);

  const parts = [`Per aggiungere ${labels.join(", ")}:`];

  if (picked.length === 0) {
    parts.push("valuta i singoli moduli in pagina Abbonamento.");
  } else {
    picked.forEach((b) => {
      parts.push(`${b.label}: ${String(b.reason || "").trim()}.`);
    });
  }

  if (reactivates.length > 0) {
    const h = reactivates[0];
    parts.push(`${h.label}: ${String(h.reason || "").trim()}.`);
  }

  if (
    requestedIds.includes("tony") &&
    !picked.some((b) => b.bundleId === "gfv-completo")
  ) {
    parts.push("Tony Avanzato si attiva come modulo singolo se non scegli un bundle che lo include.");
  }

  parts.push("Dettagli in pagina Abbonamento.");
  return parts.join(" ");
}

function formatModuleAdvisorReply(hints, bundleHints) {
  const modList = Array.isArray(hints) ? hints : [];
  const bundleList = Array.isArray(bundleHints) ? bundleHints : [];
  if (modList.length === 0 && bundleList.length === 0) {
    return (
      "Per ora non ho abbastanza dati sulla tua azienda per suggerire moduli o bundle specifici. " +
      "Continua a usare terreni e attività, oppure apri la pagina Abbonamento per vedere il catalogo."
    );
  }
  const parts = [];
  modList.slice(0, 2).forEach((h) => {
    const label = h.label || h.moduleId;
    const reason = String(h.reason || "").trim();
    parts.push(reason ? `${label}: ${reason}.` : `${label}.`);
  });
  bundleList.slice(0, 1).forEach((h) => {
    const reason = String(h.reason || "").trim();
    parts.push(reason || `${h.label || h.bundleId}.`);
  });
  return (
    "In base ai dati della tua azienda ti suggerirei: " +
    parts.join(" ") +
    " Puoi attivare moduli e bundle dalla pagina Abbonamento quando ti servono."
  );
}

function tryTonyModuleAdvisorQuickReply(message, azienda, activeModules, options) {
  const focus = classifyAdvisorQuestion(message);
  if (!focus) return null;

  const activeBundles = options && options.activeBundles ? options.activeBundles : [];
  const pack = buildModuleRecommendationHints(azienda, activeModules, {
    maxHints: focus === "bundle" ? 1 : 2,
    activeBundles,
  });

  let text;
  if (focus === "stacked_bundle") {
    const mentioned = parseMentionedBundleIds(message);
    const targetId = mentioned[0];
    if (!targetId) return null;
    if (activeBundles.length === 0) {
      text = formatBundleFocusedReply(pack.hints, pack.bundleHints, pack.bundleHintsAll, {
        includeGfvCompleto: false,
      });
    } else {
      text = formatStackedBundleAdvisorReply(
        targetId,
        pack.hints,
        activeModules,
        activeBundles
      );
    }
    if (!text) return null;
  } else if (focus === "module_add") {
    const requestedIds = parseRequestedModuleIds(message);
    text = formatModuleAddAdvisorReply(requestedIds, pack.hints, pack.bundleHintsAll);
  } else if (focus === "singoli_vs_bundle") {
    text = formatSingoliVsBundleReply(
      pack.hints,
      pack.bundleHints,
      pack.bundleHintsAll,
      activeBundles
    );
  } else if (focus === "bundle") {
    text = formatBundleFocusedReply(pack.hints, pack.bundleHints, pack.bundleHintsAll, {
      includeGfvCompleto: false,
    });
  } else {
    text = formatModuleAdvisorReply(pack.hints, pack.bundleHints);
  }

  return {
    id:
      focus === "stacked_bundle"
        ? "stacked_bundle_advisor"
        : focus === "singoli_vs_bundle"
          ? "bundle_vs_singles"
          : focus === "module_add"
            ? "module_add_advisor"
            : "module_advisor",
    text,
  };
}

const TONY_MODULE_RECOMMENDATION_RULES = `
CONSIGLI MODULI E BUNDLE (Tony Guida — piano Base, non Free):
- In azienda.consigliModuli trovi suggerimenti moduli calcolati da dati reali (terreni core, moduli già attivi). In azienda.consigliBundle trovi bundle con risparmio vs singoli. Usa SOLO quelli; non inventare moduli, bundle né prezzi.
- kind modulo "trigger": modulo nuovo utile in base a ciò che può fare oggi in app (es. terreni a vite → Vigneto). kind "reactivate": modulo disattivato ma dati ancora in archivio — invita a riattivare, non a «scoprire» il modulo.
- kind bundle "bundle_convert": moduli già attivi come singoli — invita al bundle per risparmiare (priorità massima se l'utente chiede bundle o singoli vs bundle). kind "bundle_expand": aggiunge moduli mancanti del bundle con risparmio.
- Se l'utente chiede «bundle o singoli»: rispondi in modo diretto — prima bundle_convert se presente in consigliBundle, poi al massimo un bundle_expand; riattivazioni (reactivate) dopo, senza dilungarti.
- Se chiede solo «quali bundle»: usa consigliBundle per primi — conversione mirata se presente, poi bundle medio; GFV Completo solo se chiede molti moduli nuovi o «aggiungere anche …» (2+ moduli).
- Se chiede di aggiungere moduli specifici (es. Tony, Frutteto, Conto Terzi): usa consigliBundle; con 2+ moduli richiesti cita GFV Completo se in consigliBundle; risposta breve e completa (no elenchi lunghi).
- Senza Conto Terzi attivo NON citare clienti/preventivi dall'archivio se non c'è un hint "reactivate" in consigliModuli (l'utente nuovo non può aver creato quei dati).
- Suggerisci moduli o bundle SOLO se: (1) l'utente chiede quali moduli/bundle servono, cosa attivare o come sfruttare meglio l'app; (2) stai spiegando un flusso incompleto perché manca un modulo; (3) opzionale in chiusura — una sola frase, non in ogni risposta.
- NON suggerire moduli o bundle su domande sul contenuto di tabella o lista già aperta.
- NON suggerire moduli già presenti in moduli_attivi né bundle già in activeBundles del tenant.
- Se il tenant ha già un bundle attivo (es. Viticoltore Operativo), NON invitare a Viticoltore Campo o altro pacchetto gemello: stessa base, terzo modulo diverso. Per Parco Macchine con Operativo già attivo → modulo singolo o bundle più grande, non il pacchetto alternativo.
- Se chiede se conviene aggiungere un secondo bundle avendone già uno: confronta costo marginale moduli mancanti (singoli) vs prezzo del nuovo bundle; spiega che moduli fuori dal pacchetto (es. Magazzino da Operativo) restano attivi.
- Max uno o due moduli e al massimo un bundle per risposta, con motivo concreto dalla reason.
- Quando citi prezzi o risparmi, scrivi sempre «X euro al mese» per esteso (mai solo «€X/mese», «X/mese» o «X a mese» senza «euro»).
- Invita ad attivare da pagina Abbonamento, senza pressione commerciale.
- NON usare questo blocco per promuovere Tony Avanzato (è automazione, diverso dai moduli di business).
`;

module.exports = {
  buildModuleRecommendationHints,
  buildBundleRecommendationHints,
  mergeActiveModuleIds,
  pickBundleHintsForDisplay,
  computeSignals,
  parseRequestedModuleIds,
  isModuleAddQuestion,
  classifyAdvisorQuestion,
  formatModuleAddAdvisorReply,
  isModuleAdvisorQuestion,
  formatModuleAdvisorReply,
  formatBundleFocusedReply,
  formatSingoliVsBundleReply,
  formatStackedBundleAdvisorReply,
  parseMentionedBundleIds,
  isStackedBundleQuestion,
  tryTonyModuleAdvisorQuickReply,
  TONY_MODULE_RECOMMENDATION_RULES,
};
