/**
 * Delete a cascata di un lavoro — I/O Firestore.
 * Orchestrazione unica (Gestione lavori, eventuale riuso). Nessuna patch per pagina.
 *
 * @module core/services/lavoro-delete-cascade
 */

import {
  getCollectionData,
  getDocumentData,
  deleteDocument,
  updateDocument
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { getCurrentUserData } from './auth-service.js';
import {
  normalizeRelatedLavoroId,
  matchesLavoroId,
  filterDocsByLavoroId,
  comunicazioneRiferisceLavoroInesistente,
  assenzaCascadeAction,
  unlinkPreventivoPatch,
  buildLavoroCascadePlan,
  formatLavoroDeleteBlockedByRipreseMessage,
  collectMagazzinoMovimentoIdsFromTrattamenti,
  mergeMovimentiForCascade
} from './lavoro-delete-cascade-utils.js';

export {
  emptyRelatedCounts,
  relatedDeletableTotal,
  formatLavoroDeleteConfirmMessage,
  formatLavoroDeleteBlockedByRipreseMessage,
  comunicazioneRiferisceLavoroInesistente,
  filterComunicazioniSenzaLavoroMorto,
  buildLavoroCascadePlan,
  matchesLavoroId,
  filterDocsByLavoroId,
  isRipresaFigliaDi,
  assenzaCascadeAction,
  unlinkPreventivoPatch,
  normalizeRelatedLavoroId,
  collectMagazzinoMovimentoIdsFromTrattamenti,
  mergeMovimentiForCascade
} from './lavoro-delete-cascade-utils.js';

const RIPRESE_BLOCKED_CODE = 'LAVORO_HAS_RIPRESE_FIGLIE';

function assertCanDeleteLavoro() {
  const user = getCurrentUserData();
  if (!user) throw new Error('Utente non autenticato');
  const ruoli = Array.isArray(user.ruoli) ? user.ruoli : [];
  if (!ruoli.includes('manager') && !ruoli.includes('amministratore')) {
    throw new Error('Non hai i permessi per eliminare lavori');
  }
  return user;
}

function resolveTenantId(options = {}) {
  const tenantId = options.tenantId || getCurrentTenantId();
  if (!tenantId) throw new Error('Nessun tenant corrente disponibile');
  return tenantId;
}

/**
 * @param {string} collectionName
 * @param {string} lavoroId
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
async function listDocsByLavoroId(collectionName, lavoroId, tenantId) {
  const target = normalizeRelatedLavoroId(lavoroId);
  if (!target) return [];
  const idsToTry = [lavoroId];
  if (target !== String(lavoroId)) idsToTry.push(target);

  // where su lavoroId (campo singolo): se la query riesce, anche vuota, ci fidiamo.
  // Scan completo solo se tutte le query falliscono (es. permesso), senza indici nuovi.
  // Id candidati in parallelo (niente attesa in serie).
  const settled = await Promise.all(idsToTry.map(async (id) => {
    try {
      const docs = await getCollectionData(collectionName, {
        tenantId,
        where: [['lavoroId', '==', id]]
      });
      return { ok: true, docs: Array.isArray(docs) ? docs : [] };
    } catch (err) {
      console.warn('[lavoro-delete-cascade] query', collectionName, err?.message || err);
      return { ok: false };
    }
  }));
  const queryOk = settled.some((r) => r.ok);
  if (queryOk) {
    const byId = new Map();
    settled.forEach((r) => {
      if (!r.ok) return;
      r.docs.forEach((doc) => {
        if (doc && doc.id != null) byId.set(String(doc.id), doc);
      });
    });
    return Array.from(byId.values());
  }
  try {
    const all = await getCollectionData(collectionName, { tenantId });
    return (all || []).filter((d) => matchesLavoroId(d.lavoroId, target));
  } catch (err) {
    console.warn('[lavoro-delete-cascade] scan', collectionName, err?.message || err);
    return [];
  }
}

async function listSubcollection(path, tenantId) {
  try {
    return (await getCollectionData(path, { tenantId })) || [];
  } catch (err) {
    console.warn('[lavoro-delete-cascade] subcollection', path, err?.message || err);
    return [];
  }
}

/**
 * Sotto-collezione coltura: preferisce where lavoroId (campo singolo, senza indice nuovo).
 * Se la query fallisce, listDocsByLavoroId fa già lo scan della sola sotto-collezione.
 * @param {string} path
 * @param {string} lavoroId
 * @param {string} tenantId
 */
async function listCropSubByLavoroId(path, lavoroId, tenantId) {
  return listDocsByLavoroId(path, lavoroId, tenantId);
}

async function listVignetoCropForLavoro(lavoroId, terrenoId, tenantId) {
  const out = { vendemmie: [], potature: [], trattamenti: [], raccolte: [] };
  const { getAllVigneti } = await import('../../modules/vigneto/services/vigneti-service.js');
  const { deleteVendemmia } = await import('../../modules/vigneto/services/vendemmia-service.js');
  const { deletePotatura } = await import('../../modules/vigneto/services/potatura-vigneto-service.js');
  const { deleteTrattamento } = await import('../../modules/vigneto/services/trattamenti-vigneto-service.js');
  const vigneti = await getAllVigneti(terrenoId ? { terrenoId } : {});
  await Promise.all((vigneti || []).map(async (v) => {
    const vid = v.id;
    const [vendemmie, potature, trattamenti] = await Promise.all([
      listCropSubByLavoroId(`vigneti/${vid}/vendemmie`, lavoroId, tenantId),
      listCropSubByLavoroId(`vigneti/${vid}/potature`, lavoroId, tenantId),
      listCropSubByLavoroId(`vigneti/${vid}/trattamenti`, lavoroId, tenantId)
    ]);
    vendemmie.forEach((x) => {
      out.vendemmie.push({
        modulo: 'vigneto',
        parentId: vid,
        id: x.id,
        delete: () => deleteVendemmia(vid, x.id)
      });
    });
    potature.forEach((x) => {
      out.potature.push({
        modulo: 'vigneto',
        parentId: vid,
        id: x.id,
        delete: () => deletePotatura(vid, x.id)
      });
    });
    trattamenti.forEach((x) => {
      out.trattamenti.push({
        modulo: 'vigneto',
        parentId: vid,
        id: x.id,
        magazzinoMovimentoIds: x.magazzinoMovimentoIds || [],
        delete: () => deleteTrattamento(vid, x.id)
      });
    });
  }));
  return out;
}

async function listFruttetoCropForLavoro(lavoroId, terrenoId, tenantId) {
  const out = { vendemmie: [], potature: [], trattamenti: [], raccolte: [] };
  const { getAllFrutteti } = await import('../../modules/frutteto/services/frutteti-service.js');
  const { deletePotatura } = await import('../../modules/frutteto/services/potatura-frutteto-service.js');
  const { deleteTrattamento } = await import('../../modules/frutteto/services/trattamenti-frutteto-service.js');
  const { deleteRaccolta } = await import('../../modules/frutteto/services/raccolta-frutta-service.js');
  const frutteti = await getAllFrutteti(terrenoId ? { terrenoId } : {});
  await Promise.all((frutteti || []).map(async (f) => {
    const fid = f.id;
    const [potature, trattamenti, raccolte] = await Promise.all([
      listCropSubByLavoroId(`frutteti/${fid}/potature`, lavoroId, tenantId),
      listCropSubByLavoroId(`frutteti/${fid}/trattamenti`, lavoroId, tenantId),
      listCropSubByLavoroId(`frutteti/${fid}/raccolte`, lavoroId, tenantId)
    ]);
    potature.forEach((x) => {
      out.potature.push({
        modulo: 'frutteto',
        parentId: fid,
        id: x.id,
        delete: () => deletePotatura(fid, x.id)
      });
    });
    trattamenti.forEach((x) => {
      out.trattamenti.push({
        modulo: 'frutteto',
        parentId: fid,
        id: x.id,
        magazzinoMovimentoIds: x.magazzinoMovimentoIds || [],
        delete: () => deleteTrattamento(fid, x.id)
      });
    });
    raccolte.forEach((x) => {
      out.raccolte.push({
        modulo: 'frutteto',
        parentId: fid,
        id: x.id,
        delete: () => deleteRaccolta(fid, x.id)
      });
    });
  }));
  return out;
}

/**
 * Collezioni piatte: where lavoroId (o scan della sola collezione), senza getAll del modulo.
 */
async function listFlatTrattamentiForLavoro(collectionName, lavoroId, tenantId, modulo, deleteFn) {
  const docs = await listDocsByLavoroId(collectionName, lavoroId, tenantId);
  return docs.map((x) => ({
    modulo,
    parentId: x.campagnaId || null,
    id: x.id,
    magazzinoMovimentoIds: x.magazzinoMovimentoIds || [],
    delete: () => deleteFn(x.id)
  }));
}

/**
 * Stub coltura collegati al lavoro — tutti i match, non solo il primo.
 * Moduli in parallelo; sotto-doc e collezioni piatte per lavoroId (no dump tenant intero a priori).
 * @param {string} lavoroId
 * @param {string|null} terrenoId
 * @param {string} tenantId
 */
async function listCropRecordsForLavoro(lavoroId, terrenoId, tenantId) {
  const out = { vendemmie: [], potature: [], trattamenti: [], raccolte: [] };
  const tid = terrenoId || null;

  const [vigneto, frutteto, seminativo, orticole] = await Promise.all([
    listVignetoCropForLavoro(lavoroId, tid, tenantId).catch((err) => {
      console.warn('[lavoro-delete-cascade] crop vigneto:', err?.message || err);
      return null;
    }),
    listFruttetoCropForLavoro(lavoroId, tid, tenantId).catch((err) => {
      console.warn('[lavoro-delete-cascade] crop frutteto:', err?.message || err);
      return null;
    }),
    (async () => {
      const { deleteTrattamentoSeminativo } = await import('../../modules/seminativo/services/trattamenti-service.js');
      return listFlatTrattamentiForLavoro(
        'trattamentiSeminativo',
        lavoroId,
        tenantId,
        'seminativo',
        deleteTrattamentoSeminativo
      );
    })().catch((err) => {
      console.warn('[lavoro-delete-cascade] crop seminativo:', err?.message || err);
      return [];
    }),
    (async () => {
      const { deleteTrattamentoOrticole } = await import('../../modules/orticole/services/trattamenti-service.js');
      return listFlatTrattamentiForLavoro(
        'trattamentiOrticole',
        lavoroId,
        tenantId,
        'orticole',
        deleteTrattamentoOrticole
      );
    })().catch((err) => {
      console.warn('[lavoro-delete-cascade] crop orticole:', err?.message || err);
      return [];
    })
  ]);

  [vigneto, frutteto].forEach((block) => {
    if (!block) return;
    out.vendemmie.push(...block.vendemmie);
    out.potature.push(...block.potature);
    out.trattamenti.push(...block.trattamenti);
    out.raccolte.push(...block.raccolte);
  });
  out.trattamenti.push(...(seminativo || []), ...(orticole || []));
  return out;
}

async function gatherRelated(lavoroId, tenantId, lavoro) {
  const terrenoId = lavoro?.terrenoId || null;
  const [
    ore,
    zone,
    comunicazioni,
    attivita,
    assenze,
    calcoliVm,
    speseVm,
    movimenti,
    preventivi,
    guasti,
    lavori,
    crop
  ] = await Promise.all([
    listSubcollection(`lavori/${lavoroId}/oreOperai`, tenantId),
    listSubcollection(`lavori/${lavoroId}/zoneLavorate`, tenantId),
    listDocsByLavoroId('comunicazioni', lavoroId, tenantId),
    listDocsByLavoroId('attivita', lavoroId, tenantId),
    listDocsByLavoroId('assenzeOperai', lavoroId, tenantId).then(async (byLavoro) => {
      let all = byLavoro;
      try {
        const rest = await getCollectionData('assenzeOperai', { tenantId });
        const seen = new Set(byLavoro.map((a) => a.id));
        (rest || []).forEach((a) => {
          if (seen.has(a.id)) return;
          if (matchesLavoroId(a.lavoroId, lavoroId) || matchesLavoroId(a.standbyLavoroId, lavoroId)) {
            all = all.concat([a]);
          }
        });
      } catch (_) { /* query già coperta */ }
      return all;
    }),
    listDocsByLavoroId('calcoli-vendemmia-meccanica', lavoroId, tenantId),
    listDocsByLavoroId('spese-vendemmia-meccanica', lavoroId, tenantId),
    listDocsByLavoroId('movimentiMagazzino', lavoroId, tenantId),
    listDocsByLavoroId('preventivi', lavoroId, tenantId),
    listDocsByLavoroId('guasti', lavoroId, tenantId),
    getCollectionData('lavori', { tenantId }).catch(() => []),
    listCropRecordsForLavoro(lavoroId, terrenoId, tenantId)
  ]);

  // Scarichi dal registro: spesso solo su magazzinoMovimentoIds (o senza lavoroId).
  // Stesso insieme in anteprima Elimina e in delete.
  const idsDaTrattamenti = collectMagazzinoMovimentoIdsFromTrattamenti(crop.trattamenti);
  const gia = new Set((movimenti || []).map((m) => String(m.id)));
  const missingIds = idsDaTrattamenti.filter((id) => !gia.has(String(id)));
  const extraMovimenti = [];
  for (const mid of missingIds) {
    try {
      const doc = await getDocumentData('movimentiMagazzino', mid, tenantId);
      if (doc) extraMovimenti.push({ ...doc, id: mid });
    } catch (_) { /* movimento già assente */ }
  }
  const movimentiMerged = mergeMovimentiForCascade(movimenti, extraMovimenti);

  return {
    lavoroId,
    lavoroNome: lavoro?.nome || '',
    lavoro,
    lavori: lavori || [],
    ore,
    zone,
    comunicazioni,
    attivita,
    assenze,
    calcoliVm,
    speseVm,
    movimenti: movimentiMerged,
    preventivi,
    guasti,
    vendemmie: crop.vendemmie,
    potature: crop.potature,
    trattamenti: crop.trattamenti,
    raccolte: crop.raccolte
  };
}

/**
 * @param {string} lavoroId
 * @param {{ tenantId?: string, lavoro?: Object }} [options]
 * @returns {Promise<Record<string, number>>}
 */
export async function countRelatedLavoroData(lavoroId, options = {}) {
  if (!lavoroId) throw new Error('ID lavoro obbligatorio');
  const tenantId = resolveTenantId(options);
  let lavoro = options.lavoro || null;
  if (!lavoro) {
    lavoro = await getDocumentData('lavori', lavoroId, tenantId);
  }
  if (!lavoro) throw new Error('Lavoro non trovato');
  const related = await gatherRelated(lavoroId, tenantId, { ...lavoro, id: lavoroId });
  return buildLavoroCascadePlan(related).counts;
}

async function deleteQuiet(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.warn(`[lavoro-delete-cascade] ${label}:`, err?.message || err);
  }
}

