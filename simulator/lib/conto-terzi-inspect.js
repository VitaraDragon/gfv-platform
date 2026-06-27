/**
 * Ispezione seed Conto Terzi su emulator.
 * @module simulator/lib/conto-terzi-inspect
 */

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {{
 *   clienti?: number,
 *   poderiClienti?: number,
 *   terreniClienti?: number,
 *   tariffe?: number,
 *   preventivi?: number,
 *   minPreventiviInviati?: number,
 *   minPreventiviAccettati?: number
 * }} expected
 */
export async function inspectContoTerziSeed(db, tenantId, expected = {}) {
  const errors = [];
  const clienti = await listCollection(db, tenantId, 'clienti');
  const poderi = await listCollection(db, tenantId, 'poderi-clienti');
  const tariffe = await listCollection(db, tenantId, 'tariffe');
  const preventivi = await listCollection(db, tenantId, 'preventivi');
  const terreni = await listCollection(db, tenantId, 'terreni');
  const terreniClienti = terreni.filter((t) => t.clienteId);

  const minClienti = expected.clienti ?? 1;
  const minPoderi = expected.poderiClienti ?? 1;
  const minTerreni = expected.terreniClienti ?? 1;
  const minTariffe = expected.tariffe ?? 1;
  const minPreventivi = expected.preventivi ?? 1;

  if (clienti.length < minClienti) {
    errors.push(`clienti insufficienti (${clienti.length}/${minClienti})`);
  }
  if (poderi.length < minPoderi) {
    errors.push(`poderi-clienti insufficienti (${poderi.length}/${minPoderi})`);
  }
  if (terreniClienti.length < minTerreni) {
    errors.push(`terreni clienti insufficienti (${terreniClienti.length}/${minTerreni})`);
  }
  if (tariffe.length < minTariffe) {
    errors.push(`tariffe insufficienti (${tariffe.length}/${minTariffe})`);
  }
  if (preventivi.length < minPreventivi) {
    errors.push(`preventivi insufficienti (${preventivi.length}/${minPreventivi})`);
  }

  for (const t of terreniClienti) {
    if (!t.coltura) errors.push(`terreno cliente "${t.nome}": coltura mancante`);
    if (!t.superficie || t.superficie <= 0) {
      errors.push(`terreno cliente "${t.nome}": superficie non valida`);
    }
    if (!Array.isArray(t.polygonCoords) || t.polygonCoords.length < 3) {
      errors.push(`terreno cliente "${t.nome}": polygonCoords mancante`);
    }
  }

  const inviati = preventivi.filter((p) =>
    ['inviato', 'accettato_email', 'accettato_manager'].includes(p.stato)
  ).length;
  const accettati = preventivi.filter((p) =>
    ['accettato_email', 'accettato_manager'].includes(p.stato)
  ).length;

  if (inviati < (expected.minPreventiviInviati ?? 1)) {
    errors.push(`preventivi inviati (${inviati}) sotto soglia`);
  }
  if (accettati < (expected.minPreventiviAccettati ?? 1)) {
    errors.push(`preventivi accettati (${accettati}) sotto soglia`);
  }

  return {
    ok: errors.length === 0,
    tenantId,
    counts: {
      clienti: clienti.length,
      poderiClienti: poderi.length,
      terreniClienti: terreniClienti.length,
      tariffe: tariffe.length,
      preventivi: preventivi.length,
      preventiviInviati: inviati,
      preventiviAccettati: accettati
    },
    errors
  };
}
