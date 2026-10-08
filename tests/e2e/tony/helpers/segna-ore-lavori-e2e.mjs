/**
 * Lavori solo per T-FLOW-027 / 028.
 * Il seed condiviso non ha due «Ripristino pali» con date diverse e una Trinciatura in testa.
 * Si clonano caposquadraId e terrenoId da un lavoro già del capo, poi si cancellano a fine scenario.
 * @module tests/e2e/tony/helpers/segna-ore-lavori-e2e
 */

import { initEmulatorAdmin } from '../../../../simulator/lib/emulator-context.js';
import { addTenantDocument } from '../../../../simulator/lib/firestore-write.js';

export const MARKER_LAVORI_RITEST = 'T-FLOW-027';

function isoOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function leggiTenantIdSegnatura(page) {
  return page.evaluate(() => sessionStorage.getItem('gfv_current_tenant_id') || '');
}

export async function pulisciLavoriRitest(tenantId) {
  if (!tenantId) return;
  const { db } = initEmulatorAdmin();
  const snap = await db.collection(`tenants/${tenantId}/lavori`)
    .where('gfvTonyE2eMarker', '==', MARKER_LAVORI_RITEST)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Tre lavori del capo: Trinciatura con data lontana (prima in lista), due Ripristino pali di cui uno oggi.
 * La data lontana resta segnabile perché ha ripresaDaLavoroId.
 * @param {string} tenantId
 */
export async function seminaLavoriRitest(tenantId) {
  const { db } = initEmulatorAdmin();
  await pulisciLavoriRitest(tenantId);
  const esistenti = await db.collection(`tenants/${tenantId}/lavori`).limit(40).get();
  const sample = esistenti.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((d) => d.caposquadraId && !d.operaioId && d.gfvTonyE2eMarker !== MARKER_LAVORI_RITEST);
  if (!sample) throw new Error('T-FLOW-027: nessun lavoro del caposquadra da cui copiare l\'assegnazione');

  const base = {
    caposquadraId: sample.caposquadraId,
    terrenoId: sample.terrenoId || null,
    stato: 'assegnato',
    gfvTonyE2eMarker: MARKER_LAVORI_RITEST,
    tipoLavoro: 'Manutenzione',
  };

  const nomeTr = 'Trinciatura vigna e2e027';
  const nomeOggi = 'Ripristino pali e2e027';
  const nomeAltro = 'Ripristino pali Grazie e2e027';

  const trId = await addTenantDocument(db, tenantId, 'lavori', {
    ...base,
    nome: nomeTr,
    dataInizio: isoOffset(40),
    ripresaDaLavoroId: sample.id,
  });
  const altroId = await addTenantDocument(db, tenantId, 'lavori', {
    ...base,
    nome: nomeAltro,
    dataInizio: isoOffset(-1),
    ripresaDaLavoroId: sample.id,
  });
  const oggiId = await addTenantDocument(db, tenantId, 'lavori', {
    ...base,
    nome: nomeOggi,
    dataInizio: isoOffset(0),
    ripresaDaLavoroId: sample.id,
  });

  return { trId, oggiId, altroId, nomeTr, nomeOggi, nomeAltro };
}
