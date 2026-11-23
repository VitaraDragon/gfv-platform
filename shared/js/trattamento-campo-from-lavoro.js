/**
 * Trattamento su collezione piatta (seminativo / orticole) creato dal lavoro,
 * stesso aggancio di createTrattamentoFromLavoro di vigneto/frutteto:
 * lavoroId, data, miscela → prodotti, niente scarico magazzino qui.
 *
 * @module shared/js/trattamento-campo-from-lavoro
 */

import { TIPO_LAVORO_CATEGORIA_CODICE } from '../../core/config/app-catalog-seed-data.js';
import { inferTipoTrattamentoColturaFromTipoLavoroNome } from '../../core/config/trattamenti-lavoro-defaults.js';
import {
  applicaCostiDaAnagrafica,
  righeSenzaCampiVuoti,
  righeTrattamentoDaMiscela,
  trattamentoHaSoloRigaVuota
} from './registro-trattamenti.js';
import { operatoreDaLavoro } from './registro-operatore.js';

const CODICI_TRATTAMENTI = ['trattamenti', 'concimazione'];

function simCodiceCategoria(tipoLavoroNome) {
  if (!tipoLavoroNome) return null;
  const direct = TIPO_LAVORO_CATEGORIA_CODICE[tipoLavoroNome];
  if (direct && CODICI_TRATTAMENTI.includes(direct)) return direct;
  const lower = String(tipoLavoroNome).toLowerCase().trim();
  for (const [nome, cod] of Object.entries(TIPO_LAVORO_CATEGORIA_CODICE)) {
    if (nome.toLowerCase() === lower && CODICI_TRATTAMENTI.includes(cod)) return cod;
  }
  return null;
}

/**
 * @param {string} tipoLavoroNome
 * @returns {Promise<boolean>}
 */
export async function isTipoLavoroCategoriaTrattamentiCampo(tipoLavoroNome) {
  try {
    if (!tipoLavoroNome) return false;
    const { getTipoLavoroByNome } = await import('../../core/services/tipi-lavoro-service.js');
    const { getCategoria } = await import('../../core/services/categorie-service.js');
    const tipo = await getTipoLavoroByNome(tipoLavoroNome);
    if (!tipo || !tipo.categoriaId) return !!simCodiceCategoria(tipoLavoroNome);
    let cat = await getCategoria(tipo.categoriaId);
    if (!cat) return !!simCodiceCategoria(tipoLavoroNome);
    if (cat.parentId) {
      cat = await getCategoria(cat.parentId);
      if (!cat) return !!simCodiceCategoria(tipoLavoroNome);
    }
    const cod = String(cat.codice || '').toLowerCase();
    if (CODICI_TRATTAMENTI.includes(cod)) return true;
    return !!simCodiceCategoria(tipoLavoroNome);
  } catch (_) {
    return !!simCodiceCategoria(tipoLavoroNome);
  }
}

async function caricaAnagraficaProdotti(logPrefix) {
  try {
    const { getAllProdotti } = await import('../../modules/magazzino/services/prodotti-service.js');
    return (await getAllProdotti({ soloAttivi: true })) || [];
  } catch (error) {
    console.warn(`[${logPrefix}] anagrafica prodotti non disponibile:`, error);
    return [];
  }
}