/**
 * Elimina il lavoro e i dati collegati. Blocca se esistono riprese figlie.
 *
 * @param {string} lavoroId
 * @param {{ tenantId?: string, lavoro?: Object, lavoriList?: Array }} [options]
 * @returns {Promise<{ counts: Record<string, number> }>}
 */
export async function deleteLavoroCascade(lavoroId, options = {}) {
  if (!lavoroId) throw new Error('ID lavoro obbligatorio');
  assertCanDeleteLavoro();
  const tenantId = resolveTenantId(options);

  let lavoro = options.lavoro || null;
  if (!lavoro) {
    lavoro = await getDocumentData('lavori', lavoroId, tenantId);
  }
  if (!lavoro) throw new Error('Lavoro non trovato');
  const { assertLavoroModificabile } = await import('./storico-guard.js');
  await assertLavoroModificabile({ ...lavoro, id: lavoroId });

  const related = await gatherRelated(lavoroId, tenantId, { ...lavoro, id: lavoroId });
  if (Array.isArray(options.lavoriList) && options.lavoriList.length) {
    const byId = new Map();
    (related.lavori || []).forEach((l) => byId.set(String(l.id), l));
    options.lavoriList.forEach((l) => {
      if (l && l.id && !byId.has(String(l.id))) byId.set(String(l.id), l);
    });
    related.lavori = Array.from(byId.values());
  }

  const plan = buildLavoroCascadePlan(related);
  if (plan.blocked) {
    const err = new Error(plan.blockedMessage || formatLavoroDeleteBlockedByRipreseMessage(plan.counts));
    err.code = RIPRESE_BLOCKED_CODE;
    err.counts = plan.counts;
    throw err;
  }

  // Trattamenti prima: deleteTrattamento ripristina giacenze magazzino.
  for (const rec of related.trattamenti) {
    await deleteQuiet(`trattamento ${rec.modulo}/${rec.id}`, rec.delete);
  }
  for (const rec of related.potature) {
    await deleteQuiet(`potatura ${rec.modulo}/${rec.id}`, rec.delete);
  }
  for (const rec of related.vendemmie) {
    await deleteQuiet(`vendemmia ${rec.id}`, rec.delete);
  }
  for (const rec of related.raccolte) {
    await deleteQuiet(`raccolta ${rec.id}`, rec.delete);
  }

  for (const ora of related.ore) {
    await deleteQuiet(`ora ${ora.id}`, () =>
      deleteDocument(`lavori/${lavoroId}/oreOperai`, ora.id, tenantId)
    );
  }
  for (const zona of related.zone) {
    await deleteQuiet(`zona ${zona.id}`, () =>
      deleteDocument(`lavori/${lavoroId}/zoneLavorate`, zona.id, tenantId)
    );
  }
  for (const comm of related.comunicazioni) {
    await deleteQuiet(`comunicazione ${comm.id}`, () =>
      deleteDocument('comunicazioni', comm.id, tenantId)
    );
  }
  for (const att of related.attivita) {
    await deleteQuiet(`attivita ${att.id}`, () =>
      deleteDocument('attivita', att.id, tenantId)
    );
  }
  for (const assenza of related.assenze) {
    const action = assenzaCascadeAction(assenza, lavoroId);
    if (action === 'delete') {
      await deleteQuiet(`assenza ${assenza.id}`, () =>
        deleteDocument('assenzeOperai', assenza.id, tenantId)
      );
    } else if (action === 'unlink-standby') {
      await deleteQuiet(`assenza standby ${assenza.id}`, () =>
        updateDocument('assenzeOperai', assenza.id, { standbyLavoroId: null }, tenantId)
      );
    }
  }
  for (const calc of related.calcoliVm) {
    await deleteQuiet(`calcolo VM ${calc.id}`, () =>
      deleteDocument('calcoli-vendemmia-meccanica', calc.id, tenantId)
    );
  }
  for (const spesa of related.speseVm) {
    await deleteQuiet(`spesa VM ${spesa.id}`, () =>
      deleteDocument('spese-vendemmia-meccanica', spesa.id, tenantId)
    );
  }

  // deleteTrattamento* storna già gli scarichi; qui ritentiamo tutti i movimenti
  // del piano (lavoroId + magazzinoMovimentoIds) così conteggio e delete restano allineati
  // anche se lo storno sul trattamento fallisce in quiet.
  const idsGia = new Set((related.movimenti || []).map((m) => String(m.id)));
  for (const mid of collectMagazzinoMovimentoIdsFromTrattamenti(related.trattamenti)) {
    if (!idsGia.has(String(mid))) {
      related.movimenti.push({ id: mid });
      idsGia.add(String(mid));
    }
  }
  for (const mov of related.movimenti) {
    await deleteQuiet(`movimento ${mov.id}`, async () => {
      try {
        const { deleteMovimento } = await import('../../modules/magazzino/services/movimenti-service.js');
        await deleteMovimento(mov.id);
      } catch (err) {
        if (err && err.code === 'MOVIMENTO_NON_TROVATO') return;
        await deleteDocument('movimentiMagazzino', mov.id, tenantId);
      }
    });
  }

  const calcoliIds = new Set((related.calcoliVm || []).map((c) => String(c.id)));
  for (const prev of related.preventivi) {
    const patch = unlinkPreventivoPatch(prev, calcoliIds);
    await deleteQuiet(`unlink preventivo ${prev.id}`, () =>
      updateDocument('preventivi', prev.id, patch, tenantId)
    );
  }
  for (const guasto of related.guasti) {
    await deleteQuiet(`unlink guasto ${guasto.id}`, () =>
      updateDocument('guasti', guasto.id, { lavoroId: null }, tenantId)
    );
  }

  try {
    const { clearLavoroFromPianoStagione } = await import(
      '../../modules/vendemmia-meccanica/services/lavoro-piano-sync-service.js'
    );
    await clearLavoroFromPianoStagione(
      { ...lavoro, id: lavoroId },
      { hasVmModule: true, tenantId }
    );
  } catch (err) {
    console.warn('[lavoro-delete-cascade] piano stagione VM:', err?.message || err);
  }

  try {
    const { liberaMacchineDaLavoro } = await import('./lavoro-macchine-lifecycle.js');
    await liberaMacchineDaLavoro(
      { id: lavoroId, macchinaId: lavoro.macchinaId, attrezzoId: lavoro.attrezzoId },
      { tenantId, lavoriList: related.lavori }
    );
  } catch (err) {
    console.warn('[lavoro-delete-cascade] libera macchine:', err?.message || err);
  }

  await deleteDocument('lavori', lavoroId, tenantId);

  try {
    await purgeOrphanComunicazioni(tenantId);
  } catch (err) {
    console.warn('[lavoro-delete-cascade] purge post-delete:', err?.message || err);
  }

  return { counts: plan.counts };
}

