/**
 * Gate moduli tenant per Tony (quick reply, contesto azienda, APRI_PAGINA).
 * Allineato a core/config/subscription-plans.js (AVAILABLE_MODULES.id).
 */

const MODULE_LABELS = {
  magazzino: "Prodotti e Magazzino",
  contoTerzi: "Conto Terzi",
  vendemmiaMeccanica: "Vendemmia Meccanica",
  parcoMacchine: "Parco Macchine",
  manodopera: "Manodopera",
  vigneto: "Vigneto",
  frutteto: "Frutteto",
  meteo: "Meteo",
};

/** Target APRI_PAGINA (chiave normalizzata) → modulo richiesto. Core = assente. */
const TARGET_REQUIRES_MODULE = {
  "conto terzi": "contoTerzi",
  contoterzi: "contoTerzi",
  clienti: "contoTerzi",
  preventivi: "contoTerzi",
  tariffe: "contoTerzi",
  "terreni clienti": "contoTerzi",
  "mappa clienti": "contoTerzi",
  "nuovo preventivo": "contoTerzi",
  "accetta preventivo": "contoTerzi",
  "vendemmia meccanica": "vendemmiaMeccanica",
  vendemmiameccanica: "vendemmiaMeccanica",
  "vendemmia meccanizzata": "vendemmiaMeccanica",
  "calcolatore vendemmia": "vendemmiaMeccanica",
  "piano stagione vm": "vendemmiaMeccanica",
  magazzino: "magazzino",
  scorte: "magazzino",
  prodotti: "magazzino",
  "anagrafica prodotti": "magazzino",
  movimenti: "magazzino",
  "movimenti magazzino": "magazzino",
  "tracciabilità consumi": "magazzino",
  "tracciabilita consumi": "magazzino",
  "consumi magazzino": "magazzino",
  macchine: "parcoMacchine",
  parcoMacchine: "parcoMacchine",
  "parco macchine": "parcoMacchine",
  trattori: "parcoMacchine",
  mezzi: "parcoMacchine",
  "elenco trattori": "parcoMacchine",
  "trattori list": "parcoMacchine",
  "lista trattori": "parcoMacchine",
  "elenco attrezzi": "parcoMacchine",
  "attrezzi list": "parcoMacchine",
  "lista attrezzi": "parcoMacchine",
  "elenco attrezzature": "parcoMacchine",
  "elenco flotta": "parcoMacchine",
  "flotta list": "parcoMacchine",
  "lista flotta": "parcoMacchine",
  scadenze: "parcoMacchine",
  "elenco scadenze": "parcoMacchine",
  "scadenze macchine": "parcoMacchine",
  guasti: "parcoMacchine",
  "gestione guasti": "parcoMacchine",
  "elenco guasti": "parcoMacchine",
  lavori: "manodopera",
  "gestione lavori": "manodopera",
  "segnatura ore": "manodopera",
  "segnare ore": "manodopera",
  "validazione ore": "manodopera",
  "validare ore": "manodopera",
  "lavori caposquadra": "manodopera",
  "i miei lavori": "manodopera",
  "statistiche manodopera": "manodopera",
  "statistiche ore": "manodopera",
  "gestione operai": "manodopera",
  operai: "manodopera",
  "gestione squadre": "manodopera",
  squadre: "manodopera",
  "compensi operai": "manodopera",
  compensi: "manodopera",
  manodopera: "manodopera",
  "workspace campo": "manodopera",
  "field workspace": "manodopera",
  "statistiche lavoratore": "manodopera",
  "statistiche campo": "manodopera",
  vigneto: "vigneto",
  uva: "vigneto",
  vigneti: "vigneto",
  "statistiche vigneto": "vigneto",
  "vigneto statistiche": "vigneto",
  vendemmia: "vigneto",
  "potatura vigneto": "vigneto",
  "trattamenti vigneto": "vigneto",
  "concimazioni vigneto": "vigneto",
  "concimazione vigneto": "vigneto",
  "calcolo materiali": "vigneto",
  "pianificazione impianto": "vigneto",
  "pianifica impianto": "vigneto",
  impianto: "vigneto",
  frutteto: "frutteto",
  frutteti: "frutteto",
  "statistiche frutteto": "frutteto",
  "frutteto statistiche": "frutteto",
  "raccolta frutta": "frutteto",
  "potatura frutteto": "frutteto",
  "trattamenti frutteto": "frutteto",
  "concimazioni frutteto": "frutteto",
  "concimazione frutteto": "frutteto",
  "calcolo materiali frutteto": "frutteto",
  "pianificazione impianto frutteto": "frutteto",
  "pianifica impianto frutteto": "frutteto",
  meteo: "meteo",
  "modulo meteo": "meteo",
  "previsioni meteo": "meteo",
};

