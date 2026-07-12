/**
 * Helper piano stagione — filtro vigneti clienti CT e raggruppamento per cliente
 * @module modules/vendemmia-meccanica/services/piano-stagione-utils
 */

import { COLTURE_PREDEFINITE } from '../../../core/config/app-catalog-seed-data.js';

const VITE_COLTURA_NAMES = new Set(
  COLTURE_PREDEFINITE.filter((c) => c.categoriaCodice === 'vite').map((c) => c.nome.toLowerCase())
);

const FRUTTETO_COLTURA_NAMES = new Set(
  COLTURE_PREDEFINITE.filter((c) => c.categoriaCodice === 'frutteto').map((c) => c.nome.toLowerCase())
);

function normColturaText(value) {
  return String(value || '').trim().toLowerCase();
}

function getTerrenoFields(terreno) {
  const raw = (terreno && terreno._originalData) || terreno || {};
  return {
    raw,
    colturaCategoria: raw.colturaCategoria || terreno.colturaCategoria || null,
    colturaSottocategoria: raw.colturaSottocategoria || terreno.colturaSottocategoria || null,
    coltura: raw.coltura || terreno.coltura || null,
    tipoPalo: raw.tipoPalo || terreno.tipoPalo || null,
    sestoImpianto: raw.sestoImpianto || terreno.sestoImpianto || null,
    vendemmiaMeccanica: raw.vendemmiaMeccanica || terreno.vendemmiaMeccanica || null,
    categoriaNomiById: null
  };
}

async function resolveCategoryIdsByCodice(codices) {
  const want = new Set(codices.map((c) => String(c).toLowerCase()));
  const ids = new Set();
  try {
    const { getAllCategorie } = await import('../../../core/services/categorie-service.js');
    const cats = await getAllCategorie({ applicabileA: 'colture' });
    (Array.isArray(cats) ? cats : []).forEach((c) => {
      const codice = normColturaText(c.codice);
      if (want.has(codice) && c.id) ids.add(String(c.id));
    });
  } catch (err) {
    console.warn('[VM piano] resolveCategoryIdsByCodice:', err.message);
  }
  return ids;
}

async function resolveColtureNamesForCategories(categoryIds) {
  const names = new Set();
  if (!categoryIds || categoryIds.size === 0) return names;
  try {
    const { getAllColture } = await import('../../../core/services/colture-service.js');
    const colture = await getAllColture();
    (Array.isArray(colture) ? colture : []).forEach((c) => {
      if (c.categoriaId && categoryIds.has(String(c.categoriaId)) && c.nome) {
        names.add(normColturaText(c.nome));
      }
    });
  } catch (err) {
    console.warn('[VM piano] resolveColtureNamesForCategories:', err.message);
  }
  return names;
}

async function resolveCategoriaNomiById() {
  const map = new Map();
  try {
    const { getAllCategorie } = await import('../../../core/services/categorie-service.js');
    const cats = await getAllCategorie({ applicabileA: 'colture' });
    (Array.isArray(cats) ? cats : []).forEach((c) => {
      if (c.id) map.set(String(c.id), normColturaText(c.nome));
    });
  } catch (err) {
    console.warn('[VM piano] resolveCategoriaNomiById:', err.message);
  }
  return map;
}

/**
 * Contesto di detection vigneto/frutteto (cache lato pagina).
 * @returns {Promise<{ viteCategoryIds: Set<string>, fruttetoCategoryIds: Set<string>, viteColtureNames: Set<string>, fruttetoColtureNames: Set<string>, categoriaNomiById: Map<string,string> }>}
 */
export async function buildVignetoDetectionContext() {
  const [viteCategoryIds, fruttetoCategoryIds, categoriaNomiById] = await Promise.all([
    resolveCategoryIdsByCodice(['vite']),
    resolveCategoryIdsByCodice(['frutteto']),
    resolveCategoriaNomiById()
  ]);

  const [viteFromDb, fruttetoFromDb] = await Promise.all([
    resolveColtureNamesForCategories(viteCategoryIds),
    resolveColtureNamesForCategories(fruttetoCategoryIds)
  ]);

  const viteColtureNames = new Set([...VITE_COLTURA_NAMES, ...viteFromDb]);
  const fruttetoColtureNames = new Set([...FRUTTETO_COLTURA_NAMES, ...fruttetoFromDb]);

  return {
    viteCategoryIds,
    fruttetoCategoryIds,
    viteColtureNames,
    fruttetoColtureNames,
    categoriaNomiById
  };
}

/** @deprecated usa buildVignetoDetectionContext */
export async function resolveViteCategoryIds() {
  const ctx = await buildVignetoDetectionContext();
  return ctx.viteCategoryIds;
}

