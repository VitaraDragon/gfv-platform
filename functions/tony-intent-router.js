/**
 * Tony intent router — Fase 2b tier enforcement (binario + tier → fetch/prompt).
 */

const crypto = require("crypto");
const { normalizeItTony, shouldSkipQuickReply, QUICK_REPLY_MAP, isTonyOperationalCreationIntent } = require("./tony-quick-replies");
const { getModuliAttiviFromCtx, isQuickReplyAllowed } = require("./tony-module-gate");
const { maxTier, getQuickReplyTierRequired } = require("./tony-context-tier");

const TIER_RANK = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };

const DOMAIN_SIGNALS = [
  { domain: "magazzino", tier: "T4", patterns: [/magazzin/i, /scort/i, /giacenz/i, /moviment/i, /prodott/i, /carich/i, /scarich/i] },
  { domain: "conto_terzi", tier: "T2", patterns: [/tariff/i, /client/i, /preventiv/i, /conto\s*terzi/i, /offerta/i, /quotazion/i] },
  { domain: "macchine", tier: "T3", patterns: [/trattor/i, /macchin/i, /mezzi/i, /guast/i, /attrezz/i, /flotta/i, /revision/i] },
  { domain: "terreni", tier: "T3", patterns: [/terren/i, /appezzament/i, /podere/i, /vignet/i, /fruttet/i] },
  { domain: "manodopera", tier: "T3", patterns: [/lavor/i, /opera/i, /squadra/i, /ore\b/i, /segnatur/i, /validazion/i] },
  { domain: "scadenze", tier: "T1", patterns: [/scaden/i, /affitt/i, /assicuraz/i] },
  { domain: "meteo", tier: "T3", patterns: [/meteo/i, /pioggia/i, /prevision/i, /tempo\b/i, /vento/i, /trattor/i] },
  { domain: "riepilogo", tier: "T1", patterns: [/riassunto/i, /briefing/i, /cosa devo fare/i] },
  { domain: "navigazione", tier: "T1", patterns: [/\b(apri|portami|vai a|mostrami la pagina|aprire)\b/i] },
];

const BINARIO_C_CREATION_PATTERNS = [
  /\b(crea|nuovo|compila|prepara|programma|pianifica|assegna|schedula)\s*(un?\s*)?(lavoro|attivit|preventivo|offerta|quotazione)/i,
  /\b(preventivo|offerta|quotazione)\s+(per|di|del|della)\b/i,
  /\b(mi\s+fai\s+(un\s+)?preventivo|compila\s+(il\s+)?form)\b/i,
];