function dataLavoro(lavoro) {
  const raw = lavoro && (lavoro.dataInizio || lavoro.data);
  if (!raw) return new Date();
  if (raw instanceof Date) return raw;
  if (raw && typeof raw.toDate === 'function') return raw.toDate();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dataIso(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value && typeof value.toDate === 'function'
    ? value.toDate()
    : (value instanceof Date ? value : new Date(value));
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * @param {object} opts
 * @param {string} opts.collectionName
 * @param {string} opts.lavoroId
 * @param {string} opts.tenantId
 * @param {(docs: object[]) => object[]} [opts.mapDocs]
 * @returns {Promise<{ trattamentoId: string, campagnaId: string|null, trattamento: object }|null>}
 */
export async function findTrattamentoCampoByLavoroId(opts) {
  const { collectionName, lavoroId, tenantId, mapDocs } = opts;
  if (!tenantId || !lavoroId) return null;
  const { getCollectionData } = await import('../../core/services/firebase-service.js');
  let docs = [];
  try {
    docs = await getCollectionData(collectionName, {
      tenantId,
      where: [['lavoroId', '==', lavoroId]]
    });
  } catch (_) {
    const all = await getCollectionData(collectionName, { tenantId });
    docs = (all || []).filter((d) => d && String(d.lavoroId) === String(lavoroId));
  }
  const list = typeof mapDocs === 'function' ? mapDocs(docs || []) : (docs || []);
  const found = list[0];
  if (!found || !found.id) return null;
  return {
    trattamentoId: found.id,
    campagnaId: found.campagnaId || null,
    trattamento: found
  };
}

/**
 * @param {object} opts
 * @param {string} opts.collectionName
 * @param {string} opts.logPrefix
 * @param {string} opts.lavoroId
 * @param {string} opts.tenantId
 * @param {() => Promise<object[]>} opts.loadCampagne
 * @param {(label: string) => ({ inizio: string, fine: string }|null)} opts.intervalloCampagna
 * @param {new (data: object) => { toFirestore: () => object, id?: string|null }} opts.Model
 * @param {(docs: object[]) => object[]} [opts.mapDocs]
 * @returns {Promise<string|null>}
 */
export async function createTrattamentoCampoFromLavoro(opts) {
  const {
    collectionName,
    logPrefix,
    lavoroId,
    tenantId,
    loadCampagne,
    intervalloCampagna,
    Model,
    mapDocs
  } = opts;
  if (!tenantId || !lavoroId) return null;

  const { getLavoro } = await import('../../core/services/lavori-service.js');
  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) return null;
  if (!(await isTipoLavoroCategoriaTrattamentiCampo(lavoro.tipoLavoro || ''))) return null;
  if (!lavoro.terrenoId) return null;

  const esistente = await findTrattamentoCampoByLavoroId({
    collectionName,
    lavoroId,
    tenantId,
    mapDocs
  });
  if (esistente) {
    await syncTrattamentoCampoFromLavoro({
      collectionName,
      logPrefix,
      lavoroId,
      tenantId,
      Model,
      mapDocs,
      found: esistente
    });
    return esistente.trattamentoId;
  }

  const dataTrattamento = dataLavoro(lavoro);
  const iso = dataIso(dataTrattamento);
  const campagne = await loadCampagne();
  const campagna = (campagne || []).find((c) => {
    if (String(c.terrenoId || '') !== String(lavoro.terrenoId)) return false;
    const range = intervalloCampagna(c.campagna);
    return !!(range && iso && iso >= range.inizio && iso <= range.fine);
  });
  if (!campagna || !campagna.id) {
    console.info(`[${logPrefix}] createFromLavoro: nessuna campagna per terreno/data`, lavoro.terrenoId, iso);
    return null;
  }

  const { getTerreno } = await import('../../core/services/terreni-service.js');
  const terreno = await getTerreno(lavoro.terrenoId);
  const superficieTrattata = terreno && terreno.superficie ? parseFloat(terreno.superficie) : null;
  const operatore = operatoreDaLavoro(lavoro) || '';

  const trattamentoData = {
    campagnaId: campagna.id,
    terrenoId: lavoro.terrenoId,
    lavoroId,
    data: iso || dataTrattamento,
    tipoLavoro: String(lavoro.tipoLavoro || '').trim(),
    tipoTrattamento: inferTipoTrattamentoColturaFromTipoLavoroNome(lavoro.tipoLavoro || ''),
    prodotti: [],
    operatore,
    superficieTrattata: Number.isFinite(superficieTrattata) ? superficieTrattata : null,
    superficieDaAnagrafeTerreno: Number.isFinite(superficieTrattata),
    costoProdotto: 0,
    note: `Trattamento creato da lavoro: ${lavoro.nome || lavoroId}`
  };
  if (trattamentoData.superficieTrattata == null) delete trattamentoData.superficieTrattata;

  const daMiscela = righeTrattamentoDaMiscela(lavoro.miscelaPrevista, trattamentoData.superficieTrattata);
  if (daMiscela.prodotti.length) {
    const conCosti = applicaCostiDaAnagrafica(daMiscela.prodotti, await caricaAnagraficaProdotti(logPrefix));
    trattamentoData.prodotti = righeSenzaCampiVuoti(conCosti.prodotti);
    trattamentoData.costoProdotto = conCosti.costoProdotto;
    trattamentoData.acquaEttolitriPerEttaro = daMiscela.acquaEttolitriPerEttaro;
    trattamentoData.acquaEttolitriTotali = daMiscela.acquaEttolitriTotali;
  }

  const { createDocument } = await import('../../core/services/firebase-service.js');
  // Bypass validate (prodotti obbligatori solo al Completa nel form): come vigneto/frutteto.
  const payload = new Model(trattamentoData).toFirestore();
  return createDocument(collectionName, payload, tenantId);
}

/**
 * @param {object} opts
 * @returns {Promise<string|null>}
 */
export async function syncTrattamentoCampoFromLavoro(opts) {
  const {
    collectionName,
    logPrefix,
    lavoroId,
    tenantId,
    Model,
    mapDocs,
    found: foundIn
  } = opts;
  if (!tenantId || !lavoroId) return null;

  const found = foundIn || await findTrattamentoCampoByLavoroId({
    collectionName,
    lavoroId,
    tenantId,
    mapDocs
  });
  if (!found) return null;

  const { getLavoro } = await import('../../core/services/lavori-service.js');
  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) return null;

  const dataTrattamento = dataLavoro(lavoro);
  const iso = dataIso(dataTrattamento);
  const operatore = operatoreDaLavoro(lavoro) || '';
  const updates = {
    data: iso || dataTrattamento,
    operatore,
    tipoLavoro: String(lavoro.tipoLavoro || '').trim() || (found.trattamento.tipoLavoro || '')
  };

  const { getTerreno } = await import('../../core/services/terreni-service.js');
  const terreno = lavoro.terrenoId ? await getTerreno(lavoro.terrenoId) : null;
  const superficieTrattata = terreno && terreno.superficie ? parseFloat(terreno.superficie) : null;
  if (found.trattamento.superficieDaAnagrafeTerreno && Number.isFinite(superficieTrattata)) {
    updates.superficieTrattata = superficieTrattata;
  }
  if (lavoro.terrenoId) updates.terrenoId = lavoro.terrenoId;

  if (trattamentoHaSoloRigaVuota(found.trattamento) && lavoro.miscelaPrevista) {
    const supRighe = updates.superficieTrattata != null
      ? updates.superficieTrattata
      : found.trattamento.superficieTrattata;
    const daMiscela = righeTrattamentoDaMiscela(
      lavoro.miscelaPrevista,
      Number.isFinite(supRighe) ? supRighe : superficieTrattata
    );
    if (daMiscela.prodotti.length) {
      const conCosti = applicaCostiDaAnagrafica(daMiscela.prodotti, await caricaAnagraficaProdotti(logPrefix));
      updates.prodotti = conCosti.prodotti;
      updates.costoProdotto = conCosti.costoProdotto;
      if (found.trattamento.acquaEttolitriPerEttaro == null) {
        updates.acquaEttolitriPerEttaro = daMiscela.acquaEttolitriPerEttaro;
      }
      if (found.trattamento.acquaEttolitriTotali == null) {
        updates.acquaEttolitriTotali = daMiscela.acquaEttolitriTotali;
      }
    }
  }

  const merged = new Model({ ...found.trattamento, ...updates, id: found.trattamentoId });
  const { updateDocument } = await import('../../core/services/firebase-service.js');
  await updateDocument(collectionName, found.trattamentoId, merged.toFirestore(), tenantId);
  return found.trattamentoId;
}