function colturaTestoIndicaVigneto(coltura, colturaSottocategoria, viteColtureNames) {
  const texts = [colturaSottocategoria, coltura].map(normColturaText).filter(Boolean);
  for (const t of texts) {
    if (viteColtureNames && viteColtureNames.has(t)) return true;
    if (t === 'vite' || t.includes('vite') || t.includes('vigneto') || /\buva\b/.test(t)) return true;
  }
  return false;
}

function colturaTestoIndicaFrutteto(coltura, colturaSottocategoria, fruttetoColtureNames) {
  const texts = [colturaSottocategoria, coltura].map(normColturaText).filter(Boolean);
  for (const t of texts) {
    if (fruttetoColtureNames && fruttetoColtureNames.has(t)) return true;
    if (/\b(frutteto|frutta|melo|pero|pesco|albicocco|ciliegio|actinidia|kiwi)\b/.test(t)) return true;
  }
  return false;
}

function categoriaIdIndica(ctx, categoryId, codice) {
  if (!categoryId || !ctx) return false;
  const id = String(categoryId);
  const set = codice === 'vite' ? ctx.viteCategoryIds : ctx.fruttetoCategoryIds;
  if (set && set.has(id)) return true;
  const nome = ctx.categoriaNomiById && ctx.categoriaNomiById.get(id);
  if (!nome) return false;
  if (codice === 'vite') return nome.includes('vite') || nome.includes('vigneto');
  if (codice === 'frutteto') return nome.includes('frutteto') || nome.includes('frutta');
  return false;
}

function hasVmTerrenoFields(tipoPalo, sestoImpianto) {
  if (tipoPalo && String(tipoPalo).trim()) return true;
  if (sestoImpianto && typeof sestoImpianto === 'object') {
    if (Number(sestoImpianto.distanzaFile) > 0 || Number(sestoImpianto.distanzaCeppo) > 0) return true;
  }
  return false;
}

/**
 * Terreno cliente di frutteto (escluso da VM).
 * @param {Object} terreno
 * @param {Object} [ctx] — buildVignetoDetectionContext()
 */
export function isTerrenoFruttetoCliente(terreno, ctx = {}) {
  if (!terreno || typeof terreno !== 'object') return false;
  const f = getTerrenoFields(terreno);
  const fruttetoNames = ctx.fruttetoColtureNames || FRUTTETO_COLTURA_NAMES;

  if (categoriaIdIndica(ctx, f.colturaCategoria, 'frutteto')) return true;
  return colturaTestoIndicaFrutteto(f.coltura, f.colturaSottocategoria, fruttetoNames);
}

/**
 * Terreno cliente idoneo alla vendemmia meccanica (solo vigneti).
 * @param {Object} terreno
 * @param {Object} [ctx] — buildVignetoDetectionContext()
 */
export function isTerrenoVignetoCliente(terreno, ctx = {}) {
  if (!terreno || typeof terreno !== 'object') return false;
  if (isTerrenoFruttetoCliente(terreno, ctx)) return false;

  const f = getTerrenoFields(terreno);
  const viteNames = ctx.viteColtureNames || VITE_COLTURA_NAMES;

  if (categoriaIdIndica(ctx, f.colturaCategoria, 'vite')) return true;
  if (colturaTestoIndicaVigneto(f.coltura, f.colturaSottocategoria, viteNames)) return true;

  if (hasVmTerrenoFields(f.tipoPalo, f.sestoImpianto)) return true;

  const vm = f.vendemmiaMeccanica;
  if (vm && typeof vm === 'object' && Object.keys(vm).length > 0) return true;

  return false;
}

/**
 * Filtra righe piano stagione ai soli vigneti cliente.
 */
export function filterRigheVigneto(rows, ctx = {}) {
  return (Array.isArray(rows) ? rows : []).filter((r) => isTerrenoVignetoCliente(r, ctx));
}

/**
 * Raggruppa vigneti per cliente.
 */
export function groupClientiVignetoPiano(rows, ctx = {}) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!isTerrenoVignetoCliente(row, ctx)) return;
    const clienteId = row.clienteId;
    if (!clienteId) return;

    let g = map.get(clienteId);
    if (!g) {
      g = {
        clienteId,
        clienteNome: row.clienteNome || '',
        terreniVigneto: 0,
        terreniInPiano: 0,
        ettariInPiano: 0
      };
      map.set(clienteId, g);
    }

    g.terreniVigneto += 1;
    if (row.inPiano) {
      g.terreniInPiano += 1;
      g.ettariInPiano += Number(row.ettariEffettivi) || 0;
    }
  });

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      ettariInPiano: Math.round(g.ettariInPiano * 100) / 100,
      inPiano: g.terreniInPiano > 0
    }))
    .sort((a, b) => (a.clienteNome || '').localeCompare(b.clienteNome || '', 'it'));
}

