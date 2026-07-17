/**
 * Navigazione APRI_PAGINA + RIASSUNTO deterministico (binario B, Fase 4).
 * Config centralizzata — nessun if per singola pagina in index.js.
 */

const {
  normalizeItTony,
  shouldSkipQuickReply,
  isTonyOperationalCreationIntent,
} = require("./tony-quick-replies");
const {
  getModuliAttiviFromCtx,
  isApriPaginaTargetAllowed,
  moduleInactiveMessage,
  getRequiredModuleForTarget,
} = require("./tony-module-gate");

const NAV_VERB_RE =
  /\b(apri|portami|vai\s+a|vai\s+al|vai\s+alla|vai\s+alle|vai\s+ai|mandami|mostrami\s+la\s+pagina|naviga)\b/i;

const RIASSUNTO_RE = /\b(riassunto|briefing|cosa\s+devo\s+fare\s+oggi)\b/i;

/** Frase → target canonico APRI_PAGINA (ordine: match più specifico prima). */
const NAV_TARGET_RULES = [
  { target: "nuovo preventivo", patterns: [/\bnuovo\s+preventiv/i, /\bcrea\s+preventiv/i] },
  { target: "tariffe", patterns: [/\btariff/i] },
  { target: "preventivi", patterns: [/\bpreventiv/i] },
  { target: "clienti", patterns: [/\bclienti\b/i] },
  { target: "movimenti", patterns: [/\bmoviment/i] },
  { target: "prodotti", patterns: [/\bprodott/i, /\banagrafica\s+prodott/i] },
  { target: "magazzino", patterns: [/\bmagazzin/i, /\bscort/i] },
  { target: "comunicazioni", patterns: [/\bcomunicazion/i, /\bmessagg\w*\s+(del\s+)?(capo|caposquadra|squadra)\b/i, /\bmessaggi\b/i] },
  { target: "gestione lavori", patterns: [/\bgestione\s+lavor/i] },
  { target: "lavori caposquadra", patterns: [/\bi\s+miei\s+lavor/i, /\blavori\s+caposquadra\b/i] },
  { target: "lavori", patterns: [/\blavor/i, /\bcosa\s+devo\s+fare\b/i] },
  { target: "terreni", patterns: [/\bterren/i, /\bappezzament/i, /\bmappa\b/i] },
  { target: "attivita", patterns: [/\battivit/i, /\bdiario\b/i] },
  { target: "dashboard", patterns: [/\bdashboard\b/i, /\bhome\b/i, /\bpagina\s+principale\b/i] },
  { target: "parcoMacchine", patterns: [/\bparco\s+macchin/i, /\bmacchin/i, /\btrattor/i, /\bflotta\b/i] },
  { target: "guasti", patterns: [/\bguast/i] },
  { target: "segnatura ore", patterns: [/\bsegnatur/i, /\bsegnare\s+ore\b/i, /\bsegna\s+(le\s+)?ore\b/i, /\balle\s+ore\b/i] },
  { target: "validazione ore", patterns: [/\bvalidazion/i] },
  { target: "workspace campo", patterns: [/\bworkspace\s+campo\b/i, /\bflusso\s+campo\b/i, /\bhome\s+campo\b/i] },
  { target: "statistiche lavoratore", patterns: [/\bstatistiche\s+(lavoratore|personali|campo)\b/i, /\ble\s+mie\s+statistiche\b/i] },
  { target: "lavoro campo", patterns: [/\blavoro\s+campo\b/i, /\bslide\s+lavoro\b/i] },
  { target: "impostazioni", patterns: [/\bimpostazion/i] },
  { target: "meteo", patterns: [/\bmeteo\b/i, /\bprevision/i] },
  { target: "vigneto", patterns: [/\bvignet/i, /\buva\b/i] },
  { target: "frutteto", patterns: [/\bfruttet/i] },
];