/**
 * Elimina comunicazioni il cui lavoroId punta a un lavoro inesistente.
 * @param {string} [tenantId]
 * @returns {Promise<number>} numero eliminate
 */
export async function purgeOrphanComunicazioni(tenantId = null) {
  const tid = tenantId || getCurrentTenantId();
  if (!tid) return 0;
  let lavori = [];
  let comms = [];
  try {
    lavori = (await getCollectionData('lavori', { tenantId: tid })) || [];
  } catch (err) {
    console.warn('[lavoro-delete-cascade] purge lavori:', err?.message || err);
    return 0;
  }
  try {
    comms = (await getCollectionData('comunicazioni', { tenantId: tid })) || [];
  } catch (err) {
    console.warn('[lavoro-delete-cascade] purge comunicazioni:', err?.message || err);
    return 0;
  }
  const existing = new Set(
    lavori.map((l) => normalizeRelatedLavoroId(l.id)).filter(Boolean)
  );
  let removed = 0;
  for (const comm of comms) {
    if (!comunicazioneRiferisceLavoroInesistente(comm, existing)) continue;
    try {
      await deleteDocument('comunicazioni', comm.id, tid);
      removed += 1;
    } catch (err) {
      console.warn('[lavoro-delete-cascade] purge delete', comm.id, err?.message || err);
    }
  }
  return removed;
}

/**
 * Unisce gli id lavoro già noti con un get puntuale sui candidati sconosciuti.
 * Gli id assenti da Firestore restano fuori dal set (lavoro morto).
 *
 * @param {string} tenantId
 * @param {Iterable<string>} [knownIds]
 * @param {Iterable<string>} [candidateIds]
 * @returns {Promise<Set<string>>}
 */
export async function collectLiveLavoroIdSet(tenantId, knownIds = [], candidateIds = []) {
  const set = new Set(
    Array.from(knownIds || []).map(normalizeRelatedLavoroId).filter(Boolean)
  );
  const unknown = [
    ...new Set(Array.from(candidateIds || []).map(normalizeRelatedLavoroId).filter(Boolean))
  ].filter((id) => !set.has(id));
  await Promise.all(unknown.map(async (id) => {
    try {
      const d = await getDocumentData('lavori', id, tenantId);
      if (d) set.add(id);
    } catch (_) { /* assente = morto */ }
  }));
  return set;
}

export const LAVORO_HAS_RIPRESE_FIGLIE = RIPRESE_BLOCKED_CODE;
