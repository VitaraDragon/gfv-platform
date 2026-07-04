/**
 * Fase 4 — Scarichi magazzino catena B (equivalente Admin SDK di syncScarichiMagazzinoTrattamento).
 * Va eseguita dopo fase 5 vigneto (e fase 7 manodopera se presente): completa stub trattamento
 * con righe prodotto e crea uscite con origineTrattamento* + magazzinoMovimentoIds sul trattamento.
 * @module simulator/phases/04-simulate-magazzino
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument, normalizeForAdmin } from '../lib/firestore-write.js';
import { prezzoUnitarioPerScarico } from '../lib/link-scarichi-trattamento-vigneto.js';
import { syncSpeseVignetoTenant } from '../lib/sim-economia-vigneto.js';
import { isFruttetoTemplate, isMistoColtureTemplate } from '../lib/load-template.js';
import { expectedMixedColtureCountsFromTemplate } from '../lib/mixed-colture-utils.js';
import { requireSimTenantId, requireSimUserId, getSimProfile } from '../lib/sim-context.js';
import { expectedFruttetoCountsFromTemplate } from './05-simulate-frutteto.js';
import { expectedVignetoCountsFromTemplate } from './05-simulate-vigneto.js';
import { extraCatenaCountsManodopera } from '../lib/vigneto-stub-from-trigger.js';
import { extraCatenaCountsManodoperaFrutteto } from '../lib/frutteto-stub-from-trigger.js';

const QTY_SCARICO = 3.5;
const DOSAGGIO = 2.5;

/** Stub trattamento lasciati incompleti per E2E write (template.magazzino.lasciaStubTrattamentiIncompleti). */
export function stubIncompletiLasciati(template) {
  return Math.max(0, Number(template?.magazzino?.lasciaStubTrattamentiIncompleti) || 0);
}

function poolProdotti(prodotti, tipoLavoro) {
  if (tipoLavoro === 'Concimazione' || tipoLavoro === 'fertilizzante') {
    return prodotti.filter((p) => p.categoria === 'fertilizzanti' || p.categoria === 'concime');
  }
  return prodotti.filter((p) => p.categoria === 'fitofarmaci' || p.categoria === 'fitosanitario');
}

function tipoLavoroFromTrattamento(trattamento, attivitaById, lavoriById) {
  if (trattamento.attivitaId && attivitaById.has(trattamento.attivitaId)) {
    return attivitaById.get(trattamento.attivitaId).tipoLavoro || '';
  }
  if (trattamento.lavoroId && lavoriById.has(trattamento.lavoroId)) {
    return lavoriById.get(trattamento.lavoroId).tipoLavoro || '';
  }
  if (trattamento.tipoTrattamento === 'fertilizzante') return 'Concimazione';
  return 'Trattamento';
}

function trattamentoGiaCompletato(trattamento) {
  const ids = Array.isArray(trattamento.magazzinoMovimentoIds)
    ? trattamento.magazzinoMovimentoIds.filter(Boolean)
    : [];
  if (ids.length) return true;
  const righe = Array.isArray(trattamento.prodotti) ? trattamento.prodotti : [];
  return righe.some((r) => r?.prodottoId && Number(r.quantita) > 0);
}

/**
 * Conteggio atteso movimenti = trattamenti vigneto seed (catena B, 1 uscita per trattamento).
 * @param {object} template
 */
export function expectedMovimentiFromTemplate(template) {
  const skip = stubIncompletiLasciati(template);
  if (isMistoColtureTemplate(template)) {
    const mixed = expectedMixedColtureCountsFromTemplate(template);
    const extraV = extraCatenaCountsManodopera(template);
    const extraF = extraCatenaCountsManodoperaFrutteto(template);
    return mixed.vigneto.trattamenti + mixed.frutteto.trattamenti
      + extraV.trattamenti + extraF.trattamenti - skip;
  }
  if (isFruttetoTemplate(template)) {
    const fr = expectedFruttetoCountsFromTemplate(template);
    const extra = extraCatenaCountsManodoperaFrutteto(template);
    return fr.trattamenti + extra.trattamenti - skip;
  }
  const vig = expectedVignetoCountsFromTemplate(template);
  const extra = extraCatenaCountsManodopera(template);
  return vig.trattamenti + extra.trattamenti - skip;
}