/** Target APRI_PAGINA ammessi per profilo campo (allineato a field-role-guard client). */
const FIELD_NAV_ALLOW = {
  operaio: {
    "workspace campo": true,
    comunicazioni: true,
    "comunicazioni squadra": true,
    "comunicazioni caposquadra": true,
    "segnatura ore": true,
    "statistiche lavoratore": true,
    "lavoro campo": true,
    impostazioni: true,
  },
  caposquadra: {
    "workspace campo": true,
    comunicazioni: true,
    "comunicazioni squadra": true,
    "comunicazioni caposquadra": true,
    "segnatura ore": true,
    "statistiche lavoratore": true,
    "lavoro campo": true,
    impostazioni: true,
    "lavori caposquadra": true,
    "validazione ore": true,
  },
};

const NAV_TEXT_BY_TARGET = {
  terreni: "Ti porto ai terreni.",
  lavori: "Ti porto alla gestione lavori.",
  "gestione lavori": "Ti porto alla gestione lavori.",
  tariffe: "Ti porto alle tariffe.",
  prodotti: "Ti porto all'anagrafica prodotti.",
  movimenti: "Ti porto ai movimenti di magazzino.",
  magazzino: "Ti porto al magazzino.",
  clienti: "Ti porto all'elenco clienti.",
  preventivi: "Ti porto ai preventivi.",
  "nuovo preventivo": "Ti porto al nuovo preventivo.",
  dashboard: "Ti porto alla dashboard.",
  attivita: "Ti porto al diario attività.",
  parcoMacchine: "Ti porto al parco macchine.",
  guasti: "Ti porto alla gestione guasti.",
  meteo: "Ti porto al modulo meteo.",
  vigneto: "Ti porto al vigneto.",
  frutteto: "Ti porto al frutteto.",
  comunicazioni: "Ti porto alle comunicazioni.",
  "comunicazioni squadra": "Ti porto alle comunicazioni.",
  "comunicazioni caposquadra": "Ti porto alle comunicazioni.",
  "workspace campo": "Ti porto al workspace campo.",
  "statistiche lavoratore": "Ti porto alle tue statistiche.",
  "lavoro campo": "Ti porto al lavoro.",
  impostazioni: "Ti porto alle impostazioni.",
  "lavori caposquadra": "Ti porto ai tuoi lavori.",
  "segnatura ore": "Ti porto alla segnatura ore.",
  "validazione ore": "Ti porto alla validazione ore.",
};

function isRiassuntoRequest(message) {
  const msg = normalizeItTony(message);
  if (!msg) return false;
  return RIASSUNTO_RE.test(msg);
}

function isNavVerbRequest(message) {
  const msg = normalizeItTony(message);
  if (!msg) return false;
  if (!NAV_VERB_RE.test(msg)) return false;
  if (/\b(filtra|mostra\s+solo|reset\s+filtri|pulisci\s+filtri)\b/i.test(msg) && !NAV_VERB_RE.test(msg)) {
    return false;
  }
  return true;
}

function resolveNavTarget(message) {
  const msg = normalizeItTony(message);
  for (const rule of NAV_TARGET_RULES) {
    if ((rule.patterns || []).some((re) => re.test(msg))) {
      return rule.target;
    }
  }
  return null;
}

function isAlreadyOnTargetPage(ctx, target) {
  const page = (ctx && ctx.page) || {};
  const ctd = page.currentTableData || {};
  const pageType = String(ctd.pageType || page.pageType || "").toLowerCase();
  const path = String(page.pagePath || page.path || "").toLowerCase();
  const t = normalizeItTony(target);

  if (t === "tariffe" && (pageType === "tariffe" || path.includes("tariffe"))) return true;
  if (t === "terreni" && (pageType === "terreni" || path.includes("terreni"))) return true;
  if ((t === "lavori" || t === "gestione lavori") && (pageType === "lavori" || path.includes("gestione-lavori"))) {
    return true;
  }
  if (t === "prodotti" && (pageType === "prodotti" || path.includes("prodotti"))) return true;
  if (t === "movimenti" && (pageType === "movimenti" || path.includes("movimenti"))) return true;
  if (t === "dashboard" && (path.includes("dashboard") || pageType === "dashboard")) return true;
  if (t === "clienti" && (pageType === "clienti" || path.includes("clienti"))) return true;
  if (t === "preventivi" && (pageType === "preventivi" || path.includes("preventivi"))) return true;
  // Nota: «comunicazioni» è una slide del workspace — non considerare «già lì» solo perché path = field-workspace.
  if (
    (t === "workspace campo" || t === "field workspace") &&
    (pageType === "field_workspace" || path.includes("field-workspace"))
  ) {
    return true;
  }
  return false;
}

