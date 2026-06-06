/**
 * Soglie meteo operative per consigli Tony (modulo meteo + Tony Avanzato).
 * @module functions/tony-meteo-rules
 */

/** Soglie mm lookback praticabilità per morfologia (default prodotto §19.4). */
const DEFAULT_PRATICABILITA_MM = {
  pianura: { okMax: 20, chiediMax: 50 },
  collina: { okMax: 3, chiediMax: 10 },
  montagna: { okMax: 0, chiediMax: 5 },
};

const TIPO_CAMPO_VALUES = ["pianura", "collina", "montagna"];

const DEFAULT_TONY_METEO_RULES = {
  trattamento: {
    ventoMaxKmh: 15,
    popMaxPercent: 30,
    pioggiaBloccoOre: 6,
  },
  lavoroCampo: {
    /** Solo pioggia/pop per Asse A; il vento non entra nella valutazione operativa. */
    popMaxPercent: 30,
    pioggiaBloccoMinuti: 60,
    rainSconsigliatoMm: 3,
    rainAttenzioneMm: 1,
    /** Giornate asciutte minime dopo pioggia significativa (stesse soglie mm praticabilità). */
    giorniAsciugaturaMin: {
      pianura: 1,
      collina: 2,
      montagna: 2,
    },
  },
  praticabilitaTerreno: { ...DEFAULT_PRATICABILITA_MM },
};

function mergeTonyMeteoRules(rules) {
  const r = rules || DEFAULT_TONY_METEO_RULES;
  const praticabilitaTerreno = { ...DEFAULT_PRATICABILITA_MM };
  const src = r.praticabilitaTerreno || {};
  for (const key of TIPO_CAMPO_VALUES) {
    if (src[key]) {
      praticabilitaTerreno[key] = { ...praticabilitaTerreno[key], ...src[key] };
    }
  }
  return { ...r, praticabilitaTerreno };
}

function normalizeTipoCampo(value) {
  const v = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (TIPO_CAMPO_VALUES.includes(v)) return v;
  return null;
}

/**
 * Estrae pianura | collina | montagna da messaggio utente.
 * @param {string} message
 * @returns {string|null}
 */
function parseTipoCampoFromMessage(message) {
  const m = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\bmontagna\b/.test(m)) return "montagna";
  if (/\bcollina\b/.test(m)) return "collina";
  if (/\bpianura\b/.test(m)) return "pianura";
  return null;
}

function labelMorfologia(tipoCampo) {
  if (tipoCampo === "collina") return "in collina";
  if (tipoCampo === "montagna") return "in montagna";
  if (tipoCampo === "pianura") return "in pianura";
  return "";
}

/**
 * Somma mm previsti su giorno candidato + lookback (D−1; montagna anche D−2).
 * @param {Array<{dt?: string, rainMm?: number|null}>} previsioni
 * @param {string} targetDt - ISO date YYYY-MM-DD
 * @param {string|null} tipoCampo
 * @returns {{ total: number, giorni: string[] }}
 */
function computeLookbackRainMm(previsioni, targetDt, tipoCampo) {
  const list = Array.isArray(previsioni) ? previsioni.filter((p) => p && p.dt) : [];
  const idx = list.findIndex((p) => p.dt === targetDt);
  if (idx < 0) return { total: 0, giorni: [] };

  const indices = [idx];
  if (idx > 0) indices.unshift(idx - 1);
  if (tipoCampo === "montagna" && idx > 1) indices.unshift(idx - 2);

  const giorni = [];
  let total = 0;
  for (const i of indices) {
    const p = list[i];
    if (!p) continue;
    giorni.push(p.dt);
    total += p.rainMm != null ? Number(p.rainMm) : 0;
  }
  return { total: Math.round(total * 10) / 10, giorni };
}

/**
 * Giorni consecutivi asciutti immediatamente prima del giorno valutato.
 * @returns {{ dryDays: number, lastRainMm: number, lastRainDt: string|null }}
 */
