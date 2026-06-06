"use strict";

const { normalizeFieldWorkspaceTonyResult } = require("./tony-field-workspace-command");

/** Log strutturato performance Tony ([Tony Perf] JSON in log CF). */
function logTonyPerf(perf, message) {
  if (!perf || typeof perf !== "object") return;
  const payload = {
    event: "tonyAsk_perf",
    tonyFieldProfile: perf.tonyFieldProfile || null,
    isTonyAdvanced: !!perf.isTonyAdvanced,
    cacheHit: !!perf.cacheHit,
    buildContextAziendaMs: perf.buildContextAziendaMs != null ? perf.buildContextAziendaMs : null,
    buildContextMeteoMs: perf.buildContextMeteoMs != null ? perf.buildContextMeteoMs : null,
    quickReplyHit: perf.quickReplyHit || null,
    geminiMs: perf.geminiMs != null ? perf.geminiMs : null,
    geminiRetryCount: perf.geminiRetryCount != null ? perf.geminiRetryCount : 0,
    usedGemini: !!perf.usedGemini,
    streamUsed: !!perf.streamUsed,
    timeToFirstChunkMs: perf.timeToFirstChunkMs != null ? perf.timeToFirstChunkMs : null,
    geminiStreamMs: perf.geminiStreamMs != null ? perf.geminiStreamMs : null,
    messageLen: message && typeof message === "string" ? message.length : 0,
    messageHash: perf.routerShadow && perf.routerShadow.messageHash ? perf.routerShadow.messageHash : null,
    routerBinario: perf.routerShadow && perf.routerShadow.binario ? perf.routerShadow.binario : null,
    routerTierCalculated: perf.routerShadow && perf.routerShadow.tierCalculated ? perf.routerShadow.tierCalculated : null,
    routerTierUsed: perf.routerShadow && perf.routerShadow.tierUsed ? perf.routerShadow.tierUsed : null,
    routerDomains: perf.routerShadow && Array.isArray(perf.routerShadow.domains) ? perf.routerShadow.domains : null,
    routerConfidence: perf.routerShadow && perf.routerShadow.confidence ? perf.routerShadow.confidence : null,
    routerAmbiguous: perf.routerShadow ? !!perf.routerShadow.ambiguous : null,
    routerQuickReplyCandidate:
      perf.routerShadow && perf.routerShadow.quickReplyCandidate ? perf.routerShadow.quickReplyCandidate : null,
    lavoroEntityParseHit: perf.lavoroEntityParseHit != null ? !!perf.lavoroEntityParseHit : null,
    lavoroInjectFieldsCount: perf.lavoroInjectFieldsCount != null ? perf.lavoroInjectFieldsCount : null,
    lavoroFollowUpTurns: perf.lavoroFollowUpTurns != null ? perf.lavoroFollowUpTurns : null,
  };
  console.log("[Tony Perf]", JSON.stringify(payload));
}

function finishTonyAskEarly(perf, message, result) {
  logTonyPerf(perf, message);
  if (result && typeof result === "object") {
    return normalizeFieldWorkspaceTonyResult(result);
  }
  return result;
}

module.exports = { logTonyPerf, finishTonyAskEarly };
