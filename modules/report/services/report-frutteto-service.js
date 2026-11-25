/**
 * Report Frutteto — caricamento fonti + assemblaggio.
 * Solo lettura: frutteti, raccolte, aggregaSpeseFruttetoPeriodo.
 *
 * @module modules/report/services/report-frutteto-service
 */

import { getCurrentTenantId, getCurrentTenant } from '../../../core/services/tenant-service.js';
import { resolveEffectiveModules } from '../../../core/utils/module-access-resolver.js';
import {
  formatLocalIsoDate,
  inRange,
  dataIsoFromAny,
  euro
} from './report-economici-aggregate.js';
import {
  assembleFruttetoReport,
  prepareFruttetoExportData,
  isFruttetoDataReady,
  buildFruttetoDetailRows,
  formatEuroPrefixCompact
} from './report-frutteto-aggregate.js';

/** @type {{ key: string, data: object }|null} */
let periodBundleCache = null;

function periodKey(start, end) {
  return `${formatLocalIsoDate(start)}|${formatLocalIsoDate(end)}`;
}

function timePhase(timings, name, ms) {
  timings[name] = Math.round(ms);
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[report-frutteto] ${name}: ${Math.round(ms)} ms`);
  }
}

/**
 * Anni solari coperti dall’intervallo (per caricamento raccolte per anno).
 * @param {Date} start
 * @param {Date} end
 * @returns {number[]}
 */
export function calendarYearsInRange(start, end) {
  const y0 = start.getFullYear();
  const y1 = end.getFullYear();
  const out = [];
  for (let y = y0; y <= y1; y += 1) out.push(y);
  return out;
}

/**
 * @param {object} macchina
 * @returns {boolean} true se manca costo orario
 */
function macchinaMissingCostoOra(macchina) {
  if (!macchina) return false;
  const costo = macchina.costoOra != null ? Number(macchina.costoOra) : null;
  return !(costo != null && !Number.isNaN(costo) && costo > 0);
}

/**
 * Carica bundle periodo: frutteti, raccolte in range, spese filtrate sul periodo.
 * @param {Date} start
 * @param {Date} end
 * @param {{ forceReload?: boolean }} [opts]
 */
export async function loadFruttetoPeriodBundle(start, end, opts = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant non disponibile');

  const key = periodKey(start, end);
  if (!opts.forceReload && periodBundleCache && periodBundleCache.key === key) {
    return periodBundleCache.data;
  }

  const timings = {};
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const tenant = await getCurrentTenant().catch(() => null);
  const mods = new Set((resolveEffectiveModules(tenant || {}) || []).map((m) => String(m || '').toLowerCase()));
  if (!mods.has('frutteto')) {
    const empty = {
      frutteti: [],
      raccolte: [],
      speseByFruttetoId: new Map(),
      costiMensili: [],
      undatedNotes: [],
      timings: { skipped: 1 },
      ready: true
    };
    periodBundleCache = { key, data: empty };
    return empty;
  }

  let t0 = now();
  let frutteti = [];
  try {
    const { getAllFrutteti } = await import('../../frutteto/services/frutteti-service.js');
    frutteti = await getAllFrutteti().catch(() => []) || [];
  } catch (e) {
    console.warn('[report-frutteto] frutteti', e && e.message);
    frutteti = [];
  }
  timePhase(timings, 'frutteti', now() - t0);

  t0 = now();
  /** @type {object[]} */
  const raccolte = [];
  try {
    const { getRaccolte } = await import('../../frutteto/services/raccolta-frutta-service.js');
    const years = calendarYearsInRange(start, end);
    await Promise.all(
      (frutteti || []).map(async (f) => {
        if (!f || !f.id) return;
        for (const anno of years) {
          try {
            const list = await getRaccolte(f.id, { anno, orderBy: 'data', orderDirection: 'desc' });
            for (const r of list || []) {
              if (r && inRange(r.data, start, end)) {
                raccolte.push({
                  ...r,
                  fruttetoId: r.fruttetoId || f.id,
                  id: r.id
                });
              }
            }
          } catch (e) {
            console.warn('[report-frutteto] raccolte', f.id, anno, e && e.message);
          }
        }
      })
    );
  } catch (e) {
    console.warn('[report-frutteto] raccolte load', e && e.message);
  }
  timePhase(timings, 'raccolte', now() - t0);

  t0 = now();
  /** @type {Map<string, object>} */
  const speseByFruttetoId = new Map();
  /** @type {Map<string, { costi: number, partial: boolean }>} */
  const costiMensiliMap = new Map();
  /** @type {string[]} */
  const undatedNotes = [];

  let macchineById = new Map();
  try {
    const { getCollectionData } = await import('../../../core/services/firebase-service.js');
    const macs = await getCollectionData('macchine', { tenantId }).catch(() => []) || [];
    macchineById = new Map(macs.filter((m) => m && m.id).map((m) => [String(m.id), m]));
  } catch (_) { /* ignore */ }

  try {
    const {
      aggregaSpeseFruttetoPeriodo,
      getLavoriPerTerreno
    } = await import('../../frutteto/services/lavori-frutteto-service.js');

    await Promise.all(
      (frutteti || []).map(async (f) => {
        if (!f || !f.id) return;
        let missingMacchine = false;

        let spese;
        try {
          spese = await aggregaSpeseFruttetoPeriodo(f.id, start, end);
        } catch (e) {
          console.warn('[report-frutteto] spese periodo', f.id, e && e.message);
          spese = {
            costoTotaleAnno: 0,
            speseManodoperaAnno: 0,
            speseMacchineAnno: 0,
            speseProdottiAnno: 0,
            spesePotaturaAnno: 0,
            speseTrattamentiAnno: 0,
            speseRaccoltaAnno: 0,
            costiMensili: [],
            undatedNotes: []
          };
        }

        for (const n of spese.undatedNotes || []) {
          undatedNotes.push(n);
        }
        for (const m of spese.costiMensili || []) {
          if (!m || !m.ym) continue;
          const prev = costiMensiliMap.get(m.ym) || { costi: 0, partial: false };
          prev.costi += Number(m.costi) || 0;
          costiMensiliMap.set(m.ym, prev);
        }

        // Detection costoOra mancante sui lavori nel periodo (stesso perimetro)
        if (f.terrenoId) {
          try {
            const lavori = await getLavoriPerTerreno(f.terrenoId, { stato: 'completato' });
            /** @type {Set<string>} */
            const seen = new Set();
            for (const lavoro of lavori || []) {
              if (!lavoro || !lavoro.id) continue;
              const lid = String(lavoro.id);
              if (seen.has(lid)) continue;
              seen.add(lid);
              const dataRaw = lavoro.dataInizioRaw || lavoro.dataInizio;
              if (!inRange(dataRaw, start, end)) continue;
              const macIds = Array.isArray(lavoro.macchine) ? lavoro.macchine : [];
              for (const mid of macIds) {
                const id = typeof mid === 'object' && mid ? (mid.id || mid.macchinaId) : mid;
                if (!id) continue;
                const mac = macchineById.get(String(id));
                if (mac && macchinaMissingCostoOra(mac)) {
                  missingMacchine = true;
                  const ym = String(dataIsoFromAny(dataRaw) || '').slice(0, 7);
                  if (/^\d{4}-\d{2}$/.test(ym)) {
                    const prev = costiMensiliMap.get(ym) || { costi: 0, partial: false };
                    prev.partial = true;
                    costiMensiliMap.set(ym, prev);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[report-frutteto] detection macchine', f.id, e && e.message);
          }
        }

        const costoTotale = Number(spese.costoTotaleAnno ?? spese.speseTotaleAnno) || 0;
        const costiMensiliFru = (spese.costiMensili || []).map((m) => ({
          ym: m.ym,
          costi: euro(m.costi),
          partial: false
        }));
        // Propaga partial mesi se macchine senza costoOra
        if (missingMacchine) {
          for (const m of costiMensiliFru) m.partial = true;
        }
        speseByFruttetoId.set(String(f.id), {
          costoTotale: euro(costoTotale) || 0,
          speseManodopera: euro(Number(spese.speseManodoperaAnno) || 0) || 0,
          speseMacchine: missingMacchine ? null : (euro(Number(spese.speseMacchineAnno) || 0) || 0),
          missingMacchine,
          speseProdotti: euro(Number(spese.speseProdottiAnno) || 0) || 0,
          spesePotatura: euro(Number(spese.spesePotaturaAnno) || 0) || 0,
          speseTrattamenti: euro(Number(spese.speseTrattamentiAnno) || 0) || 0,
          speseRaccolta: euro(Number(spese.speseRaccoltaAnno) || 0) || 0,
          partial: missingMacchine,
          costiMensili: costiMensiliFru
        });
      })
    );
  } catch (e) {
    console.warn('[report-frutteto] spese/lavori', e && e.message);
  }
  timePhase(timings, 'spese', now() - t0);

  const costiMensili = [...costiMensiliMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v]) => ({
      ym,
      costi: euro(v.costi),
      partial: !!v.partial
    }));

  const data = {
    frutteti,
    raccolte,
    speseByFruttetoId,
    costiMensili,
    undatedNotes,
    timings,
    ready: true
  };
  periodBundleCache = { key, data };
  return data;
}

/**
 * @param {object} bundle
 * @param {{ fruttetoId?: string|null, specie?: string|null, varieta?: string|null }} [filters]
 */
export function assembleFruttetoFromBundle(bundle, filters = {}) {
  if (!bundle || !bundle.ready) {
    return {
      raccolte: [],
      byFrutteto: [],
      kpi: {
        produzioneQ: 0,
        produzioneKg: 0,
        resaQHa: null,
        scartoPct: null,
        costi: 0,
        partialCosti: false,
        euroPerQ: null,
        ricavi: 0,
        partialRicavi: false,
        ettari: 0,
        nFrutteti: 0,
        nRaccolte: 0
      },
      chartProduzione: [],
      chartMensile: [],
      notes: [],
      empty: true,
      ready: false
    };
  }
  return assembleFruttetoReport({
    frutteti: bundle.frutteti || [],
    raccolte: bundle.raccolte || [],
    speseByFruttetoId: bundle.speseByFruttetoId || new Map(),
    costiMensili: bundle.costiMensili || [],
    undatedNotes: bundle.undatedNotes || []
  }, filters);
}

/**
 * @param {Date} start
 * @param {Date} end
 * @param {{ fruttetoId?: string|null, specie?: string|null, varieta?: string|null, forceReload?: boolean }} [filters]
 */
export async function buildReportFrutteto(start, end, filters = {}) {
  const bundle = await loadFruttetoPeriodBundle(start, end, {
    forceReload: filters.forceReload
  });
  return assembleFruttetoFromBundle(bundle, {
    fruttetoId: filters.fruttetoId,
    specie: filters.specie,
    varieta: filters.varieta
  });
}

/**
 * Opzioni filtri da bundle già caricato.
 * @param {object} bundle
 */
export function getFruttetoFilterOptions(bundle) {
  const frutteti = (bundle && bundle.frutteti) || [];
  const raccolte = (bundle && bundle.raccolte) || [];
  const specie = new Set();
  const varieta = new Set();
  for (const r of raccolte) {
    if (r && r.specie) specie.add(String(r.specie));
    if (r && r.varieta) varieta.add(String(r.varieta));
  }
  for (const f of frutteti) {
    if (f && f.specie) specie.add(String(f.specie));
    if (f && f.varieta) varieta.add(String(f.varieta));
  }
  const fruttetiOpts = frutteti
    .filter((f) => f && f.id)
    .map((f) => ({
      id: String(f.id),
      nome: f.nome || f.specie || f.id
    }))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));

  return {
    frutteti: fruttetiOpts,
    specie: [...specie].sort((a, b) => a.localeCompare(b, 'it')),
    varieta: [...varieta].sort((a, b) => a.localeCompare(b, 'it'))
  };
}

export {
  assembleFruttetoReport,
  prepareFruttetoExportData,
  isFruttetoDataReady,
  buildFruttetoDetailRows,
  formatEuroPrefixCompact
};
