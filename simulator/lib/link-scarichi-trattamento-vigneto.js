/**
 * Allinea movimenti magazzino al pattern app reale (syncScarichiMagazzinoTrattamento).
 * Imposta origineTrattamento* + note + prezzoUnitario su uscite collegate a trattamenti vigneto.
 * @module simulator/lib/link-scarichi-trattamento-vigneto
 */

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} movimentoId
 * @param {object} params
 * @param {'vigneto'} params.modulo
 * @param {string} params.colturaId - vignetoId
 * @param {string} params.trattamentoId
 * @param {string|null} [params.attivitaId]
 * @param {string|null} [params.lavoroId]
 * @param {import('firebase-admin/firestore').Timestamp|Date|string} [params.dataTrattamento]
 * @param {{ prodottoId?: string, quantita?: number, costo?: number }|null} [params.rigaProdotto]
 * @param {{ prezzoUnitario?: number|string|null }|null} [params.prodottoAnagrafica]
 */
export async function patchMovimentoOrigineTrattamentoVigneto(
  db,
  tenantId,
  movimentoId,
  params
) {
  const {
    colturaId,
    trattamentoId,
    attivitaId = null,
    lavoroId = null,
    dataTrattamento = null,
    rigaProdotto = null,
    prodottoAnagrafica = null
  } = params;

  if (!movimentoId || !colturaId || !trattamentoId) return false;

  const note = `Scarico da trattamento vigneto (${String(trattamentoId).slice(0, 8)}…)`;
  const prezzoU = prezzoUnitarioPerScarico(prodottoAnagrafica, rigaProdotto);

  /** @type {Record<string, unknown>} */
  const patch = {
    origineTrattamentoModulo: 'vigneto',
    origineTrattamentoColturaId: colturaId,
    origineTrattamentoId: trattamentoId,
    attivitaId: attivitaId || null,
    lavoroId: lavoroId || null,
    note,
    updatedAt: new Date()
  };

  if (prezzoU != null) patch.prezzoUnitario = prezzoU;

  if (dataTrattamento) {
    const { Timestamp } = await import('firebase-admin/firestore');
    if (dataTrattamento instanceof Timestamp) {
      patch.data = dataTrattamento;
    } else if (dataTrattamento instanceof Date) {
      patch.data = Timestamp.fromDate(dataTrattamento);
    } else if (typeof dataTrattamento === 'string') {
      const [y, m, d] = dataTrattamento.split('-').map(Number);
      patch.data = Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
    } else if (typeof dataTrattamento.toDate === 'function') {
      patch.data = dataTrattamento;
    }
  }

  await db.doc(`tenants/${tenantId}/movimentiMagazzino/${movimentoId}`).set(patch, { merge: true });
  return true;
}

/**
 * @param {{ prezzoUnitario?: number|string|null }|null} prodottoAnagrafica
 * @param {{ costo?: number|null, quantita?: number|null }|null} row
 * @returns {number|null}
 */
export function prezzoUnitarioPerScarico(prodottoAnagrafica, row) {
  if (prodottoAnagrafica?.prezzoUnitario !== undefined && prodottoAnagrafica.prezzoUnitario !== null && prodottoAnagrafica.prezzoUnitario !== '') {
    const p = parseFloat(prodottoAnagrafica.prezzoUnitario);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  const costo = row?.costo != null ? parseFloat(row.costo) : NaN;
  const q = row?.quantita != null ? parseFloat(row.quantita) : NaN;
  if (Number.isFinite(costo) && Number.isFinite(q) && q > 0) {
    const u = costo / q;
    if (Number.isFinite(u) && u >= 0) return parseFloat(u.toFixed(4));
  }
  return null;
}

/**
 * Per ogni trattamento vigneto con magazzinoMovimentoIds, patch movimenti (idempotente).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @returns {Promise<{ patched: number, trattamenti: number, errors: string[] }>}
 */
export async function linkScarichiMagazzinoTrattamentoVignetoTenant(db, tenantId) {
  const errors = [];
  let patched = 0;
  let trattamenti = 0;

  const prodSnap = await db.collection(`tenants/${tenantId}/prodotti`).get();
  const prodById = new Map(prodSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const vignetiSnap = await db.collection(`tenants/${tenantId}/vigneti`).get();

  for (const vDoc of vignetiSnap.docs) {
    const vignetoId = vDoc.id;
    const trtSnap = await db.collection(`tenants/${tenantId}/vigneti/${vignetoId}/trattamenti`).get();

    for (const tDoc of trtSnap.docs) {
      const t = tDoc.data();
      const movIds = Array.isArray(t.magazzinoMovimentoIds) ? t.magazzinoMovimentoIds.filter(Boolean) : [];
      if (!movIds.length) continue;

      trattamenti += 1;
      const riga = Array.isArray(t.prodotti) && t.prodotti.length ? t.prodotti[0] : null;
      const prodottoAnagrafica = riga?.prodottoId ? prodById.get(riga.prodottoId) : null;

      for (const movId of movIds) {
        try {
          const ok = await patchMovimentoOrigineTrattamentoVigneto(db, tenantId, movId, {
            modulo: 'vigneto',
            colturaId: vignetoId,
            trattamentoId: tDoc.id,
            attivitaId: t.attivitaId || null,
            lavoroId: t.lavoroId || null,
            dataTrattamento: t.data || null,
            rigaProdotto: riga,
            prodottoAnagrafica
          });
          if (ok) patched += 1;
        } catch (e) {
          errors.push(`${vignetoId}/${tDoc.id}/${movId}: ${e.message}`);
        }
      }
    }
  }

  return { patched, trattamenti, errors };
}

/**
 * Verifica allineamento scarichi ↔ trattamenti (come app reale).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 */
export async function verifyScarichiTrattamentoVignetoTenant(db, tenantId) {
  const movSnap = await db.collection(`tenants/${tenantId}/movimentiMagazzino`).get();
  const linkedMovIds = new Set();
  let trattamentiConScarico = 0;

  const vignetiSnap = await db.collection(`tenants/${tenantId}/vigneti`).get();
  for (const vDoc of vignetiSnap.docs) {
    const trtSnap = await db.collection(`tenants/${tenantId}/vigneti/${vDoc.id}/trattamenti`).get();
    for (const tDoc of trtSnap.docs) {
      const ids = tDoc.data().magazzinoMovimentoIds || [];
      if (!ids.length) continue;
      trattamentiConScarico += 1;
      for (const id of ids) linkedMovIds.add(id);
    }
  }

  let origineOk = 0;
  let origineMissing = 0;
  for (const id of linkedMovIds) {
    const doc = movSnap.docs.find((d) => d.id === id);
    if (!doc) {
      origineMissing += 1;
      continue;
    }
    const m = doc.data();
    if (
      m.origineTrattamentoModulo === 'vigneto'
      && m.origineTrattamentoColturaId
      && m.origineTrattamentoId
    ) {
      origineOk += 1;
    } else {
      origineMissing += 1;
    }
  }

  return {
    trattamentiConScarico,
    movimentiCollegati: linkedMovIds.size,
    origineOk,
    origineMissing
  };
}