const QUICK_REPLY_REQUIRES_MODULES = {
  query_scorte: ["magazzino"],
  query_tariffa_costo: ["contoTerzi"],
  query_conteggi_clienti: ["contoTerzi"],
  query_conteggi_preventivi: ["contoTerzi"],
  query_conteggi_tariffe: ["contoTerzi"],
  query_movimenti_recenti: ["magazzino"],
  query_guasti_aperti: ["parcoMacchine"],
};

function normalizeTargetKey(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[àáâãä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u");
}

function hasActiveModule(moduliAttivi, moduleId) {
  if (!moduleId) return true;
  const list = Array.isArray(moduliAttivi) ? moduliAttivi : [];
  const want = String(moduleId).toLowerCase();
  return list.some((m) => String(m).toLowerCase() === want);
}

function getModuliAttiviFromCtx(ctx) {
  if (!ctx || typeof ctx !== "object") return [];
  const dash = ctx.dashboard || {};
  if (Array.isArray(dash.moduli_attivi)) return dash.moduli_attivi;
  if (Array.isArray(dash.info_azienda?.moduli_attivi)) return dash.info_azienda.moduli_attivi;
  if (Array.isArray(ctx.moduli_attivi)) return ctx.moduli_attivi;
  if (Array.isArray(ctx.info_azienda?.moduli_attivi)) return ctx.info_azienda.moduli_attivi;
  return [];
}

function moduleLabel(moduleId) {
  return MODULE_LABELS[moduleId] || moduleId || "modulo";
}

function moduleInactiveMessage(moduleIds) {
  const ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
  const labels = ids.filter(Boolean).map(moduleLabel);
  if (labels.length === 0) {
    return "Questa funzione richiede un modulo non attivo sul tuo abbonamento. Puoi attivarlo dalla pagina Abbonamento.";
  }
  if (labels.length === 1) {
    return `Il modulo ${labels[0]} non è attivo sul tuo abbonamento. Attivalo dalla pagina Abbonamento per usare questa funzione.`;
  }
  return `Servono i moduli ${labels.join(" e ")} attivi sul tuo abbonamento. Puoi attivarli dalla pagina Abbonamento.`;
}

function getRequiredModuleForTarget(rawTarget) {
  const t = normalizeTargetKey(rawTarget);
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(TARGET_REQUIRES_MODULE, t)) {
    return TARGET_REQUIRES_MODULE[t];
  }
  for (const [key, mod] of Object.entries(TARGET_REQUIRES_MODULE)) {
    if (key.length >= 4 && t.includes(key)) return mod;
  }
  return null;
}

function isApriPaginaTargetAllowed(rawTarget, moduliAttivi) {
  const mod = getRequiredModuleForTarget(rawTarget);
  if (!mod) return true;
  return hasActiveModule(moduliAttivi, mod);
}

function getQuickReplyRequiredModules(entryId) {
  if (entryId === "query_scadenze") return null;
  return QUICK_REPLY_REQUIRES_MODULES[entryId] || null;
}

function isQuickReplyAllowed(entryId, moduliAttivi) {
  const req = getQuickReplyRequiredModules(entryId);
  if (!req) return true;
  return req.every((m) => hasActiveModule(moduliAttivi, m));
}

function quickReplyBlockedMessage(entryId, moduliAttivi) {
  const req = getQuickReplyRequiredModules(entryId);
  if (!req) return moduleInactiveMessage([]);
  const missing = req.filter((m) => !hasActiveModule(moduliAttivi, m));
  return moduleInactiveMessage(missing);
}

/**
 * Rimuove dal contesto azienda i dati di moduli non attivi (Gemini + quick reply).
 * @param {object} azienda
 * @param {string[]} moduliAttivi
 * @param {{ buildSummaryScadenze?: function }} [helpers]
 */
