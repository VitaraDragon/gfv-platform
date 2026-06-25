/**
 * Fase 4 — Scarichi magazzino collegati ad attività trattamento/concimazione.
 * @module simulator/phases/04-simulate-magazzino
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { requireSimTenantId, requireSimUserId } from '../lib/sim-context.js';

const TIPI_CON_SCARICO = new Set(['Trattamento', 'Controllo fitosanitario', 'Concimazione']);
const QTY_SCARICO = 3.5;

function dateStringToTimestamp(dateStr) {
  if (!dateStr) return Timestamp.fromDate(new Date());
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

function poolProdotti(prodotti, tipoLavoro) {
  if (tipoLavoro === 'Concimazione') {
    return prodotti.filter((p) => p.categoria === 'fertilizzanti' || p.categoria === 'concime');
  }
  return prodotti.filter((p) => p.categoria === 'fitofarmaci' || p.categoria === 'fitosanitario');
}

/**
 * @param {{ attivitaIds?: string[] }} [options]
 */
export async function runSimulateMagazzino(options = {}) {
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const db = getEmulatorDb();

  const prodottiSnap = await db.collection(`tenants/${tenantId}/prodotti`).get();
  const prodotti = prodottiSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  if (!prodotti.length) {
    return { movimentiIds: [], counts: { movimenti: 0 }, sottoScorta: 0 };
  }

  let attivitaDocs;
  if (options.attivitaIds?.length) {
    attivitaDocs = [];
    for (const id of options.attivitaIds) {
      const doc = await db.collection(`tenants/${tenantId}/attivita`).doc(id).get();
      if (doc.exists) attivitaDocs.push({ id: doc.id, ...doc.data() });
    }
  } else {
    const snap = await db.collection(`tenants/${tenantId}/attivita`).get();
    attivitaDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  attivitaDocs.sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  const movimentiIds = [];
  const giacenzaById = new Map(
    prodotti.map((p) => [p.id, typeof p.giacenza === 'number' ? p.giacenza : 0])
  );
  let scaricoIndex = 0;

  for (const att of attivitaDocs) {
    if (!TIPI_CON_SCARICO.has(att.tipoLavoro)) continue;

    const pool = poolProdotti(prodotti, att.tipoLavoro);
    const prodotto = pool[scaricoIndex % Math.max(pool.length, 1)] || prodotti[scaricoIndex % prodotti.length];
    scaricoIndex += 1;

    const quantita = QTY_SCARICO;
    const prezzoUnitario =
      prodotto.prezzoUnitario != null ? parseFloat(prodotto.prezzoUnitario) : null;
    const movimentoId = await addTenantDocument(db, tenantId, 'movimentiMagazzino', {
      prodottoId: prodotto.id,
      data: dateStringToTimestamp(att.data),
      tipo: 'uscita',
      quantita,
      prezzoUnitario: Number.isFinite(prezzoUnitario) ? prezzoUnitario : null,
      attivitaId: att.id,
      note: `Scarico simulato — ${att.tipoLavoro}`,
      userId
    });
    movimentiIds.push(movimentoId);

    const prev = giacenzaById.get(prodotto.id) ?? 0;
    const next = parseFloat((prev - quantita).toFixed(2));
    giacenzaById.set(prodotto.id, next);
    await prodotto.ref.update({
      giacenza: next,
      updatedAt: new Date()
    });
  }

  let sottoScorta = 0;
  for (const p of prodotti) {
    const g = giacenzaById.get(p.id) ?? 0;
    const min = p.scortaMinima ?? 0;
    if (min > 0 && g < min) sottoScorta += 1;
  }

  return {
    movimentiIds,
    counts: { movimenti: movimentiIds.length, sottoScorta },
    sottoScorta
  };
}
