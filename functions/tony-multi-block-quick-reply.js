/**
 * Quick reply multi-blocco (Fase 4.3): più domini noti → concatena risposte A senza Gemini.
 * Fallback Gemini se un blocco manca o serve ragionamento.
 */

const { normalizeItTony, shouldSkipQuickReply, isTonyOperationalCreationIntent, tryTonyQuickReplies } = require("./tony-quick-replies");
const { detectDomains } = require("./tony-intent-router");
const { isTonyMeteoQuestion } = require("./meteo-service");

const MULTI_DOMAIN_MIN = 2;

/**
 * @param {{ message: string, history?: object[], ctx: object, meteoFns?: object }} input
 * @returns {Promise<{ id: string, text: string, command?: object|null }|null>}
 */
async function tryTonyMultiBlockQuickReply(input) {
  const message = input && input.message;
  const ctx = (input && input.ctx) || {};
  const meteoFns = (input && input.meteoFns) || {};

  if (shouldSkipQuickReply(message, ctx)) return null;
  if (isTonyOperationalCreationIntent(message)) return null;

  const domainHits = detectDomains(message);
  const domains = [...new Set(domainHits.map((h) => h.domain))];
  if (domains.length < MULTI_DOMAIN_MIN) return null;

  const blocks = [];
  const usedDomains = new Set();

  const needsMeteo =
    domains.includes("meteo") ||
    /\b(meteo|pioggia|prevision|tempo|domani|trattament)\b/i.test(normalizeItTony(message));
  const needsMagazzino = domains.includes("magazzino") || /\b(scort|concime|giacenz)\b/i.test(normalizeItTony(message));
  const needsScadenze = domains.includes("scadenze") || /\bscaden/i.test(normalizeItTony(message));

  if (needsMeteo && meteoFns) {
    const tryOperativo = meteoFns.tryMeteoOperativoQuickReply;
    const tryGiorno = meteoFns.tryMeteoGiornoQuickReply;
    const tryCondizioni = meteoFns.tryMeteoCondizioniQuickReply;
    const aziendaMeteo = (ctx.azienda && ctx.azienda.meteo) || null;
    if (aziendaMeteo && aziendaMeteo.disponibile && (isTonyMeteoQuestion(message) || needsMeteo)) {
      const terreniNames = ((ctx.azienda && ctx.azienda.terreni) || [])
        .map((t) => String(t.nome || "").trim())
        .filter(Boolean);
      const opts = {
        terreniNames,
        terreniCatalog: (ctx.azienda.terreni || []).map((t) => ({
          id: t.id,
          nome: t.nome,
          tipoCampo: t.tipoCampo || null,
        })),
        history: input.history,
        db: meteoFns.db,
        tenantId: meteoFns.tenantId,
        tonyContext: ctx,
      };
      const meteoText =
        (typeof tryOperativo === "function"
          ? await tryOperativo(message, aziendaMeteo, opts)
          : null) ||
        (typeof tryGiorno === "function" ? tryGiorno(message, aziendaMeteo, { terreniNames }) : null) ||
        (typeof tryCondizioni === "function"
          ? tryCondizioni(message, aziendaMeteo, { terreniNames })
          : null);
      if (meteoText && String(meteoText).trim()) {
        blocks.push({ domain: "meteo", text: String(meteoText).trim() });
        usedDomains.add("meteo");
      }
    }
  }

  if (needsMagazzino) {
    const scorteHit = tryTonyQuickReplies({
      message: "cosa abbiamo sotto scorta?",
      ctx,
      history: input.history,
    });
    if (scorteHit && scorteHit.id === "query_scorte" && scorteHit.text) {
      blocks.push({ domain: "magazzino", text: scorteHit.text });
      usedDomains.add("magazzino");
    }
  }

  if (needsScadenze) {
    const scadHit = tryTonyQuickReplies({
      message: "quali scadenze abbiamo?",
      ctx,
      history: input.history,
    });
    if (scadHit && scadHit.id === "query_scadenze" && scadHit.text) {
      blocks.push({ domain: "scadenze", text: scadHit.text });
      usedDomains.add("scadenze");
    }
  }

  const required = [needsMeteo && "meteo", needsMagazzino && "magazzino", needsScadenze && "scadenze"].filter(
    Boolean
  );
  const gotAll = required.every((d) => usedDomains.has(d));
  if (!gotAll || blocks.length < MULTI_DOMAIN_MIN) return null;

  const intro = "Ecco un riepilogo per i punti che hai chiesto:";
  const body = blocks.map((b) => b.text).join("\n\n");
  return {
    id: "multi_block",
    text: `${intro}\n\n${body}`,
    command: null,
  };
}

module.exports = {
  tryTonyMultiBlockQuickReply,
};
