/**
 * Piano stagione vendemmia meccanica — lettura/scrittura stato su terreni CT
 * @module modules/vendemmia-meccanica/services/piano-stagione-service
 */

import { getAllTerreni, getTerreno } from '../../../core/services/terreni-service.js';
import { updateDocument } from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { getAllClienti } from '../../conto-terzi/services/clienti-service.js';
import { getAnnoStagioneCorrente } from '../config/vm-constants.js';
import { getEttariEffettivi } from './calcolo-compenso-vm-service.js';
import { buildStagioneWithNetArea, sanitizeZoneEscluse } from './zone-escluse-service.js';

const TERRENI_COLLECTION = 'terreni';
import { summarizePianoStagione } from './piano-stagione-kpi.js';
import { filterRigheVigneto, buildVignetoDetectionContext } from './piano-stagione-utils.js';

export { summarizePianoStagione };

/**
 * @param {number|string} [anno]
 * @param {{ clienteId?: string|null, soloVigneti?: boolean, vignetoCtx?: object }} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function getPianoStagioneRows(anno = getAnnoStagioneCorrente(), options = {}) {
  const annoKey = String(anno);
  const clienti = await getAllClienti({ orderBy: 'ragioneSociale' });
  const clientiMap = Object.fromEntries(clienti.map((c) => [c.id, c]));

  let terreni;
  if (options.clienteId) {
    terreni = await getAllTerreni({ clienteId: options.clienteId, orderBy: 'nome' });
  } else {
    const all = await getAllTerreni({ orderBy: 'nome', includeTerreniClienti: true });
    terreni = all.filter((t) => t.clienteId && String(t.clienteId).trim());
  }

  let rows = terreni.map((t) => {
    const raw = t._originalData || t;
    const vm = raw.vendemmiaMeccanica || t.vendemmiaMeccanica || {};
    const stato = vm[annoKey] || {};
    const cliente = clientiMap[t.clienteId] || clientiMap[raw.clienteId];
    const { ettari, warning } = getEttariEffettivi({ ...raw, ...t, vendemmiaMeccanica: vm }, anno);

    return {
      terrenoId: t.id,
      terrenoNome: t.nome,
      clienteId: t.clienteId || raw.clienteId,
      clienteNome: cliente ? (cliente.ragioneSociale || cliente.nome || '') : '',
      colturaCategoria: t.colturaCategoria || raw.colturaCategoria || null,
      colturaSottocategoria: t.colturaSottocategoria || raw.colturaSottocategoria || null,
      coltura: t.coltura || raw.coltura || null,
      superficie: Number(t.superficie) || 0,
      ettariEffettivi: ettari,
      tipoCampo: t.tipoCampo || raw.tipoCampo || null,
      tipoPalo: t.tipoPalo || raw.tipoPalo || null,
      sestoImpianto: t.sestoImpianto || raw.sestoImpianto || null,
      inPiano: !!stato.inPiano,
      vendemmiato: !!stato.vendemmiato,
      zoneEscluseCount: Array.isArray(stato.zoneEscluse) ? stato.zoneEscluse.length : 0,
      zoneVendemmiateCount: Array.isArray(stato.zoneVendemmiate) ? stato.zoneVendemmiate.length : 0,
      lavoroId: stato.lavoroId || null,
      dataVendemmia: stato.dataVendemmia || null,
      ettariEsclusi: stato.ettariEsclusi != null ? Number(stato.ettariEsclusi) : 0,
      polygonCoords: t.polygonCoords || raw.polygonCoords || null,
      datiVmCompleti: !!(t.tipoCampo || raw.tipoCampo) && !!(t.tipoPalo || raw.tipoPalo) && !!(t.sestoImpianto || raw.sestoImpianto),
      warning: warning || null,
      stato
    };
  });

  if (options.soloVigneti) {
    const vignetoCtx = options.vignetoCtx || (await buildVignetoDetectionContext());
    rows = filterRigheVigneto(rows, vignetoCtx);
  }
  return rows;
}

/**
 * @param {string} terrenoId
 * @param {number|string} anno
 * @param {Object} patch
 * @param {{ mapsApi?: object }} [options]
 */
