/**
 * Costi campagna seminativo da lavori completati e diario, come il dettaglio spese del vigneto.
 * @module modules/seminativo/services/seminativo-spese-service
 */

import { getAllAttivita } from '../../../core/services/attivita-service.js';
import { getAllLavori } from '../../../core/services/lavori-service.js';
import { dataIsoLavorazione } from '../models/SeminativoLavorazione.js';
import { dettaglioSpeseCampagna, intervalloCampagna } from '../models/SeminativoSpese.js';
import { getAllTrattamentiSeminativo } from './trattamenti-service.js';

export { dettaglioSpeseCampagna, intervalloCampagna };

function dataUtile(value) {
  return dataIsoLavorazione(value);
}

async function costoMacchineDiario(attivita) {
  let hasParco = false;
  try {
    const { hasModuleAccess } = await import('../../../core/services/tenant-service.js');
    hasParco = await hasModuleAccess('parcoMacchine');
  } catch (err) {
    hasParco = false;
  }
  if (!hasParco) return attivita.map((att) => ({ ...att, costoMacchine: 0 }));

  const { getMacchina } = await import('../../parco-macchine/services/macchine-service.js');
  const cache = {};
  async function costoOra(id) {
    if (!id) return 0;
    if (!Object.prototype.hasOwnProperty.call(cache, id)) {
      try {
        const macchina = await getMacchina(id);
        cache[id] = macchina && macchina.costoOra ? Number(macchina.costoOra) : 0;
      } catch (err) {
        cache[id] = 0;
      }
    }
    return cache[id];
  }

  const out = [];
  for (const att of attivita) {
    const ore = Number(att.oreMacchina) || 0;
    let costoMacchine = 0;
    if (ore > 0) {
      costoMacchine += ore * await costoOra(att.macchinaId);
      if (att.attrezzoId && att.attrezzoId !== att.macchinaId) {
        costoMacchine += ore * await costoOra(att.attrezzoId);
      }
    }
    out.push({ ...att, costoMacchine });
  }
  return out;
}

async function conCostiLavori(lavori) {
  const { calcolaCostiLavoro } = await import('../../vigneto/services/lavori-vigneto-service.js');
  const out = [];
  for (const lavoro of lavori) {
    const costi = await calcolaCostiLavoro(lavoro.id, lavoro);
    out.push({
      ...lavoro,
      costoManodopera: costi.costoManodopera || 0,
      costoMacchine: costi.costoMacchine || 0
    });
  }
  return out;
}

async function conCostiDiario(attivita) {
  const { getTariffaProprietario } = await import('../../../core/services/calcolo-compensi-service.js');
  const { getCurrentTenantId } = await import('../../../core/services/tenant-service.js');
  let tariffa = 0;
  try {
    const tenantId = getCurrentTenantId();
    tariffa = tenantId ? await getTariffaProprietario(tenantId) : 0;
  } catch (err) {
    tariffa = 0;
  }
  const conMacchine = await costoMacchineDiario(attivita);
  return conMacchine.map((att) => ({
    ...att,
    costoManodopera: (Number(att.oreNette) || 0) * tariffa
  }));
}

/**
 * @param {Array<{ id: string, terrenoId: string, campagna: string }>} campagne
 * @returns {Promise<Record<string, Object>>}
 */
export async function spesePerCampagne(campagne) {
  const vuoto = {};
  (campagne || []).forEach((campagna) => {
    vuoto[campagna.id] = dettaglioSpeseCampagna({
      terrenoId: campagna.terrenoId,
      campagna: campagna.campagna,
      campagnaId: campagna.id
    });
  });

  let lavori = [];
  let attivita = [];
  let prodotti = [];
  try {
    [lavori, attivita, prodotti] = await Promise.all([
      getAllLavori().catch(() => []),
      getAllAttivita().catch(() => []),
      getAllTrattamentiSeminativo().catch(() => [])
    ]);
  } catch (err) {
    console.warn('[seminativo] spese campagne:', err && err.message);
    return vuoto;
  }

  const ranges = (campagne || []).map((campagna) => ({
    terrenoId: String(campagna.terrenoId || ''),
    intervallo: intervalloCampagna(campagna.campagna)
  })).filter((row) => row.terrenoId && row.intervallo);

  const nelPeriodo = (terrenoId, data) => ranges.some((row) => (
    row.terrenoId === String(terrenoId || '')
    && data
    && data >= row.intervallo.inizio
    && data <= row.intervallo.fine
  ));

  const lavoriUtili = (lavori || []).filter((lavoro) => (
    lavoro
    && lavoro.stato === 'completato'
    && nelPeriodo(lavoro.terrenoId, dataUtile(lavoro.dataInizio || lavoro.data))
  ));
  const attivitaUtili = (attivita || []).filter((att) => (
    att
    && !att.lavoroId
    && !att.clienteId
    && nelPeriodo(att.terrenoId, dataUtile(att.data))
  ));

  let lavoriCosto = lavoriUtili.map((lavoro) => ({ ...lavoro, costoManodopera: 0, costoMacchine: 0 }));
  let attivitaCosto = attivitaUtili.map((att) => ({ ...att, costoManodopera: 0, costoMacchine: 0 }));
  try {
    [lavoriCosto, attivitaCosto] = await Promise.all([
      conCostiLavori(lavoriUtili),
      conCostiDiario(attivitaUtili)
    ]);
  } catch (err) {
    console.warn('[seminativo] calcolo costi:', err && err.message);
  }

  const byId = {};
  (campagne || []).forEach((campagna) => {
    byId[campagna.id] = dettaglioSpeseCampagna({
      terrenoId: campagna.terrenoId,
      campagna: campagna.campagna,
      campagnaId: campagna.id,
      lavori: lavoriCosto,
      attivita: attivitaCosto,
      prodotti
    });
  });
  return byId;
}