function computeDryDaysBeforeTarget(previsioni, targetDt) {
  const list = Array.isArray(previsioni) ? previsioni.filter((p) => p && p.dt) : [];
  const idx = list.findIndex((p) => p.dt === targetDt);
  if (idx <= 0) return { dryDays: 999, lastRainMm: 0, lastRainDt: null };

  let dryDays = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const rain = list[i].rainMm != null ? Number(list[i].rainMm) : 0;
    if (rain >= 0.1) {
      return {
        dryDays,
        lastRainMm: Math.round(rain * 10) / 10,
        lastRainDt: list[i].dt,
      };
    }
    dryDays++;
  }
  return { dryDays: 999, lastRainMm: 0, lastRainDt: null };
}

function isRainSignificativaForAsciugatura(mm, tipoCampo, rules) {
  const r = mergeTonyMeteoRules(rules);
  const tc = normalizeTipoCampo(tipoCampo);
  if (!tc) return false;
  const soglie = r.praticabilitaTerreno[tc];
  const rain = Number(mm) || 0;
  if (tc === "montagna") return rain > 0;
  return rain > soglie.okMax;
}

/**
 * Asse B bis — tempo di asciugatura dopo pioggia significativa (solo lavoroCampo).
 * @returns {{ esito: 'ok'|'impraticabile', dryDays: number, lastRainMm: number, motivi: string[] }}
 */
function evaluateAsciugaturaLavoroCampo(previsioni, targetDt, tipoCampo, rules) {
  const r = mergeTonyMeteoRules(rules);
  const tc = normalizeTipoCampo(tipoCampo);
  const morf = labelMorfologia(tc);
  const cfgMin = (r.lavoroCampo && r.lavoroCampo.giorniAsciugaturaMin) || {};
  const minDry = cfgMin[tc] != null ? cfgMin[tc] : tc === "pianura" ? 1 : 2;
  const { dryDays, lastRainMm, lastRainDt } = computeDryDaysBeforeTarget(previsioni, targetDt);

  if (!lastRainDt || !isRainSignificativaForAsciugatura(lastRainMm, tc, r)) {
    return { esito: "ok", dryDays, lastRainMm: 0, motivi: [] };
  }

  if (dryDays < minDry) {
    const mancano = minDry - dryDays;
    return {
      esito: "impraticabile",
      dryDays,
      lastRainMm,
      motivi: [
        `${morf}, dopo circa ${lastRainMm} mm previsti di recente servono almeno ${minDry} giornate asciutte prima di lavorare il terreno` +
          (mancano === 1 ? " (manca ancora circa un giorno)" : ` (mancano circa ${mancano} giorni)`),
      ],
    };
  }

  return { esito: "ok", dryDays, lastRainMm, motivi: [] };
}

function impraticabileMotivo(tipoCampo, mm, activityKind) {
  const morf = labelMorfologia(tipoCampo);
  if (activityKind === "lavoroCampo") {
    return `${morf}, con circa ${mm} mm previsti nei giorni precedenti e nel giorno valutato, il terreno resta troppo bagnato per la lavorazione`;
  }
  return `${morf}, con circa ${mm} mm previsti nei giorni precedenti e nel giorno valutato, il terreno resta troppo bagnato per il passaggio del trattore`;
}

/**
 * Asse B — praticabilità terreno per morfologia (mm lookback × soglie default/tenant).
 * @returns {{ esito: 'ok'|'chiedi'|'impraticabile', lookbackMm: number, giorni: string[], motivi: string[], tipoCampo: string }}
 */