function isFieldNavTargetAllowed(target, fieldProfile) {
  const profile = String(fieldProfile || "").toLowerCase().trim();
  const allow = FIELD_NAV_ALLOW[profile];
  if (!allow) return false;
  const t = normalizeItTony(target);
  return !!allow[t];
}

/**
 * Navigazione deterministica per profilo campo (operaio/caposquadra).
 * Solo target in whitelist — evita che Gemini scambi «comunicazioni» con segna ore.
 * @param {{ message: string, history?: object[], ctx: object, fieldProfile: string }} input
 */
function tryTonyFieldNavQuickReply(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  const fieldProfile = input && input.fieldProfile;
  if (!fieldProfile) return null;
  if (shouldSkipQuickReply(message, ctx)) return null;
  if (isTonyOperationalCreationIntent(message)) return null;
  if (!isNavVerbRequest(message)) return null;

  const msgNorm = normalizeItTony(message);
  let target = resolveNavTarget(message);
  // «statistiche» / «mie statistiche» → slide mobile, mai Statistiche desktop manager.
  if (
    (!target || target === "statistiche") &&
    /\bstatistiche\b/i.test(msgNorm) &&
    !/\b(vigneto|frutteto|manodopera)\b/i.test(msgNorm)
  ) {
    target = "statistiche lavoratore";
  }
  if (target === "statistiche") target = "statistiche lavoratore";
  // «portami ai lavori» → slide Lavoro workspace (mai Gestione Lavori manager).
  if (target === "lavori" || target === "gestione lavori") target = "lavoro campo";
  if (!target || !isFieldNavTargetAllowed(target, fieldProfile)) return null;

  // Slide del workspace: emetti sempre APRI_PAGINA (il client apre la slide senza reload se già lì).
  const isWorkspaceSlide =
    target === "comunicazioni" ||
    target === "comunicazioni squadra" ||
    target === "comunicazioni caposquadra" ||
    target === "statistiche lavoratore" ||
    target === "lavoro campo" ||
    target === "segnatura ore" ||
    target === "validazione ore";

  if (!isWorkspaceSlide && isAlreadyOnTargetPage(ctx, target)) {
    return {
      id: "nav_field_already_there",
      text: `Sei già sulla sezione ${target}.`,
      command: null,
    };
  }

  const text = NAV_TEXT_BY_TARGET[target] || `Ti porto a ${target}.`;
  return {
    id: "nav_field",
    text,
    command: { type: "APRI_PAGINA", target },
  };
}