/**
 * Deep-link Gestione Lavori CT (apre dettaglio se lavoroId presente).
 * @param {string|null|undefined} lavoroId
 * @returns {string}
 */
export function buildGestioneLavoriUrl(lavoroId) {
  const q = new URLSearchParams({ contoTerzi: 'true' });
  if (lavoroId) q.set('lavoroId', String(lavoroId));
  return '../../../core/admin/gestione-lavori-standalone.html?' + q.toString();
}

/**
 * Link lista preventivi CT con evidenza opzionale preventivo / filtro cliente.
 * @param {string|null|undefined} preventivoId
 * @param {string|null|undefined} [clienteId]
 * @returns {string}
 */
export function buildPreventiviCtUrl(preventivoId, clienteId) {
  const q = new URLSearchParams();
  if (preventivoId) q.set('preventivoId', String(preventivoId));
  if (clienteId) q.set('clienteId', String(clienteId));
  const qs = q.toString();
  return '../../conto-terzi/views/preventivi-standalone.html' + (qs ? '?' + qs : '');
}

/**
 * Calcolatore VM con cliente, terreni e deep-link opzionali.
 * @param {string|null|undefined} clienteId
 * @param {string|null|undefined} [terrenoId]
 * @param {{ lavoroId?: string|null, calcoloId?: string|null, terrenoIds?: string[]|string, basePath?: string }} [options]
 * @returns {string}
 */
export function buildCalcolatoreVmUrl(clienteId, terrenoId, options = {}) {
  const q = new URLSearchParams();
  if (clienteId) q.set('clienteId', String(clienteId));
  if (terrenoId) q.set('terrenoId', String(terrenoId));
  if (options.lavoroId) q.set('lavoroId', String(options.lavoroId));
  if (options.calcoloId) q.set('calcoloId', String(options.calcoloId));
  if (!terrenoId && options.terrenoIds) {
    const ids = Array.isArray(options.terrenoIds) ? options.terrenoIds : String(options.terrenoIds).split(',');
    const clean = ids.map((id) => String(id || '').trim()).filter(Boolean);
    if (clean.length) q.set('terrenoIds', clean.join(','));
  }
  const qs = q.toString();
  const base = options.basePath || 'calcolatore-standalone.html';
  return base + (qs ? '?' + qs : '');
}

/** Path calcolatore da core/admin (Gestione Lavori). */
export const CALCOLATORE_VM_ADMIN_BASE = '../../modules/vendemmia-meccanica/views/calcolatore-standalone.html';

/**
 * Deep-link calcolatore precompilato da lavoro VM.
 * @param {Object|null|undefined} lavoro
 * @param {{ basePath?: string }} [options]
 * @returns {string}
 */
export function buildCalcolatoreVmUrlFromLavoro(lavoro, options = {}) {
  if (!lavoro) return buildCalcolatoreVmUrl(null, null, options);
  return buildCalcolatoreVmUrl(lavoro.clienteId || null, lavoro.terrenoId || null, {
    ...options,
    lavoroId: lavoro.id || null
  });
}

/**
 * Vigneto con metriche vendemmia (lavoro, zone o ha netti) già registrate.
 * @param {Object} row — riga getPianoStagioneRows
 * @returns {boolean}
 */
export function rowHasVendemmiaDati(row) {
  if (!row || typeof row !== 'object') return false;
  const s = row.stato || {};
  if (row.lavoroId) return true;
  if ((row.zoneVendemmiateCount || 0) > 0) return true;
  if ((row.zoneEscluseCount || 0) > 0) return true;
  if (Number(s.ettariEsclusi) > 0) return true;
  if (s.ettariVendemmiatiManuali != null && Number.isFinite(Number(s.ettariVendemmiatiManuali))) return true;
  const sup = Number(row.superficie) || 0;
  const netti = Number(s.ettariVendemmiati);
  if (Number.isFinite(netti) && netti > 0 && sup > 0 && Math.abs(netti - sup) > 0.001) return true;
  return false;
}

export default {
  buildVignetoDetectionContext,
  resolveViteCategoryIds,
  isTerrenoFruttetoCliente,
  isTerrenoVignetoCliente,
  filterRigheVigneto,
  groupClientiVignetoPiano,
  buildGestioneLavoriUrl,
  buildPreventiviCtUrl,
  buildCalcolatoreVmUrl,
  buildCalcolatoreVmUrlFromLavoro,
  CALCOLATORE_VM_ADMIN_BASE,
  rowHasVendemmiaDati
};
