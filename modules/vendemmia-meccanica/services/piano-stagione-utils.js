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

export default {
  buildVignetoDetectionContext,
  resolveViteCategoryIds,
  isTerrenoFruttetoCliente,
  isTerrenoVignetoCliente,
  filterRigheVigneto,
  groupClientiVignetoPiano
};
