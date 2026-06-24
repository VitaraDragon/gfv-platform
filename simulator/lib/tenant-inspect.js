/**
 * Ispezione qualità seed terreni su emulator.
 * @module simulator/lib/tenant-inspect
 */

const EXPECTED_COLTURA = 'Vite da Vino';

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @returns {Promise<{ ok: boolean, tenantId: string, terreni: Array, poderi: Array, counts: object, errors: string[] }>}
 */
export async function inspectTenantSeed(db, tenantId) {
  const errors = [];
  const terreni = await listCollection(db, tenantId, 'terreni');
  const poderi = await listCollection(db, tenantId, 'poderi');
  const colture = await listCollection(db, tenantId, 'colture');
  const categorie = await listCollection(db, tenantId, 'categorie');
  const attivita = await listCollection(db, tenantId, 'attivita');
  const macchine = await listCollection(db, tenantId, 'macchine');
  const vigneti = await listCollection(db, tenantId, 'vigneti');
  const prodotti = await listCollection(db, tenantId, 'prodotti');
  const movimenti = await listCollection(db, tenantId, 'movimentiMagazzino');

  if (poderi.length < 1) errors.push('manca almeno un podere');
  if (colture.length < 1) errors.push('manca catalogo colture');

  for (const t of terreni) {
    if (t.coltura !== EXPECTED_COLTURA) {
      errors.push(`terreno "${t.nome}": coltura "${t.coltura}" != "${EXPECTED_COLTURA}"`);
    }
    if (!t.podere) errors.push(`terreno "${t.nome}": podere mancante`);
    if (!t.tipoCampo) errors.push(`terreno "${t.nome}": tipoCampo mancante`);
    if (!Array.isArray(t.polygonCoords) || t.polygonCoords.length < 3) {
      errors.push(`terreno "${t.nome}": polygonCoords mancante o incompleto`);
    }
  }

  return {
    ok: errors.length === 0 && terreni.length > 0,
    tenantId,
    terreni,
    poderi,
    counts: {
      terreni: terreni.length,
      poderi: poderi.length,
      colture: colture.length,
      categorieColture: categorie.filter((c) => c.applicabileA === 'colture').length,
      attivita: attivita.length,
      macchine: macchine.length,
      vigneti: vigneti.length,
      prodotti: prodotti.length,
      movimentiMagazzino: movimenti.length,
      prodottiSottoScorta: prodotti.filter((p) => {
        const min = p.scortaMinima ?? 0;
        const g = p.giacenza ?? 0;
        return min > 0 && g < min;
      }).length
    },
    errors
  };
}

export { EXPECTED_COLTURA };
