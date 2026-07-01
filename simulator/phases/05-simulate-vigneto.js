/**
 * Fase 5 — Stub potature/trattamenti/vendemmia da attività diario (catena A §11.3.12).
 * Non scrive record completi né collega scarichi magazzino (catena B → UI trattamento).
 * @module simulator/phases/05-simulate-vigneto
 */

import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorDb } from '../lib/emulator-context.js';
import {
  createPotaturaStubFromAttivita,
  createTrattamentoStubFromAttivita,
  createVendemmiaStubFromAttivita,
  isTipoVendemmia,
  TIPI_POTATURA,
  TIPI_TRATTAMENTO
} from '../lib/vigneto-stub-from-trigger.js';
import {
  ensureTenantEconomia,
  getTariffaProprietario,
  syncSpeseVignetoTenant,
  tenantHasModule
} from '../lib/sim-economia-vigneto.js';
import { requireSimTenantId } from '../lib/sim-context.js';

/**
 * @param {{ attivitaIds?: string[], vigneti?: Array, terreni?: Array }} [options]
 */
export async function runSimulateVigneto(options = {}) {
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

  const vigneti = options.vigneti?.length
    ? options.vigneti
    : (await db.collection(`tenants/${tenantId}/vigneti`).get()).docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

  const vignetoByTerreno = new Map(vigneti.map((v) => [v.terrenoId, v]));

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
  const vendemmiaIds = [];

  for (const att of attivitaDocs) {
    const tipo = att.tipoLavoro || '';
    const vigneto = vignetoByTerreno.get(att.terrenoId);
    if (!vigneto) continue;

    if (TIPI_POTATURA.has(tipo)) {
      const id = await createPotaturaStubFromAttivita(db, tenantId, att, vigneto, costiCtx);
      potaturaIds.push({ vignetoId: vigneto.id, id, attivitaId: att.id });
      continue;
    }

    if (TIPI_TRATTAMENTO.has(tipo)) {
      const id = await createTrattamentoStubFromAttivita(db, tenantId, att, vigneto);
      trattamentoIds.push({ vignetoId: vigneto.id, id, attivitaId: att.id });
      continue;
    }

    if (isTipoVendemmia(tipo)) {
      const id = await createVendemmiaStubFromAttivita(db, tenantId, att, vigneto);
      vendemmiaIds.push({ vignetoId: vigneto.id, id, attivitaId: att.id });
    }
  }

  const anno = new Date().getFullYear();
  for (const v of vigneti) {
    const potSnap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/potature`).get();
    const trtSnap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/trattamenti`).get();
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
      await db.doc(`tenants/${tenantId}/vigneti/${v.id}`).set(patch, { merge: true });
    }
  }

  const speseSync = await syncSpeseVignetoTenant(db, tenantId, { anno });

  const expectedPotature = attivitaDocs.filter((a) => TIPI_POTATURA.has(a.tipoLavoro)).length;
  const expectedTrattamenti = attivitaDocs.filter((a) => TIPI_TRATTAMENTO.has(a.tipoLavoro)).length;
  const expectedVendemmie = attivitaDocs.filter((a) => isTipoVendemmia(a.tipoLavoro)).length;

  return {
    potaturaIds,
    trattamentoIds,
    vendemmiaIds,
    speseSync,
    counts: {
      potature: potaturaIds.length,
      trattamenti: trattamentoIds.length,
      vendemmie: vendemmiaIds.length,
      attesePotature: expectedPotature,
      attesiTrattamenti: expectedTrattamenti,
      atteseVendemmie: expectedVendemmie
    }
  };
}

/** Indice giorno vendemmia (sostituisce Erpicatura — v. fase 03). */
export function vendemmiaDayIndexFromTemplate(template) {
  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  for (let j = n - 1; j >= 0; j--) {
    if (tipi[j % Math.max(tipi.length, 1)] === 'Erpicatura') return j;
  }
  return n - 1;
}

/** Conteggi attesi da template (rotazione tipiLavoro). */
export function expectedVignetoCountsFromTemplate(template) {
  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  const vendemmiaIdx = vendemmiaDayIndexFromTemplate(template);
  let potature = 0;
  let trattamenti = 0;
  let vendemmie = 0;
  for (let i = 0; i < n; i++) {
    const t = i === vendemmiaIdx ? 'Vendemmia Manuale' : tipi[i % Math.max(tipi.length, 1)];
    if (isTipoVendemmia(t)) {
      vendemmie += 1;
      continue;
    }
    if (TIPI_POTATURA.has(t)) potature += 1;
    if (TIPI_TRATTAMENTO.has(t)) trattamenti += 1;
  }
  return { potature, trattamenti, vendemmie };
}

export { TIPI_POTATURA, TIPI_TRATTAMENTO };
