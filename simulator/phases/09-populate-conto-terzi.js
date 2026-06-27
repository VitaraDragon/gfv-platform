/**
 * Fase 9 — Popola Conto Terzi (clienti, poderi, terreni clienti, tariffe, preventivi).
 * @module simulator/phases/09-populate-conto-terzi
 */

import {
  generaClienti,
  generaPoderiClienti,
  generaTerreniClienti,
  generaTariffe,
  generaPreventivi
} from '../generators/conto-terzi-seed.js';
import {
  prepareClienteForFirestore,
  preparePreventivoForFirestore,
  validateCliente,
  validatePodereCliente,
  validatePreventivo,
  validateTariffa
} from '../lib/conto-terzi-write.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument } from '../lib/firestore-write.js';
import { requireSimTenantId, requireSimUserId, getSimProfile } from '../lib/sim-context.js';

function assertValid(validation, label) {
  if (!validation.valid) {
    throw new Error(`${label}: ${validation.errors.join(', ')}`);
  }
}

/**
 * @returns {Promise<{ clienti, poderi, terreniClienti, tariffe, preventivi, counts, ids }>}
 */
export async function runPopulateContoTerzi() {
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const profile = getSimProfile();
  const template = profile?.template;
  const q = template?.quantities || {};
  const ctCfg = template?.contoTerzi || {};
  const seed = profile?.seed ?? Date.now();
  const db = getEmulatorDb();

  const clientiData = generaClienti(q.clienti || 3, seed);
  const clienti = [];
  for (const raw of clientiData) {
    assertValid(validateCliente(raw), 'Cliente');
    const id = await addTenantDocument(db, tenantId, 'clienti', {
      ...prepareClienteForFirestore(raw),
      creatoDa: userId
    });
    clienti.push({ id, ...raw });
  }

  const poderiData = generaPoderiClienti(clienti, q.poderiClienti || clienti.length, seed + 11);
  const poderi = [];
  for (const raw of poderiData) {
    assertValid(validatePodereCliente(raw), 'PodereCliente');
    const id = await addTenantDocument(db, tenantId, 'poderi-clienti', {
      ...raw,
      creatoDa: userId
    });
    poderi.push({ id, ...raw });
  }

  const terreniData = generaTerreniClienti(poderi, q.terreniClienti || 6, seed + 23);
  const terreniClienti = [];
  for (const raw of terreniData) {
    const id = await addTenantDocument(db, tenantId, 'terreni', {
      ...raw,
      clienteId: raw.clienteId
    });
    terreniClienti.push({ id, ...raw });
  }

  const tariffeData = generaTariffe(q.tariffe || 8, seed + 37);
  const tariffe = [];
  for (const raw of tariffeData) {
    assertValid(validateTariffa(raw), 'Tariffa');
    const id = await addTenantDocument(db, tenantId, 'tariffe', {
      ...raw,
      creatoDa: userId
    });
    tariffe.push({ id, ...raw });
  }

  const preventiviData = generaPreventivi({
    clienti,
    terreniClienti,
    tariffe,
    count: q.preventivi || 5,
    seed: seed + 53,
    iva: ctCfg.ivaPercentuale ?? 22,
    giorniScadenza: ctCfg.giorniScadenzaPreventivo ?? 30
  });
  const preventivi = [];
  for (const raw of preventiviData) {
    assertValid(validatePreventivo(raw), 'Preventivo');
    const id = await addTenantDocument(db, tenantId, 'preventivi', {
      ...preparePreventivoForFirestore(raw),
      creatoDa: userId
    });
    preventivi.push({ id, ...raw, stato: raw.stato });
  }

  return {
    clienti,
    poderi,
    terreniClienti,
    tariffe,
    preventivi,
    counts: {
      clienti: clienti.length,
      poderiClienti: poderi.length,
      terreniClienti: terreniClienti.length,
      tariffe: tariffe.length,
      preventivi: preventivi.length,
      preventiviInviati: preventivi.filter((p) =>
        ['inviato', 'accettato_email', 'accettato_manager'].includes(p.stato)
      ).length,
      preventiviAccettati: preventivi.filter((p) =>
        ['accettato_email', 'accettato_manager'].includes(p.stato)
      ).length
    }
  };
}
