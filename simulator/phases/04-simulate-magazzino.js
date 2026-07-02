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
import { isFruttetoTemplate } from '../lib/load-template.js';
import { requireSimTenantId, requireSimUserId, getSimProfile } from '../lib/sim-context.js';
import { expectedFruttetoCountsFromTemplate } from './05-simulate-frutteto.js';
import { expectedVignetoCountsFromTemplate } from './05-simulate-vigneto.js';
import { extraCatenaCountsManodopera } from '../lib/vigneto-stub-from-trigger.js';

const QTY_SCARICO = 3.5;
const DOSAGGIO = 2.5;

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
  if (isFruttetoTemplate(template)) {
    return expectedFruttetoCountsFromTemplate(template).trattamenti;
  }
  const vig = expectedVignetoCountsFromTemplate(template);
  const extra = extraCatenaCountsManodopera(template);
  return vig.trattamenti + extra.trattamenti;
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
  scaricoIndexStart
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
  const useFrutteto = isFruttetoTemplate(profile?.template);

  const [attSnap, lavoriSnap, coltureSnap] = await Promise.all([
    db.collection(`tenants/${tenantId}/attivita`).get(),
    db.collection(`tenants/${tenantId}/lavori`).get(),
    db.collection(`tenants/${tenantId}/${useFrutteto ? 'frutteti' : 'vigneti'}`).get()
  ]);

  const attivitaById = new Map(attSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const lavoriById = new Map(lavoriSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const giacenzaById = new Map(
    prodotti.map((p) => [p.id, typeof p.giacenza === 'number' ? p.giacenza : 0])
  );

  const movimentiIds = [];
  let trattamentiCompletati = 0;
  let scaricoIndex = 0;

  for (const cDoc of coltureSnap.docs) {
    const result = await processTrattamentiColtura(db, tenantId, userId, {
      colturaCollection: useFrutteto ? 'frutteti' : 'vigneti',
      colturaId: cDoc.id,
      modulo: useFrutteto ? 'frutteto' : 'vigneto',
      noteLabel: useFrutteto ? 'frutteto' : 'vigneto',
      prodotti,
      attivitaById,
      lavoriById,
      giacenzaById,
      scaricoIndexStart: scaricoIndex
    });
    movimentiIds.push(...result.movimentiIds);
    trattamentiCompletati += result.trattamentiCompletati;
    scaricoIndex = result.scaricoIndex;
  }

  let sottoScorta = 0;
  for (const p of prodotti) {
    const g = giacenzaById.get(p.id) ?? 0;
    const min = p.scortaMinima ?? 0;
    if (min > 0 && g < min) sottoScorta += 1;
  }

  if (trattamentiCompletati > 0 && !useFrutteto) {
    await syncSpeseVignetoTenant(db, tenantId, { anno: new Date().getFullYear() });
  }

  return {
    movimentiIds,
    counts: { movimenti: movimentiIds.length, trattamenti: trattamentiCompletati, sottoScorta },
    sottoScorta
  };
}
