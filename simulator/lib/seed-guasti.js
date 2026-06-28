/**
 * Seed guasti parco macchine — mix grave/non-grave/aperto/risolto (allineato app).
 * @module simulator/lib/seed-guasti
 */

import { FieldValue } from 'firebase-admin/firestore';
import { addTenantDocument } from './firestore-write.js';
import { requireSimTenantId, requireSimUserId, getSimProfile } from './sim-context.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ trattori?: Array<{id:string}>, attrezzi?: Array<{id:string}>, userId?: string, count?: number }} [options]
 */
export async function seedGuastiDemo(db, options = {}) {
  const tenantId = requireSimTenantId();
  const userId = options.userId || requireSimUserId();
  const profile = getSimProfile();
  const q = profile?.template?.quantities || {};
  const count = options.count ?? q.guasti ?? 0;
  if (count <= 0) {
    return { guasti: [], counts: { guasti: 0, guastiAperti: 0 } };
  }

  const trattori = options.trattori || [];
  const attrezzi = options.attrezzi || [];
  if (!trattori.length && !attrezzi.length) {
    throw new Error('seedGuastiDemo: servono trattori o attrezzi');
  }

  const trattoreId = trattori[0]?.id;
  const attrezzoIds = attrezzi.map((a) => a.id).filter(Boolean);
  const attrezzo1 = attrezzoIds[0];
  const attrezzo2 = attrezzoIds[1] || attrezzo1;

  /** @type {Array<object>} */
  const profiles = [
    {
      tipoGuasto: 'macchina',
      gravita: 'grave',
      dettagli: 'Perdita olio motore — trattore fermo in campo (seed GFV Farm Simulator)',
      macchinaId: trattoreId,
      attrezzoId: null,
      componenteGuasto: 'trattore',
      stato: 'in-attesa',
      risolto: false,
      macchinaStato: 'guasto'
    },
    {
      tipoGuasto: 'macchina',
      gravita: 'non-grave',
      dettagli: 'Idraulica lenta — attrezzo utilizzabile con cautela (seed sim)',
      macchinaId: trattoreId,
      attrezzoId: attrezzo1,
      componenteGuasto: 'attrezzo',
      stato: 'in-attesa',
      risolto: false,
      macchinaStato: 'guasto-lavoro-in-corso',
      updateAttrezzoId: attrezzo1
    },
    {
      tipoGuasto: 'macchina',
      gravita: 'non-grave',
      dettagli: 'Usura denti ripper — intervento programmato (seed sim, risolto)',
      macchinaId: trattoreId,
      attrezzoId: attrezzo2,
      componenteGuasto: 'attrezzo',
      stato: 'risolto',
      risolto: true,
      noteRisoluzione: 'Sostituzione denti completata in officina (seed sim)'
    }
  ];

  const guasti = [];
  let guastiAperti = 0;

  for (let i = 0; i < Math.min(count, profiles.length); i++) {
    const p = profiles[i];
    const payload = {
      tipoGuasto: p.tipoGuasto,
      gravita: p.gravita,
      dettagli: p.dettagli,
      macchinaId: p.macchinaId || null,
      attrezzoId: p.attrezzoId || null,
      componenteGuasto: p.componenteGuasto || null,
      lavoroId: null,
      segnalatoDa: userId,
      segnalatoIl: FieldValue.serverTimestamp(),
      stato: p.stato,
      risolto: p.risolto,
      simSeed: true
    };
    if (p.risolto) {
      payload.risoltoDa = userId;
      payload.risoltoIl = FieldValue.serverTimestamp();
      payload.noteRisoluzione = p.noteRisoluzione || null;
    }

    const id = await addTenantDocument(db, tenantId, 'guasti', payload);
    guasti.push({ id, ...payload });

    if (!p.risolto) guastiAperti += 1;

    if (p.macchinaStato && p.macchinaId) {
      await db.doc(`tenants/${tenantId}/macchine/${p.macchinaId}`).update({ stato: p.macchinaStato });
    }
    if (p.updateAttrezzoId && p.macchinaStato) {
      await db.doc(`tenants/${tenantId}/macchine/${p.updateAttrezzoId}`).update({ stato: p.macchinaStato });
    }
  }

  return {
    guasti,
    counts: { guasti: guasti.length, guastiAperti }
  };
}
