/**
 * Soglie meteo operative per consigli Tony (client mirror di functions/tony-meteo-rules.js).
 * @module core/config/tony-meteo-rules
 */

export const DEFAULT_PRATICABILITA_MM = {
  pianura: { okMax: 20, chiediMax: 50 },
  collina: { okMax: 3, chiediMax: 10 },
  montagna: { okMax: 0, chiediMax: 5 },
};

export const DEFAULT_TONY_METEO_RULES = {
  trattamento: {
    ventoMaxKmh: 15,
    popMaxPercent: 30,
    pioggiaBloccoOre: 6,
  },
  lavoroCampo: {
    popMaxPercent: 30,
    pioggiaBloccoMinuti: 60,
    rainSconsigliatoMm: 3,
    rainAttenzioneMm: 1,
    giorniAsciugaturaMin: {
      pianura: 1,
      collina: 2,
      montagna: 2,
    },
  },
  praticabilitaTerreno: { ...DEFAULT_PRATICABILITA_MM },
};

function normalizeTerrenoKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchTerrenoMeteoRow(terreniRows, lavoro) {
  if (!Array.isArray(terreniRows) || !lavoro) return null;
  const tid = lavoro.terrenoId || lavoro.terreno_id;
  if (tid) {
    const byId = terreniRows.find((r) => r.terrenoId === tid);
    if (byId) return byId;
  }
  const name = lavoro.terreno || lavoro.terrenoNome || '';
  if (!name) return null;
  const key = normalizeTerrenoKey(name);
  return (
    terreniRows.find((r) => normalizeTerrenoKey(r.nome) === key) ||
    terreniRows.find(
      (r) =>
        normalizeTerrenoKey(r.nome).includes(key) ||
        key.includes(normalizeTerrenoKey(r.nome))
    ) ||
    null
  );
}

function isLavoroAttivoOrProgrammato(stato) {
  const s = String(stato || '').toLowerCase();
  return (
    !s ||
    s === 'in_corso' ||
    s === 'programmato' ||
    s === 'pianificato' ||
    s === 'da_iniziare' ||
    s === 'attivo'
  );
}

/**
 * @param {object} rules
 * @param {Array<object>} terreniRows
 * @param {Array<object>} lavori
 * @param {object|null} sedeCompact
 */
export function buildMeteoConsigli(rules, terreniRows, lavori, sedeCompact) {
  const r = rules || DEFAULT_TONY_METEO_RULES;
  const consigli = [];
  const seen = new Set();

  function pushConsiglio(c) {
    const key = `${c.tipo}|${c.terrenoId || ''}|${c.lavoroId || ''}|${c.esito}|${c.motivo}`;
    if (seen.has(key)) return;
    seen.add(key);
    consigli.push(c);
  }

  if (sedeCompact && sedeCompact.alertsCount > 0) {
    pushConsiglio({
      tipo: 'alert',
      scope: 'sede',
      esito: 'attenzione',
      motivo: sedeCompact.alertBreve
        ? `Alert meteo sede: ${sedeCompact.alertBreve}`
        : 'Alert meteo attivo sulla sede aziendale',
    });
  }

  for (const row of terreniRows || []) {
    if (!row.ok) continue;
    if (row.alertsCount > 0) {
      pushConsiglio({
        tipo: 'alert',
        scope: 'terreno',
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: 'attenzione',
        motivo: `Alert meteo su ${row.nome}`,
      });
    }
    if (row.hasRainSoon) {
      pushConsiglio({
        tipo: 'lavoro',
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: 'attenzione',
        motivo: `Pioggia prevista entro circa un'ora su ${row.nome}`,
      });
    }
    if (row.windSpeedKmh != null && row.windSpeedKmh > r.trattamento.ventoMaxKmh) {
      pushConsiglio({
        tipo: 'trattamento',
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: 'sconsigliato',
        motivo: `Vento ${row.windSpeedKmh} km/h su ${row.nome} (soglia trattamento ${r.trattamento.ventoMaxKmh} km/h)`,
      });
    }
    if (row.popDomani != null && row.popDomani > r.trattamento.popMaxPercent) {
      pushConsiglio({
        tipo: 'trattamento',
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        esito: 'sconsigliato',
        motivo: `Domani pioggia probabile al ${row.popDomani}% su ${row.nome}`,
      });
    }
  }

  for (const lavoro of lavori || []) {
    if (!isLavoroAttivoOrProgrammato(lavoro.stato)) continue;
    const row = matchTerrenoMeteoRow(terreniRows, lavoro);
    if (!row || !row.ok) continue;
    const nomeLavoro = lavoro.nome || lavoro.tipoLavoro || 'Lavoro';
    if (row.hasRainSoon) {
      pushConsiglio({
        tipo: 'lavoro',
        terrenoId: row.terrenoId,
        terrenoNome: row.nome,
        lavoroId: lavoro.id,
        lavoroNome: nomeLavoro,
        esito: 'attenzione',
        motivo: `Pioggia imminente sul campo di «${nomeLavoro}» (${row.nome})`,
      });
    }
  }

  return consigli.slice(0, 25);
}

/**
 * Messaggio proattivo breve per dashboard (max 3 punti).
 * @param {Array<object>} consigli
 */
export function formatMeteoConsigliProactive(consigli) {
  const list = Array.isArray(consigli) ? consigli : [];
  if (!list.length) return '';

  const priority = { sconsigliato: 0, attenzione: 1 };
  const sorted = list.slice().sort((a, b) => {
    const pa = priority[a.esito] != null ? priority[a.esito] : 2;
    const pb = priority[b.esito] != null ? priority[b.esito] : 2;
    return pa - pb;
  });

  const top = sorted.slice(0, 3).map((c) => c.motivo).filter(Boolean);
  if (!top.length) return '';
  return `Meteo operativo: ${top.join('. ')}. Vuoi aprire il modulo Meteo o approfondire in chat?`;
}