export async function updateStagioneTerreno(terrenoId, anno, patch, options = {}) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const terreno = await getTerreno(terrenoId);
  if (!terreno) throw new Error('Terreno non trovato');

  const annoKey = String(anno);
  const vm = { ...(terreno.vendemmiaMeccanica || {}) };
  const current = { ...(vm[annoKey] || {}) };
  const normalizedPatch = { ...patch };
  if (Array.isArray(patch.zoneEscluse)) {
    normalizedPatch.zoneEscluse = sanitizeZoneEscluse(patch.zoneEscluse);
  }
  const merged = { ...current, ...normalizedPatch };

  const ettariTotali = Number(terreno.superficie) || 0;
  vm[annoKey] = buildStagioneWithNetArea(merged, ettariTotali, {
    mapsApi: options.mapsApi,
    ettariVendemmiatiManuali: patch.ettariVendemmiatiManuali ?? patch.ettariVendemmiati
  });

  // Aggiornamento parziale: evita riscrittura completa terreno (perdita campi / validazione)
  await updateDocument(TERRENI_COLLECTION, terrenoId, { vendemmiaMeccanica: vm }, tenantId);
  return vm[annoKey];
}

/**
 * Annulla vendemmia da lavoro eliminato: mantiene inPiano, rimuove zone e flag vendemmiato.
 * @param {string} terrenoId
 * @param {number|string} anno
 * @returns {Promise<Object|null>}
 */
export async function revertVendemmiaLavoroInPiano(terrenoId, anno) {
  const tenantId = getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');

  const terreno = await getTerreno(terrenoId);
  if (!terreno) return null;

  const annoKey = String(anno);
  const vm = { ...(terreno.vendemmiaMeccanica || {}) };
  const current = { ...(vm[annoKey] || {}) };
  const ettariTotali = Number(terreno.superficie) || 0;

  const next = {
    ...current,
    vendemmiato: false,
    lavoroId: null,
    dataVendemmia: null,
    zoneVendemmiate: [],
    zoneEscluse: [],
    ettariEsclusi: 0,
    zoneEscluseAutoDaLavoro: false,
    zoneEscluseModificateManualmente: false
  };
  delete next.ettariVendemmiatiManuali;

  vm[annoKey] = buildStagioneWithNetArea(next, ettariTotali, {});
  await updateDocument(TERRENI_COLLECTION, terrenoId, { vendemmiaMeccanica: vm }, tenantId);
  return vm[annoKey];
}

/**
 * Toggle booleano inPiano / vendemmiato.
 */
export async function setFlagStagioneTerreno(terrenoId, anno, flag, value) {
  const allowed = ['inPiano', 'vendemmiato'];
  if (!allowed.includes(flag)) throw new Error('Flag non supportato');
  return updateStagioneTerreno(terrenoId, anno, { [flag]: !!value });
}

/**
 * Imposta inPiano / vendemmiato su più terreni (es. «aggiungi vigneti al piano»).
 * @param {string[]} terrenoIds
 * @param {number|string} anno
 * @param {'inPiano'|'vendemmiato'} flag
 * @param {boolean} value
 */
export async function setBulkFlagStagioneTerreni(terrenoIds, anno, flag, value) {
  const ids = Array.isArray(terrenoIds) ? terrenoIds.filter(Boolean) : [];
  await Promise.all(ids.map((id) => setFlagStagioneTerreno(id, anno, flag, value)));
  return ids.length;
}

export default {
  getPianoStagioneRows,
  summarizePianoStagione,
  updateStagioneTerreno,
  revertVendemmiaLavoroInPiano,
  setFlagStagioneTerreno,
  setBulkFlagStagioneTerreni
};