const BINARIO_C_PATTERNS = [
  ...BINARIO_C_CREATION_PATTERNS,
  /\b(ok\s+)?salva\b|\bsalva\s+(il|l'|la)\b|\bconfermo\s+(il\s+)?salvataggio\b/i,
  /\b(inject|compila\s+il\s+campo|imposta\s+nel\s+form)\b/i,
  /\b(ho\s+(trinciato|erpicato|potato|fresato|lavorato|fatto)|segna\s+le\s+ore)\b/i,
  /\bform\s+completo,?\s*confermi\s+salvataggio\b/i,
];

const BINARIO_B_PATTERNS = [
  /\b(apri|portami|vai a|mostrami la pagina|aprire|naviga)\b/i,
  /\briassunto\b/i,
  /\b(filtra|mostra\s+solo|reset\s+filtri)\b/i,
  /\bFILTER_TABLE\b/i,
];

const METEO_OPERATIVO_PATTERNS = [
  /\b(trinciare|trinciatura|erpicare|erpicatura|potare|potatura|fresare|fresatura|vangare|diserbare|lavorare\s+il\s+campo|lavoro\s+campo)\b/i,
  /\b(posso|conviene|riesco|regge|praticabil)\b.*\b(domani|dopodomani|oggi|luned|marted|mercoled|gioved|venerd|sabato|domenica)\b/i,
  /\b(domani|dopodomani)\b.*\b(trinci|erpic|potat|fresat|lavor)\b/i,
];

const FORM_IDS_T3 = new Set([
  "attivita-form",
  "attivita-modal",
  "lavoro-form",
  "lavoro-modal",
  "preventivo-form",
  "form-trattamento",
  "prodotto-form",
  "movimento-form",
]);

function messageHash(message) {
  const norm = normalizeItTony(message);
  if (!norm) return null;
  return crypto.createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

function detectDomains(message) {
  const msg = normalizeItTony(message);
  const hits = [];
  for (const sig of DOMAIN_SIGNALS) {
    if ((sig.patterns || []).some((re) => re.test(msg))) {
      hits.push({ domain: sig.domain, tier: sig.tier });
    }
  }
  return hits;
}

function isTonyMeteoOperationalQuestionLocal(message) {
  if (isTonyOperationalCreationIntent(message)) return false;
  const msg = normalizeItTony(message);
  if (!msg) return false;
  return METEO_OPERATIVO_PATTERNS.some((re) => re.test(msg));
}

function previewQuickReplyMatch(message, ctx) {
  if (shouldSkipQuickReply(message, ctx)) return null;
  const moduliAttivi = getModuliAttiviFromCtx(ctx || {});
  for (const entry of QUICK_REPLY_MAP) {
    const keywords = entry.keywords || [];
    const matched = keywords.some((kw) => {
      if (kw instanceof RegExp) return kw.test(message);
      return String(message || "").toLowerCase().includes(String(kw).toLowerCase());
    });
    if (!matched) continue;
    if (!isQuickReplyAllowed(entry.id, moduliAttivi)) continue;
    return entry.id;
  }
  return null;
}

function isMeteoConsultMessage(message) {
  const msg = normalizeItTony(message);
  if (!msg) return false;
  return /\b(meteo|pioggia|prevision|tempo|vento|umidit|trattor|praticabil|asciugatur|lavoro\s+campo)\b/i.test(msg);
}

function classifyBinario(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  const formId = String(input.formId || ctx.form?.formId || ctx.form?.modalId || "").toLowerCase();
  const msg = normalizeItTony(message);

  if (input.tonyFieldProfile) {
    if (BINARIO_B_PATTERNS.some((re) => re.test(msg))) return "B";
    return "C";
  }

  if (FORM_IDS_T3.has(formId) && msg && !previewQuickReplyMatch(message, ctx)) {
    if (!BINARIO_B_PATTERNS.some((re) => re.test(msg)) || /\b(salva|conferm|impostato|terreno|orari|ore)\b/i.test(msg)) {
      return "C";
    }
  }

  if (BINARIO_C_PATTERNS.some((re) => re.test(msg))) return "C";

  const quickId = previewQuickReplyMatch(message, ctx);
  if (quickId) return "A";

  if (isTonyMeteoOperationalQuestionLocal(message)) return "A";

  if (isMeteoConsultMessage(message) && !BINARIO_C_PATTERNS.some((re) => re.test(msg))) return "A";

  if (BINARIO_B_PATTERNS.some((re) => re.test(msg))) return "B";

  if (detectPreventivoListActionVerbLocal(msg)) return "A";

  return "C";
}

/** Copia minima allineata a tony-quick-replies (evita export circolare). */
function detectPreventivoListActionVerbLocal(msgNorm) {
  if (!/\bpreventiv/.test(msgNorm)) return false;
  const invia = /\b(invia|invio|manda|spedisc)\b/.test(msgNorm);
  const accetta = /\b(accetta|accettare|accettalo)\b/.test(msgNorm);
  return invia || accetta;
}

function resolveTierUsed(tierCalculated, quickReplyCandidate, binario, ambiguous, confidence) {
  let tier = tierCalculated || "T4";
  const qrTier = getQuickReplyTierRequired(quickReplyCandidate);
  if (qrTier) tier = maxTier([tier, qrTier]);
  if (binario === "C") {
    tier = maxTier([tier, "T3"]);
    if (ambiguous) tier = "T4";
  }
  if (confidence === "low" && binario !== "A") {
    tier = maxTier([tier, "T4"]);
  }
  return tier;
}

/**
 * Classifica binario A/B/C + tier; tierUsed = tier effettivo per fetch (Fase 2b).
 * @returns {object}
 */
function classifyTonyIntentShadow(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  const formId = input.formId || ctx.form?.formId || ctx.form?.modalId || null;

  if (input.tonyFieldProfile) {
    return {
      shadowMode: false,
      tierEnforcement: true,
      messageHash: messageHash(message),
      binario: classifyBinario({ ...input, tonyFieldProfile: true }),
      tierCalculated: "T0",
      tierUsed: "T0",
      domains: ["field_profile"],
      confidence: "high",
      ambiguous: false,
      quickReplyCandidate: null,
    };
  }

  const domainHits = detectDomains(message);
  const domains = [...new Set(domainHits.map((h) => h.domain))];
  let tierCalculated = maxTier(domainHits.map((h) => h.tier));

  if (formId && FORM_IDS_T3.has(String(formId).toLowerCase())) {
    tierCalculated = maxTier([tierCalculated, "T3"]);
    if (!domains.includes("form_operativo")) domains.push("form_operativo");
  }

  if (ctx.page && ctx.page.currentTableData && ctx.page.currentTableData.pageType) {
    tierCalculated = maxTier([tierCalculated, "T2"]);
  }

  const quickReplyCandidate = previewQuickReplyMatch(message, ctx);
  const binario = classifyBinario({ message, ctx, formId, tonyFieldProfile: false });
  const ambiguous = domains.length >= 3 || (domains.includes("meteo") && domains.includes("magazzino"));

  if (ambiguous) {
    tierCalculated = "T4";
  }

  if (!domainHits.length && binario === "C") {
    tierCalculated = "T4";
  }

  if (binario === "C" && !formId) {
    const msgNorm = normalizeItTony(message);
    if (BINARIO_C_CREATION_PATTERNS.some((re) => re.test(msgNorm))) {
      tierCalculated = maxTier([tierCalculated, "T4"]);
    }
  }

  let confidence = "medium";
  if (quickReplyCandidate || binario === "B") confidence = "high";
  if (ambiguous) confidence = "low";

  const tierUsed = resolveTierUsed(tierCalculated, quickReplyCandidate, binario, ambiguous, confidence);

  return {
    shadowMode: false,
    tierEnforcement: true,
    messageHash: messageHash(message),
    binario,
    tierCalculated,
    tierUsed,
    domains,
    confidence,
    ambiguous,
    quickReplyCandidate,
  };
}

module.exports = {
  classifyTonyIntentShadow,
  messageHash,
  maxTier,
  detectDomains,
  previewQuickReplyMatch,
  isTonyMeteoOperationalQuestionLocal,
};