function formatGlobalBriefingText(ctx) {
  const gs = (ctx && ctx.globalStatus) || {};
  const a = (ctx && ctx.azienda) || {};
  const parts = [];
  const scorte =
    gs.sottoScorta != null
      ? Number(gs.sottoScorta)
      : Array.isArray(a.prodottiSottoScorta)
        ? a.prodottiSottoScorta.length
        : null;
  const scadenze = gs.scadenzeUrgenti != null ? Number(gs.scadenzeUrgenti) : null;
  const guasti =
    gs.guastiAperti != null
      ? Number(gs.guastiAperti)
      : Array.isArray(a.guastiAperti)
        ? a.guastiAperti.length
        : null;

  if (scorte != null && Number.isFinite(scorte)) {
    parts.push(
      scorte > 0
        ? `${scorte} prodott${scorte === 1 ? "o" : "i"} sotto scorta`
        : "nessun prodotto sotto scorta"
    );
  } else if (typeof a.summarySottoScorta === "string" && a.summarySottoScorta.trim()) {
    parts.push(a.summarySottoScorta.trim());
  }

  if (scadenze != null && Number.isFinite(scadenze)) {
    parts.push(
      scadenze > 0
        ? `${scadenze} scadenze urgenti`
        : "nessuna scadenza urgente segnalata"
    );
  } else if (typeof a.summaryScadenze === "string" && a.summaryScadenze.trim()) {
    parts.push(a.summaryScadenze.trim());
  }

  if (guasti != null && Number.isFinite(guasti)) {
    parts.push(guasti > 0 ? `${guasti} guasti aperti` : "nessun guasto aperto");
  }

  if (!parts.length) return null;
  return `Ecco il riepilogo: ${parts.join("; ")}.`;
}

function tryRiassuntoQuickReply(message, ctx) {
  if (!isRiassuntoRequest(message)) return null;

  const page = (ctx && ctx.page) || {};
  const tableSummary =
    (typeof page.tableDataSummary === "string" && page.tableDataSummary.trim()) ||
    (page.currentTableData && typeof page.currentTableData.summary === "string"
      ? page.currentTableData.summary.trim()
      : "");

  if (tableSummary) {
    return {
      id: "riassunto_tabella",
      text: tableSummary,
      command: { type: "RIASSUNTO" },
    };
  }

  const globalText = formatGlobalBriefingText(ctx);
  if (globalText) {
    return {
      id: "riassunto_briefing",
      text: globalText,
      command: { type: "RIASSUNTO" },
    };
  }

  return {
    id: "riassunto_empty",
    text: "Non ho un riepilogo aggiornato. Apri la dashboard o una lista con dati caricati e riprova.",
    command: null,
  };
}

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command?: object|null }|null}
 */
function tryTonyNavQuickReply(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  if (shouldSkipQuickReply(message, ctx)) return null;
  if (isTonyOperationalCreationIntent(message)) return null;

  const riassunto = tryRiassuntoQuickReply(message, ctx);
  if (riassunto) return riassunto;

  if (!isNavVerbRequest(message)) return null;

  const target = resolveNavTarget(message);
  if (!target) return null;

  const moduliAttivi = getModuliAttiviFromCtx(ctx);
  if (!isApriPaginaTargetAllowed(target, moduliAttivi)) {
    const mod = getRequiredModuleForTarget(target);
    return {
      id: "nav_module_blocked",
      text: moduleInactiveMessage(mod || []),
      command: null,
    };
  }

  if (isAlreadyOnTargetPage(ctx, target)) {
    const labels = {
      tariffe: "tariffe",
      terreni: "terreni",
      lavori: "lavori",
      prodotti: "prodotti",
      movimenti: "movimenti",
      dashboard: "dashboard",
    };
    const label = labels[target] || target;
    return {
      id: "nav_already_there",
      text: `Sei già sulla pagina ${label}. Puoi filtrare la lista o chiedermi un riepilogo.`,
      command: null,
    };
  }

  const text = NAV_TEXT_BY_TARGET[target] || `Ti porto a ${target}.`;
  return {
    id: "nav",
    text,
    command: { type: "APRI_PAGINA", target },
  };
}

module.exports = {
  NAV_TARGET_RULES,
  NAV_VERB_RE,
  RIASSUNTO_RE,
  FIELD_NAV_ALLOW,
  isNavVerbRequest,
  isRiassuntoRequest,
  resolveNavTarget,
  isFieldNavTargetAllowed,
  tryTonyNavQuickReply,
  tryTonyFieldNavQuickReply,
  tryRiassuntoQuickReply,
  formatGlobalBriefingText,
};