function evaluatePraticabilitaTerreno(tipoCampo, lookbackMm, rules, activityKind) {
  const r = mergeTonyMeteoRules(rules);
  const tc = normalizeTipoCampo(tipoCampo);
  const mm = Number(lookbackMm) || 0;
  const soglie = r.praticabilitaTerreno[tc];
  const morf = labelMorfologia(tc);
  const motivi = [];
  const act = activityKind || "trattamento";

  if (!tc || !soglie) {
    return { esito: "impraticabile", lookbackMm: mm, giorni: [], motivi: [], tipoCampo: tc };
  }

  if (mm >= soglie.chiediMax) {
    motivi.push(impraticabileMotivo(tc, mm, act));
    return { esito: "impraticabile", lookbackMm: mm, giorni: [], motivi, tipoCampo: tc };
  }

  if (mm > soglie.okMax) {
    const chiediHint =
      act === "lavoroCampo"
        ? "il terreno potrebbe essere ancora lavorabile, ma dipende dalle condizioni locali"
        : "il campo potrebbe essere ancora praticabile, ma dipende dal terreno";
    motivi.push(`${morf}, con circa ${mm} mm previsti nella finestra pioggia recente: ${chiediHint}`);
    return { esito: "chiedi", lookbackMm: mm, giorni: [], motivi, tipoCampo: tc };
  }

  if (tc === "collina" && mm > 0) {
    motivi.push(`${morf}, con circa ${mm} mm previsti: procedi con cautela`);
  } else if (tc === "montagna" && mm === 0) {
    motivi.push(`${morf}, senza pioggia prevista nella finestra: terreno generalmente praticabile`);
  } else if (mm > 0) {
    motivi.push(`${morf}, circa ${mm} mm previsti nella finestra: praticabilità accettabile`);
  }

  return { esito: "ok", lookbackMm: mm, giorni: [], motivi, tipoCampo: tc };
}

/**
 * Combina Asse A (meteo giorno) + Asse B (praticabilità lookback).
 * @param {object} [opts]
 * @param {boolean|null} [opts.trattorePraticabile] - risposta utente in fascia «chiedi»
 */
function evaluateGiornoOperativoCompleto(day, previsioni, targetDt, tipoCampo, activityKind, rules, opts = {}) {
  const r = mergeTonyMeteoRules(rules);
  const evalOpts = { ...opts, activityKind };
  const meteo = evaluateMeteoOperativoGiorno(day, activityKind, r);
  const tc = normalizeTipoCampo(tipoCampo);

  if (!tc) {
    return {
      esito: "morfologia_mancante",
      motivi: meteo.motivi,
      meteo,
      praticabilita: null,
      lookbackMm: null,
      activityKind,
    };
  }

  const lookback = computeLookbackRainMm(previsioni, targetDt, tc);
  const prat = evaluatePraticabilitaTerreno(tc, lookback.total, r, activityKind);
  prat.giorni = lookback.giorni;

  const motivi = [...meteo.motivi];

  if (activityKind === "lavoroCampo") {
    const asc = evaluateAsciugaturaLavoroCampo(previsioni, targetDt, tc, r);
    if (asc.esito === "impraticabile") {
      return {
        esito: "sconsigliato",
        motivi: [...motivi, ...asc.motivi],
        meteo,
        praticabilita: prat,
        asciugatura: asc,
        lookbackMm: lookback.total,
        activityKind,
      };
    }
  }

  if (prat.esito === "impraticabile") {
    return {
      esito: "sconsigliato",
      motivi: [...motivi, ...prat.motivi],
      meteo,
      praticabilita: prat,
      lookbackMm: lookback.total,
      activityKind,
    };
  }

  if (prat.esito === "chiedi") {
    if (evalOpts.trattorePraticabile === true) {
      if (meteo.esito === "sconsigliato") {
        return {
          esito: "sconsigliato",
          motivi,
          meteo,
          praticabilita: prat,
          lookbackMm: lookback.total,
          activityKind,
        };
      }
      const esito = meteo.esito === "attenzione" ? "attenzione" : "attenzione";
      return {
        esito,
        motivi: [
          ...motivi,
          ...prat.motivi,
          activityKind === "lavoroCampo"
            ? "Hai confermato che il terreno è praticabile per la lavorazione"
            : "Hai confermato che riesci a passare con il trattore",
        ],
        meteo,
        praticabilita: prat,
        lookbackMm: lookback.total,
        activityKind,
      };
    }
    if (evalOpts.trattorePraticabile === false) {
      return {
        esito: "sconsigliato",
        motivi: [
          ...motivi,
          ...prat.motivi,
          activityKind === "lavoroCampo"
            ? "Hai indicato che non riesci a lavorare il terreno: meglio posticipare o anticipare"
            : "Hai indicato che non riesci a passare con il trattore: meglio posticipare o anticipare",
        ],
        meteo,
        praticabilita: prat,
        lookbackMm: lookback.total,
        activityKind,
      };
    }
    return {
      esito: "chiedi_trattore",
      motivi: [...motivi, ...prat.motivi],
      meteo,
      praticabilita: prat,
      lookbackMm: lookback.total,
      activityKind,
    };
  }

  if (prat.motivi.length) {
    motivi.push(...prat.motivi.filter((m) => !motivi.some((x) => x.includes(m.slice(0, 20)))));
  }

  let esito = meteo.esito;
  if (meteo.esito === "ok" && prat.esito === "ok") esito = "ok";
  else if (meteo.esito === "sconsigliato") esito = "sconsigliato";
  else if (meteo.esito === "attenzione" || prat.esito === "ok") esito = meteo.esito === "attenzione" ? "attenzione" : "ok";

  return {
    esito,
    motivi,
    meteo,
    praticabilita: prat,
    lookbackMm: lookback.total,
    activityKind,
  };
}

