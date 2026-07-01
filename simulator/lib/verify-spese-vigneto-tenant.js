/**
 * Verifica coerenza calcolo spese vigneto (aggregaSpeseVignetoAnno) su dati emulator.
 * @module simulator/lib/verify-spese-vigneto-tenant
 */

import {
  computeSpeseVignetoAggregated,
  getTariffaProprietario,
  tenantHasModule
} from './sim-economia-vigneto.js';

async function listCollection(db, tenantId, name) {
  const snap = await db.collection(`tenants/${tenantId}/${name}`).get();
  return snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
}

function sumProdottiTrattamento(t) {
  if (t.prodotti?.length) {
    return t.prodotti.reduce((s, r) => s + (Number(r.costo) || 0), 0);
  }
  return Number(t.costoProdotto) || 0;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {{ anno?: number }} [options]
 */
export async function verifySpeseVignetoTenant(db, tenantId, options = {}) {
  const anno = options.anno ?? new Date().getFullYear();
  const errors = [];
  const warnings = [];
  const vignetiReport = [];

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  if (!tenantSnap.exists) {
    return { ok: false, tenantId, errors: ['tenant non trovato'], warnings, vigneti: [] };
  }
  const tenant = tenantSnap.data();
  const parcoMacchine = tenantHasModule(tenant, 'parcoMacchine');

  const [vigneti, attivita, lavori, macchineRaw, movimentiRaw] = await Promise.all([
    listCollection(db, tenantId, 'vigneti'),
    listCollection(db, tenantId, 'attivita'),
    listCollection(db, tenantId, 'lavori'),
    listCollection(db, tenantId, 'macchine'),
    listCollection(db, tenantId, 'movimentiMagazzino')
  ]);

  const macchine = new Map(macchineRaw.map((m) => [m.id, m]));
  const tariffaProprietario = await getTariffaProprietario(db, tenantId);

  const trattamentiAll = [];
  const potatureAll = [];
  for (const v of vigneti) {
    const [trtSnap, potSnap] = await Promise.all([
      db.collection(`tenants/${tenantId}/vigneti/${v.id}/trattamenti`).get(),
      db.collection(`tenants/${tenantId}/vigneti/${v.id}/potature`).get()
    ]);
    trtSnap.docs.forEach((d) => trattamentiAll.push({ id: d.id, _vignetoId: v.id, ...d.data() }));
    potSnap.docs.forEach((d) => potatureAll.push({ id: d.id, _vignetoId: v.id, ...d.data() }));
  }

  const ctx = {
    attivita,
    lavori,
    macchine,
    tariffaProprietario,
    parcoMacchine,
    trattamenti: trattamentiAll
  };

  let costoTotaleTenant = 0;
  let speseManodoperaTenant = 0;
  let speseProdottiTenant = 0;
  let speseMacchineTenant = 0;

  for (const v of vigneti) {
    const ref = computeSpeseVignetoAggregated(ctx, v, anno);
    const potV = potatureAll.filter((p) => p._vignetoId === v.id);
    const trtV = trattamentiAll.filter((t) => t._vignetoId === v.id);

    costoTotaleTenant += ref.costoTotaleAnno;
    speseManodoperaTenant += ref.speseManodoperaAnno;
    speseProdottiTenant += ref.speseProdottiAnno;
    speseMacchineTenant += ref.speseMacchineAnno;

    const docCosto = Number(v.costoTotaleAnno);
    if (v.costoTotaleAnno != null && Math.abs(docCosto - ref.costoTotaleAnno) > 0.05) {
      errors.push(
        `${v.varieta || v.id}: costoTotaleAnno doc (${docCosto}) ≠ aggregato (${ref.costoTotaleAnno})`
      );
    }

    const docManodopera = Number(v.speseManodoperaAnno);
    if (v.speseManodoperaAnno != null && Math.abs(docManodopera - ref.speseManodoperaAnno) > 0.05) {
      errors.push(
        `${v.varieta || v.id}: speseManodoperaAnno doc (${docManodopera}) ≠ aggregato (${ref.speseManodoperaAnno})`
      );
    }

    const docProdotti = Number(v.speseProdottiAnno);
    if (v.speseProdottiAnno != null && docProdotti > 0 && Math.abs(docProdotti - ref.speseProdottiAnno) > 0.05) {
      errors.push(
        `${v.varieta || v.id}: speseProdottiAnno doc (${docProdotti}) ≠ aggregato (${ref.speseProdottiAnno})`
      );
    }

    for (const p of potV) {
      const att = p.attivitaId ? attivita.find((a) => a.id === p.attivitaId) : null;
      if (!att) continue;
      const expected = (att.oreNette || 0) * tariffaProprietario;
      const cm = Number(p.costoManodopera) || 0;
      if (Math.abs(cm - expected) > 0.05) {
        warnings.push(
          `potatura ${p.id}: costoManodopera scheda (${cm}) ≠ diario (${expected.toFixed(2)})`
        );
      }
    }

    for (const t of trtV) {
      const att = t.attivitaId ? attivita.find((a) => a.id === t.attivitaId) : null;
      if (!att) continue;
      const expectedProd = sumProdottiTrattamento(t);
      const cp = Number(t.costoProdotto) || 0;
      if (expectedProd > 0 && Math.abs(cp - expectedProd) > 0.05) {
        warnings.push(`trattamento ${t.id}: costoProdotto (${cp}) ≠ righe prodotto (${expectedProd})`);
      }
    }

    vignetiReport.push({
      vignetoId: v.id,
      varieta: v.varieta,
      reference: ref,
      stored: {
        costoTotaleAnno: v.costoTotaleAnno,
        speseManodoperaAnno: v.speseManodoperaAnno,
        speseMacchineAnno: v.speseMacchineAnno,
        speseProdottiAnno: v.speseProdottiAnno
      }
    });
  }

  const attivitaVigneto = attivita.filter((a) => {
    if (a.lavoroId || a.clienteId || !a.data || !a.tipoLavoro) return false;
    return vigneti.some((v) => v.terrenoId === a.terrenoId);
  });

  if (speseProdottiTenant <= 0 && trattamentiAll.length > 0) {
    const movUsciteAttivita = movimentiRaw.filter(
      (m) => m.tipo === 'uscita' && m.attivitaId
    ).length;
    if (movUsciteAttivita === 0) {
      errors.push('trattamenti presenti ma speseProdottiAnno = 0 e nessun movimento uscita attività');
    }
  }

  if (speseManodoperaTenant <= 0 && attivitaVigneto.length > 0) {
    errors.push('attività vigneto presenti ma speseManodoperaAnno = 0');
  }

  const macchineSenzaCosto = macchineRaw.filter((m) => m.costoOra == null);
  if (
    parcoMacchine &&
    attivitaVigneto.some((a) => (a.oreMacchina || 0) > 0) &&
    macchineSenzaCosto.length === macchineRaw.length &&
    macchineRaw.length > 0
  ) {
    errors.push('Parco Macchine attivo ma nessuna macchina con costoOra');
  }

  if (parcoMacchine && speseMacchineTenant <= 0 && attivitaVigneto.some((a) => (a.oreMacchina || 0) > 0)) {
    warnings.push('Attività con oreMacchina ma speseMacchineAnno = 0 (verificare costoOra macchine)');
  }

  return {
    ok: errors.length === 0,
    tenantId,
    anno,
    tariffaProprietario,
    parcoMacchine,
    totals: {
      costoTotaleAnno: parseFloat(costoTotaleTenant.toFixed(2)),
      speseManodoperaAnno: parseFloat(speseManodoperaTenant.toFixed(2)),
      speseProdottiAnno: parseFloat(speseProdottiTenant.toFixed(2)),
      speseMacchineAnno: parseFloat(speseMacchineTenant.toFixed(2))
    },
    counts: {
      vigneti: vigneti.length,
      attivitaVigneto: attivitaVigneto.length,
      trattamenti: trattamentiAll.length,
      potature: potatureAll.length,
      macchineSenzaCostoOra: macchineSenzaCosto.length
    },
    vigneti: vignetiReport,
    errors,
    warnings
  };
}

export { computeSpeseVignetoAggregated as computeSpeseVignetoReference };
