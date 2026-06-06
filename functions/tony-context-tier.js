/**
 * Context tier T0–T4 — slice cache/build e risoluzione tier effettivo (Fase 2b).
 */

const { QUICK_REPLY_MAP } = require("./tony-quick-replies");

const TIER_RANK = { T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 };

function normalizeTierMax(tierMax) {
  if (!tierMax || tierMax === "T4_full") return "T4";
  const t = String(tierMax).toUpperCase();
  return TIER_RANK[t] != null ? t : "T4";
}

function tierRankNum(tierMax) {
  return TIER_RANK[normalizeTierMax(tierMax)] ?? 4;
}

function maxTier(tiers) {
  const list = (tiers || []).filter((t) => TIER_RANK[t] != null);
  if (!list.length) return "T4";
  return list.reduce((best, t) => (TIER_RANK[t] > TIER_RANK[best] ? t : best), list[0]);
}

/**
 * Riduce payload context azienda al tier richiesto (cache hit o prompt slim).
 * @param {object} azienda
 * @param {string} tierMax
 * @returns {object}
 */
function sliceContextAziendaToTier(azienda, tierMax) {
  if (!azienda || typeof azienda !== "object") return {};
  const max = tierRankNum(tierMax);
  if (max >= 4) return { ...azienda };

  const out = {};
  if (azienda._error != null) out._error = azienda._error;
  if (azienda._profiloCampo != null) out._profiloCampo = azienda._profiloCampo;
  if (azienda.messaggio != null) out.messaggio = azienda.messaggio;
  if (azienda.meteo != null) out.meteo = azienda.meteo;

  if (max >= 1) {
    out.summaryScadenze = azienda.summaryScadenze;
    out.summarySottoScorta = azienda.summarySottoScorta;
    out.prodottiSottoScorta = azienda.prodottiSottoScorta;
    out.guastiAperti = azienda.guastiAperti;
  }
  if (max >= 2) {
    out.clienti = azienda.clienti;
    out.preventivi = azienda.preventivi;
    out.tariffe = azienda.tariffe;
    out.tipiLavoro = azienda.tipiLavoro;
    out.categorie = azienda.categorie;
    out.colture = azienda.colture;
    out.poderi = azienda.poderi;
  }
  if (max >= 3) {
    out.terreni = azienda.terreni;
    out.terreniClienti = azienda.terreniClienti;
    out.macchine = azienda.macchine;
    out.trattori = azienda.trattori;
    out.attrezzi = azienda.attrezzi;
  }
  if (max >= 4) {
    out.prodotti = azienda.prodotti;
    out.movimentiRecenti = azienda.movimentiRecenti;
    out.summaryMovimentiRecenti = azienda.summaryMovimentiRecenti;
  }

  out._contextTier = normalizeTierMax(tierMax);
  return out;
}

function getQuickReplyTierRequired(quickReplyId) {
  if (!quickReplyId) return null;
  const entry = QUICK_REPLY_MAP.find((e) => e.id === quickReplyId);
  return entry && entry.tierRequired ? entry.tierRequired : null;
}

/**
 * Tier fetch effettivo: router + boost quick reply; conservativo su binario C.
 * @param {object|null} routerShadow
 * @returns {string}
 */
function resolveEffectiveTierMax(routerShadow) {
  if (!routerShadow) return "T4";
  if (routerShadow.tonyFieldProfile || routerShadow.tierCalculated === "T0") return "T0";

  let tier = normalizeTierMax(routerShadow.tierCalculated || "T4");
  const qrTier = getQuickReplyTierRequired(routerShadow.quickReplyCandidate);
  if (qrTier) tier = maxTier([tier, qrTier]);

  if (routerShadow.binario === "C") {
    tier = maxTier([tier, "T3"]);
    if (routerShadow.ambiguous) tier = "T4";
  }

  if (routerShadow.confidence === "low" && routerShadow.binario !== "A") {
    tier = maxTier([tier, "T4"]);
  }

  return tier;
}

module.exports = {
  TIER_RANK,
  normalizeTierMax,
  tierRankNum,
  maxTier,
  sliceContextAziendaToTier,
  getQuickReplyTierRequired,
  resolveEffectiveTierMax,
};