async function collectIncompleteTrattamentoKeys(db, tenantId, colturaCollection, coltureSnap) {
  const items = [];
  for (const cDoc of coltureSnap.docs) {
    const trtSnap = await db
      .collection(`tenants/${tenantId}/${colturaCollection}/${cDoc.id}/trattamenti`)
      .get();
    for (const tDoc of trtSnap.docs) {
      const trattamento = { id: tDoc.id, ...tDoc.data() };
      if (!trattamentoGiaCompletato(trattamento)) {
        items.push({ key: `${cDoc.id}:${tDoc.id}`, colturaId: cDoc.id, trattamentoId: tDoc.id });
      }
    }
  }
  items.sort((a, b) => a.key.localeCompare(b.key));
  return items;
}

async function processTrattamentiColtura(db, tenantId, userId, {
  colturaCollection,
  colturaId,
  modulo,
  noteLabel,
  prodotti,
  attivitaById,
  lavoriById,
  giacenzaById,
  scaricoIndexStart,
  skipKeys = new Set()
}) {
  const movimentiIds = [];
  let trattamentiCompletati = 0;
  let scaricoIndex = scaricoIndexStart;

  const trtSnap = await db
    .collection(`tenants/${tenantId}/${colturaCollection}/${colturaId}/trattamenti`)
    .get();

  for (const tDoc of trtSnap.docs) {
    const trattamento = { id: tDoc.id, ...tDoc.data() };
    if (trattamentoGiaCompletato(trattamento)) continue;
    if (skipKeys.has(`${colturaId}:${trattamento.id}`)) continue;

    const tipoLavoro = tipoLavoroFromTrattamento(trattamento, attivitaById, lavoriById);
    const pool = poolProdotti(prodotti, tipoLavoro);
    const prodotto =
      pool[scaricoIndex % Math.max(pool.length, 1)] || prodotti[scaricoIndex % prodotti.length];
    scaricoIndex += 1;

    const quantita = QTY_SCARICO;
    const prezzoU = prezzoUnitarioPerScarico(prodotto, { quantita, costo: null });
    const costo =
      prezzoU != null ? parseFloat((prezzoU * quantita).toFixed(2)) : parseFloat((quantita * 12).toFixed(2));

    const rigaProdotto = {
      prodottoId: prodotto.id,
      prodotto: prodotto.nome || prodotto.name || 'Prodotto sim',
      dosaggio: DOSAGGIO,
      unitaDosaggio: 'l/ha',
      quantita,
      costo
    };

    const note = `Scarico da trattamento ${noteLabel} (${String(trattamento.id).slice(0, 8)}…)`;
    const dataMov = trattamento.data || Timestamp.fromDate(new Date());

    const movimentoId = await addTenantDocument(db, tenantId, 'movimentiMagazzino', normalizeForAdmin({
      prodottoId: prodotto.id,
      data: dataMov,
      tipo: 'uscita',
      quantita,
      prezzoUnitario: prezzoU,
      lavoroId: trattamento.lavoroId || null,
      attivitaId: trattamento.attivitaId || null,
      note,
      userId,
      origineTrattamentoModulo: modulo,
      origineTrattamentoColturaId: colturaId,
      origineTrattamentoId: trattamento.id
    }));
    movimentiIds.push(movimentoId);

    const prev = giacenzaById.get(prodotto.id) ?? 0;
    const next = parseFloat((prev - quantita).toFixed(2));
    giacenzaById.set(prodotto.id, next);
    await prodotto.ref.update({ giacenza: next, updatedAt: new Date() });

    await tDoc.ref.set(
      normalizeForAdmin({
        prodotti: [rigaProdotto],
        prodotto: rigaProdotto.prodotto,
        dosaggio: String(DOSAGGIO),
        costoProdotto: costo,
        costoTotale: costo + (Number(trattamento.costoManodopera) || 0) + (Number(trattamento.costoMacchina) || 0),
        magazzinoMovimentoIds: [movimentoId],
        coperturaTerreno: trattamento.coperturaTerreno || 'completa',
        updatedAt: new Date()
      }),
      { merge: true }
    );

    trattamentiCompletati += 1;
  }

  return { movimentiIds, trattamentiCompletati, scaricoIndex };
}

/**
 * @param {{ attivitaIds?: string[] }} [options] — legacy, ignorato (scarichi da trattamenti vigneto)
 */