function filterAziendaByModuliAttivi(azienda, moduliAttivi, helpers) {
  if (!azienda || typeof azienda !== "object") return azienda || {};
  const out = { ...azienda };
  const buildScadenze = helpers && typeof helpers.buildSummaryScadenze === "function" ? helpers.buildSummaryScadenze : null;

  if (!hasActiveModule(moduliAttivi, "magazzino")) {
    out.prodotti = [];
    out.prodottiSottoScorta = [];
    out.summarySottoScorta = "";
    out.movimentiRecenti = [];
    out.summaryMovimentiRecenti = "";
  }

  if (!hasActiveModule(moduliAttivi, "contoTerzi")) {
    out.clienti = [];
    out.preventivi = [];
    out.tariffe = [];
    out.terreniClienti = [];
  }

  if (!hasActiveModule(moduliAttivi, "parcoMacchine")) {
    out.macchine = [];
    out.trattori = [];
    out.attrezzi = [];
    out.guastiAperti = [];
    if (buildScadenze && Array.isArray(out.terreni)) {
      out.summaryScadenze = buildScadenze(out.terreni, []);
    } else if (typeof out.summaryScadenze === "string" && /mezzi|revisione|assicurazione|trattor/i.test(out.summaryScadenze)) {
      out.summaryScadenze = "Nessuna scadenza imminente sui terreni.";
    }
  }

  return out;
}

/**
 * Scadenze quick reply: solo affitti terreni se parco macchine off; mezzi se parco on.
 */
function filterScadenzeQuickReplyText(summary, moduliAttivi) {
  const text = typeof summary === "string" ? summary.trim() : "";
  if (!text) return "Non ho riepilogo scadenze disponibile al momento.";
  const hasMacchine = hasActiveModule(moduliAttivi, "parcoMacchine");
  if (hasMacchine) return text;
  if (/affitt/i.test(text)) return text;
  if (/mezzi|revisione|assicurazione|trattor/i.test(text)) {
    return "Nessuna scadenza imminente sui terreni.";
  }
  return text;
}

function sanitizeTonyCommandForModules(command, moduliAttivi) {
  if (!command || typeof command !== "object") return command;
  const type = String(command.type || command.action || "").toUpperCase();
  if (type !== "APRI_PAGINA" && type !== "APRI_MODULO") return command;
  const target =
    command.target ||
    command.modulo ||
    (command.params && (command.params.target || command.params.modulo)) ||
    "";
  if (!target) return command;
  if (isApriPaginaTargetAllowed(target, moduliAttivi)) return command;
  return null;
}

function sanitizeTonyResultForModules(result, moduliAttivi) {
  if (!result || typeof result !== "object") return result;
  const next = { ...result };
  const cmd = next.command;
  const sanitized = sanitizeTonyCommandForModules(cmd, moduliAttivi);
  if (cmd && !sanitized) {
    delete next.command;
    const mod = getRequiredModuleForTarget(
      cmd.target || cmd.modulo || (cmd.params && cmd.params.target) || ""
    );
    const blocked = moduleInactiveMessage(mod || []);
    const t = String(next.text || "").trim();
    if (/ti porto|apro|ecco la pagina|ti porto alla pagina/i.test(t)) {
      next.text = blocked;
    } else if (t) {
      next.text = t + " " + blocked;
    } else {
      next.text = blocked;
    }
  }
  return next;
}

const TONY_MODULI_ATTIVI_RULE = `
MODULI ATTIVI (obbligatorio): in [CONTESTO].dashboard.moduli_attivi (o moduli_attivi) c'è l'elenco dei moduli pagati dal tenant.
- NON menzionare né usare dati di moduli assenti dall'elenco (magazzino → prodotti/scorte/movimenti; contoTerzi → clienti/preventivi/tariffe; parcoMacchine → macchine/scadenze mezzi/guasti; manodopera; vigneto; frutteto; meteo).
- NON usare APRI_PAGINA né OPEN_MODAL verso pagine di un modulo non attivo: spiega che il modulo non è attivo e indica la pagina Abbonamento.
- I dati in azienda.* sono già filtrati lato server: se mancano tariffe o prodotti, non inventare — indica che serve attivare il modulo.
`;

module.exports = {
  MODULE_LABELS,
  TARGET_REQUIRES_MODULE,
  hasActiveModule,
  getModuliAttiviFromCtx,
  moduleInactiveMessage,
  getRequiredModuleForTarget,
  isApriPaginaTargetAllowed,
  isQuickReplyAllowed,
  quickReplyBlockedMessage,
  filterAziendaByModuliAttivi,
  filterScadenzeQuickReplyText,
  sanitizeTonyCommandForModules,
  sanitizeTonyResultForModules,
  TONY_MODULI_ATTIVI_RULE,
};