function isGiornoOperativoAccettabile(ev) {
  if (!ev) return false;
  if (ev.esito === "morfologia_mancante" || ev.esito === "chiedi_trattore") return false;
  if (ev.esito === "sconsigliato") return false;
  return ev.esito === "ok";
}

/** Giorno «ideale»: meteo ok (no pioggia significativa, vento entro soglia) + praticabilità ok. */
function isGiornoOperativoIdeale(ev) {
  return isGiornoOperativoAccettabile(ev);
}

/**
 * Giorno accettabile con riserva: attenzione meteo ma ancora entro soglie operative (no pop alta / mm elevati).
 */
function isGiornoOperativoRiserva(ev, activityKind, rules) {
  if (!ev || ev.esito !== "attenzione") return false;
  if (ev.praticabilita && ev.praticabilita.esito === "impraticabile") return false;
  const meteo = ev.meteo;
  if (!meteo || meteo.esito === "sconsigliato") return false;
  const r = mergeTonyMeteoRules(rules);
  const cfg = activityKind === "trattamento" ? r.trattamento : r.lavoroCampo;
  const pop = meteo.pop != null ? Number(meteo.pop) : null;
  const wind = meteo.wind != null ? Number(meteo.wind) : null;
  const rainMm = meteo.rainMm != null ? Number(meteo.rainMm) : null;
  if (pop != null && pop > cfg.popMaxPercent) return false;
  if (activityKind === "trattamento" && cfg.ventoMaxKmh != null && wind != null && wind > cfg.ventoMaxKmh) {
    return false;
  }
  const rainMax =
    activityKind === "trattamento" ? 0.5 : cfg.rainSconsigliatoMm != null ? cfg.rainSconsigliatoMm : 3;
  if (rainMm != null && rainMm >= rainMax) return false;
  return true;
}

function normalizeTerrenoKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchTerrenoMeteoRow(terreniRows, lavoro) {
  if (!Array.isArray(terreniRows) || !lavoro) return null;
  const tid = lavoro.terrenoId || lavoro.terreno_id;
  if (tid) {
    const byId = terreniRows.find((r) => r.terrenoId === tid);
    if (byId) return byId;
  }
  const name = lavoro.terreno || lavoro.terrenoNome || "";
  if (!name) return null;
  const key = normalizeTerrenoKey(name);
  return (
    terreniRows.find((r) => normalizeTerrenoKey(r.nome) === key) ||
    terreniRows.find((r) => normalizeTerrenoKey(r.nome).includes(key) || key.includes(normalizeTerrenoKey(r.nome))) ||
    null
  );
}

