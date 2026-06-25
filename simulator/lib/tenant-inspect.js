/**
 * Ispezione qualità seed terreni su emulator.
 * @module simulator/lib/tenant-inspect
 */

const EXPECTED_COLTURA = 'Vite da Vino';

const TIPI_FLOTTA = new Set(['automezzo', 'veicolo', 'furgone']);

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function countVignetoSubcollections(db, tenantId, subName) {
  const vigneti = await listCollection(db, tenantId, 'vigneti');
  let total = 0;
  for (const v of vigneti) {
    const snap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/${subName}`).get();
    total += snap.size;
  }
  return total;
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
  const potatureVigneto = await countVignetoSubcollections(db, tenantId, 'potature');
  const trattamentiVigneto = await countVignetoSubcollections(db, tenantId, 'trattamenti');

  if (poderi.length < 1) errors.push('manca almeno un podere');
  if (colture.length < 1) errors.push('manca catalogo colture');

  const flotta = macchine.filter((m) =>
    TIPI_FLOTTA.has((m.tipoMacchina || m.tipo || '').toLowerCase())
  );
  const macchineConScadenze = macchine.filter(
    (m) => m.prossimaManutenzione || m.prossimaAssicurazione || m.prossimaRevisione
  );
  if (flotta.length < 1) errors.push('manca flotta aziendale (furgone/pickup)');
  if (macchineConScadenze.length < 3) {
    errors.push(`poche scadenze macchine seed (${macchineConScadenze.length})`);
  }

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
      flotta: flotta.length,
      macchineConScadenze: macchineConScadenze.length,
      inManutenzione: macchine.filter((m) => m.stato === 'in_manutenzione').length,
      vigneti: vigneti.length,
      prodotti: prodotti.length,
      movimentiMagazzino: movimenti.length,
      potatureVigneto,
      trattamentiVigneto,
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
