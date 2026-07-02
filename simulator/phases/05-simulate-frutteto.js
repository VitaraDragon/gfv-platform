/**
 * Fase 5b — Stub potature/trattamenti/raccolte da attività diario (catena A §11.3.12).
 * @module simulator/phases/05-simulate-frutteto
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorDb } from '../lib/emulator-context.js';
import {
  createPotaturaStubFromAttivita,
  createRaccoltaStubFromAttivita,
  createTrattamentoStubFromAttivita,
  isTipoRaccolta,
  TIPI_POTATURA,
  TIPI_TRATTAMENTO
} from '../lib/frutteto-stub-from-trigger.js';
import {
  ensureTenantEconomia,
  getTariffaProprietario,
  tenantHasModule
} from '../lib/sim-economia-vigneto.js';
import { requireSimTenantId } from '../lib/sim-context.js';

/**
 * @param {{ attivitaIds?: string[], frutteti?: Array, terreni?: Array }} [options]
 */
export async function runSimulateFrutteto(options = {}) {
  const tenantId = requireSimTenantId();
  const db = getEmulatorDb();

  await ensureTenantEconomia(db, tenantId);

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenant = tenantSnap.data() || {};
  const parcoMacchine = tenantHasModule(tenant, 'parcoMacchine');
  const tariffaProprietario = await getTariffaProprietario(db, tenantId);

  const macSnap = await db.collection(`tenants/${tenantId}/macchine`).get();
  const macchine = new Map(macSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const costiCtx = { tariffaProprietario, parcoMacchine, macchine };

  const frutteti = options.frutteti?.length
    ? options.frutteti
    : (await db.collection(`tenants/${tenantId}/frutteti`).get()).docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

  const fruttetoByTerreno = new Map(frutteti.map((f) => [f.terrenoId, f]));

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

  const potaturaIds = [];
  const trattamentoIds = [];
  const raccoltaIds = [];

  for (const att of attivitaDocs) {
    const tipo = att.tipoLavoro || '';
    const frutteto = fruttetoByTerreno.get(att.terrenoId);
    if (!frutteto) continue;

    if (TIPI_POTATURA.has(tipo)) {
      const id = await createPotaturaStubFromAttivita(db, tenantId, att, frutteto, costiCtx);
      potaturaIds.push({ fruttetoId: frutteto.id, id, attivitaId: att.id });
      continue;
    }

    if (TIPI_TRATTAMENTO.has(tipo)) {
      const id = await createTrattamentoStubFromAttivita(db, tenantId, att, frutteto);
      trattamentoIds.push({ fruttetoId: frutteto.id, id, attivitaId: att.id });
      continue;
    }

    if (isTipoRaccolta(tipo)) {
      const id = await createRaccoltaStubFromAttivita(db, tenantId, att, frutteto);
      raccoltaIds.push({ fruttetoId: frutteto.id, id, attivitaId: att.id });
    }
  }

  for (const f of frutteti) {
    const potSnap = await db.collection(`tenants/${tenantId}/frutteti/${f.id}/potature`).get();
    const trtSnap = await db.collection(`tenants/${tenantId}/frutteti/${f.id}/trattamenti`).get();
    let dataUltimaPotatura = null;
    let dataUltimoTrattamento = null;

    for (const doc of potSnap.docs) {
      const d = doc.data();
      const dt = d.data?.toDate ? d.data.toDate() : null;
      if (dt && (!dataUltimaPotatura || dt > dataUltimaPotatura)) dataUltimaPotatura = dt;
    }
    for (const doc of trtSnap.docs) {
      const d = doc.data();
      const dt = d.data?.toDate ? d.data.toDate() : null;
      if (dt && (!dataUltimoTrattamento || dt > dataUltimoTrattamento)) dataUltimoTrattamento = dt;
    }

    const patch = { updatedAt: new Date() };
    if (dataUltimaPotatura) patch.dataUltimaPotatura = Timestamp.fromDate(dataUltimaPotatura);
    if (dataUltimoTrattamento) patch.dataUltimoTrattamento = Timestamp.fromDate(dataUltimoTrattamento);
    if (Object.keys(patch).length > 1) {
      await db.doc(`tenants/${tenantId}/frutteti/${f.id}`).set(patch, { merge: true });
    }
  }

  const expectedPotature = attivitaDocs.filter((a) => TIPI_POTATURA.has(a.tipoLavoro)).length;
  const expectedTrattamenti = attivitaDocs.filter((a) => TIPI_TRATTAMENTO.has(a.tipoLavoro)).length;
  const expectedRaccolte = attivitaDocs.filter((a) => isTipoRaccolta(a.tipoLavoro)).length;

  return {
    potaturaIds,
    trattamentoIds,
    raccoltaIds,
    counts: {
      potature: potaturaIds.length,
      trattamenti: trattamentoIds.length,
      raccolte: raccoltaIds.length,
      attesePotature: expectedPotature,
      attesiTrattamenti: expectedTrattamenti,
      atteseRaccolte: expectedRaccolte
    }
  };
}

/** Indice giorno raccolta (sostituisce Erpicatura — v. fase 03). */
export function raccoltaDayIndexFromTemplate(template) {
  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  for (let j = n - 1; j >= 0; j--) {
    if (tipi[j % Math.max(tipi.length, 1)] === 'Erpicatura') return j;
  }
  return n - 1;
}

/** Conteggi attesi da template (rotazione tipiLavoro). */
export function expectedFruttetoCountsFromTemplate(template) {
  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  const raccoltaIdx = raccoltaDayIndexFromTemplate(template);
  let potature = 0;
  let trattamenti = 0;
  let raccolte = 0;
  for (let i = 0; i < n; i++) {
    const t = i === raccoltaIdx ? 'Raccolta' : tipi[i % Math.max(tipi.length, 1)];
    if (isTipoRaccolta(t)) {
      raccolte += 1;
      continue;
    }
    if (TIPI_POTATURA.has(t)) potature += 1;
    if (TIPI_TRATTAMENTO.has(t)) trattamenti += 1;
  }
  return { potature, trattamenti, raccolte };
}

export { TIPI_POTATURA, TIPI_TRATTAMENTO };