function isLavoroAttivoOrProgrammato(stato) {
  const s = String(stato || "").toLowerCase();
  return (
    !s ||
    s === "in_corso" ||
    s === "programmato" ||
    s === "pianificato" ||
    s === "da_iniziare" ||
    s === "attivo"
  );
}

/**
 * @param {object} rules
 * @param {Array<object>} terreniRows - righe compatte da buildContextMeteo
 * @param {Array<object>} lavori
 * @param {object|null} sedeCompact
 */
function buildMeteoConsigli(rules, terreniRows, lavori, sedeCompact) {
  const r = rules || DEFAULT_TONY_METEO_RULES;
  const consigli = [];
  const seen = new Set();

  function pushConsiglio(c) {
    const key = `${c.tipo}|${c.terrenoId || ""}|${c.lavoroId || ""}|${c.esito}|${c.motivo}`;
    if (seen.has(key)) return;
    seen.add(key);
    consigli.push(c);
  }

  if (sedeCompact && sedeCompact.alertsCount > 0) {
    pushConsiglio({
      tipo: "alert",
      scope: "sede",
      esito: "attenzione",
      motivo: sedeCompact.alertBreve
        ? `Alert meteo sede: ${sedeCompact.alertBreve}`
        : "Alert meteo attivo sulla sede aziendale",
    });
  }

  for (const row of terreniRows || []) {
    if (!row.ok) continue;
    if (row.alertsCount > 0) {
      pushConsiglio({
        tipo: "alert",
        scope: "terreno",
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: "attenzione",
        motivo: `Alert meteo su ${row.nome}`,
      });
    }
    if (row.hasRainSoon) {
      pushConsiglio({
        tipo: "lavoro",
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: "attenzione",
        motivo: `Pioggia prevista entro circa un'ora su ${row.nome}`,
      });
    }
    if (row.windSpeedKmh != null && row.windSpeedKmh > r.trattamento.ventoMaxKmh) {
      pushConsiglio({
        tipo: "trattamento",
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: "sconsigliato",
        motivo: `Vento ${row.windSpeedKmh} km/h su ${row.nome} (soglia trattamento ${r.trattamento.ventoMaxKmh} km/h)`,
      });
    }
    if (row.popDomani != null && row.popDomani > r.trattamento.popMaxPercent) {
      pushConsiglio({
        tipo: "trattamento",
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: "sconsigliato",
        motivo: `Domani pioggia probabile al ${row.popDomani}% su ${row.nome}`,
      });
    }
  }

  for (const lavoro of lavori || []) {
    if (!isLavoroAttivoOrProgrammato(lavoro.stato)) continue;
    const row = matchTerrenoMeteoRow(terreniRows, lavoro);
    if (!row || !row.ok) continue;
    const nomeLavoro = lavoro.nome || lavoro.tipoLavoro || "Lavoro";
    if (row.hasRainSoon) {
      pushConsiglio({
        tipo: "lavoro",
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        lavoroId: lavoro.id,
        lavoroNome: nomeLavoro,
        esito: "attenzione",
        motivo: `Pioggia imminente sul campo di «${nomeLavoro}» (${row.nome})`,
      });
    }
  }

  return consigli.slice(0, 25);
}

/**
 * Valuta se un giorno è adatto a trattamento o lavoro in campo (soglie tenant/default).
 * @param {object|null|undefined} day - snapshot giorno (pop, rainMm, windSpeedKmh)
 * @param {'trattamento'|'lavoroCampo'} activityKind
 * @param {object} [rules]
 * @returns {{ esito: 'ok'|'attenzione'|'sconsigliato', motivi: string[], pop: number|null, wind: number|null, rainMm: number|null, activityKind: string }}
 */