export async function runSimulateMagazzino(_options = {}) {
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const db = getEmulatorDb();

  const prodottiSnap = await db.collection(`tenants/${tenantId}/prodotti`).get();
  const prodotti = prodottiSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  if (!prodotti.length) {
    return { movimentiIds: [], counts: { movimenti: 0, trattamenti: 0 }, sottoScorta: 0 };
  }

  const profile = getSimProfile();
  const template = profile?.template;
  const fruttetoOnly = isFruttetoTemplate(template);
  const misto = isMistoColtureTemplate(template);

  const [attSnap, lavoriSnap, vignetiSnap, fruttetiSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/attivita`).get(),
    db.collection(`tenants/${tenantId}/lavori`).get(),
    misto || !fruttetoOnly
      ? db.collection(`tenants/${tenantId}/vigneti`).get()
      : Promise.resolve({ docs: [] }),
    misto || fruttetoOnly
      ? db.collection(`tenants/${tenantId}/frutteti`).get()
      : Promise.resolve({ docs: [] })
  ]);

  const attivitaById = new Map(attSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const lavoriById = new Map(lavoriSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const giacenzaById = new Map(
    prodotti.map((p) => [p.id, typeof p.giacenza === 'number' ? p.giacenza : 0])
  );

  const stubLeft = stubIncompletiLasciati(template);
  let skipKeys = new Set();
  if (stubLeft > 0) {
    const incomplete = [];
    if (misto || !fruttetoOnly) {
      incomplete.push(
        ...(await collectIncompleteTrattamentoKeys(db, tenantId, 'vigneti', vignetiSnap))
      );
    }
    if (misto || fruttetoOnly) {
      incomplete.push(
        ...(await collectIncompleteTrattamentoKeys(db, tenantId, 'frutteti', fruttetiSnap))
      );
    }
    incomplete.sort((a, b) => a.key.localeCompare(b.key));
    skipKeys = new Set(incomplete.slice(-stubLeft).map((x) => x.key));
  }

  const movimentiIds = [];
  let trattamentiCompletati = 0;
  let scaricoIndex = 0;
  let vignetoCompletati = 0;

  const coltureJobs = [];
  if (misto || !fruttetoOnly) {
    for (const cDoc of vignetiSnap.docs) {
      coltureJobs.push({
        colturaCollection: 'vigneti',
        colturaId: cDoc.id,
        modulo: 'vigneto',
        noteLabel: 'vigneto'
      });
    }
  }
  if (misto || fruttetoOnly) {
    for (const cDoc of fruttetiSnap.docs) {
      coltureJobs.push({
        colturaCollection: 'frutteti',
        colturaId: cDoc.id,
        modulo: 'frutteto',
        noteLabel: 'frutteto'
      });
    }
  }

  for (const job of coltureJobs) {
    const result = await processTrattamentiColtura(db, tenantId, userId, {
      ...job,
      prodotti,
      attivitaById,
      lavoriById,
      giacenzaById,
      scaricoIndexStart: scaricoIndex,
      skipKeys
    });
    movimentiIds.push(...result.movimentiIds);
    trattamentiCompletati += result.trattamentiCompletati;
    if (job.modulo === 'vigneto') vignetoCompletati += result.trattamentiCompletati;
    scaricoIndex = result.scaricoIndex;
  }

  let sottoScorta = 0;
  for (const p of prodotti) {
    const g = giacenzaById.get(p.id) ?? 0;
    const min = p.scortaMinima ?? 0;
    if (min > 0 && g < min) sottoScorta += 1;
  }

  // Con stub trattamento incompleti i round-robin possono non portare nessun prodotto sotto soglia.
  if (sottoScorta === 0 && movimentiIds.length > 0 && stubLeft > 0) {
    const target = prodotti.find((p) => (p.scortaMinima ?? 0) > 0);
    if (target) {
      const min = target.scortaMinima;
      const next = Math.max(0, min - 1);
      await target.ref.update({ giacenza: next, updatedAt: new Date() });
      giacenzaById.set(target.id, next);
      sottoScorta = 1;
    }
  }

  if (vignetoCompletati > 0) {
    await syncSpeseVignetoTenant(db, tenantId, { anno: new Date().getFullYear() });
  }

  return {
    movimentiIds,
    counts: { movimenti: movimentiIds.length, trattamenti: trattamentiCompletati, sottoScorta },
    sottoScorta
  };
}