function evaluateMeteoOperativoGiorno(day, activityKind, rules) {
  const r = rules || DEFAULT_TONY_METEO_RULES;
  const cfg = activityKind === "trattamento" ? r.trattamento : r.lavoroCampo;
  const pop = day && day.pop != null ? Number(day.pop) : null;
  const wind = day && day.windSpeedKmh != null ? Number(day.windSpeedKmh) : null;
  const rainMm = day && day.rainMm != null ? Number(day.rainMm) : null;
  const motivi = [];
  let score = 0;

  const popMax = cfg.popMaxPercent != null ? cfg.popMaxPercent : 30;
  const rainSconsigliato =
    activityKind === "trattamento" ? 0.5 : cfg.rainSconsigliatoMm != null ? cfg.rainSconsigliatoMm : 3;
  const rainAttenzione =
    activityKind === "trattamento" ? 0.1 : cfg.rainAttenzioneMm != null ? cfg.rainAttenzioneMm : 1;
  const valutaVento = activityKind === "trattamento";
  const ventoMax = valutaVento ? cfg.ventoMaxKmh : null;

  if (pop != null && pop > popMax) {
    motivi.push(`probabilità di pioggia del ${pop}%`);
    score += 3;
  } else if (pop != null && pop >= 20) {
    motivi.push(`possibile pioggia (${pop}%)`);
    score += 1;
  }

  if (rainMm != null && rainMm >= rainSconsigliato) {
    if (!motivi.some((m) => m.includes("mm"))) {
      motivi.push(`circa ${Math.round(rainMm * 10) / 10} mm previsti in giornata`);
    }
    score += 3;
  } else if (rainMm != null && rainMm >= rainAttenzione) {
    if (!motivi.some((m) => m.includes("mm"))) {
      motivi.push(`circa ${Math.round(rainMm * 10) / 10} mm previsti`);
    }
    score += 1;
  }

  if (valutaVento && ventoMax != null) {
    if (wind != null && wind > ventoMax) {
      motivi.push(`vento ${wind} km/h (soglia ${ventoMax} km/h per trattamenti)`);
      score += 3;
    } else if (wind != null && wind > ventoMax - 3) {
      motivi.push(`vento ${wind} km/h, vicino al limite per trattamenti`);
      score += 1;
    }
  }

  let esito = "ok";
  if (score >= 3) esito = "sconsigliato";
  else if (score >= 1) esito = "attenzione";

  if (esito === "ok") {
    motivi.length = 0;
    if (pop != null) motivi.push(`probabilità di pioggia del ${pop}%`);
    else motivi.push("pioggia poco probabile");
    if (valutaVento && wind != null) motivi.push(`vento ${wind} km/h`);
    if (rainMm != null && rainMm > 0) {
      motivi.push(`circa ${Math.round(rainMm * 10) / 10} mm previsti`);
    } else if (activityKind === "lavoroCampo") {
      motivi.push("nessuna pioggia significativa prevista in giornata");
    }
  }

  return { esito, motivi, pop, wind, rainMm, activityKind };
}

module.exports = {
  DEFAULT_TONY_METEO_RULES,
  DEFAULT_PRATICABILITA_MM,
  TIPO_CAMPO_VALUES,
  mergeTonyMeteoRules,
  parseTipoCampoFromMessage,
  normalizeTipoCampo,
  labelMorfologia,
  computeLookbackRainMm,
  computeDryDaysBeforeTarget,
  evaluateAsciugaturaLavoroCampo,
  evaluatePraticabilitaTerreno,
  evaluateGiornoOperativoCompleto,
  isGiornoOperativoAccettabile,
  isGiornoOperativoIdeale,
  isGiornoOperativoRiserva,
  buildMeteoConsigli,
  evaluateMeteoOperativoGiorno,
};
