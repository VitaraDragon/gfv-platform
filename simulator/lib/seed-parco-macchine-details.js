/**
 * Seed parco macchine completo: flotta aziendale + scadenze/manutenzione (allineato app).
 * @module simulator/lib/seed-parco-macchine-details
 */

import { generaFlotta } from '../generators/nomi-italiani.js';
import { addTenantDocument, normalizeForAdmin } from './firestore-write.js';

const TIPI_FLOTTA = new Set(['automezzo', 'veicolo', 'furgone']);

export function addDaysFromToday(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Profili scadenze per demo dashboard/scadenze (mix scaduto / imminente / ok).
 */
export function enrichTrattorePayload(m, index = 0) {
  const oreAttuali = m.oreAttuali ?? m.oreIniziali ?? 1200;
  return {
    ...m,
    oreAttuali,
    prossimaManutenzione: addDaysFromToday(index === 0 ? 18 : 90),
    oreProssimaManutenzione: oreAttuali + (index === 0 ? 35 : 120),
    prossimaRevisione: addDaysFromToday(120),
    prossimaAssicurazione: addDaysFromToday(45)
  };
}

export function enrichAttrezzoPayload(m, index = 0) {
  const profiles = [
    { stato: 'disponibile', prossimaManutenzione: addDaysFromToday(-8) },
    { stato: 'in_manutenzione', prossimaManutenzione: addDaysFromToday(5) },
    { stato: 'disponibile', prossimaManutenzione: addDaysFromToday(22) }
  ];
  const p = profiles[index % profiles.length];
  return { ...m, ...p };
}

export function enrichFlottaPayload(m, index = 0) {
  const kmBase = m.kmAttuali ?? m.kmIniziali ?? m.oreAttuali ?? m.oreIniziali ?? 45000;
  const kmIniziali = m.kmIniziali ?? m.oreIniziali ?? kmBase;
  const profiles = [
    {
      stato: 'disponibile',
      kmAttuali: kmBase,
      kmProssimaManutenzione: kmBase + 800,
      prossimaManutenzione: addDaysFromToday(12),
      prossimaRevisione: addDaysFromToday(6),
      prossimaAssicurazione: addDaysFromToday(25)
    },
    {
      stato: 'in_manutenzione',
      kmAttuali: kmBase + 12000,
      kmProssimaManutenzione: kmBase + 11500,
      prossimaManutenzione: addDaysFromToday(-3),
      prossimaRevisione: addDaysFromToday(-15),
      prossimaAssicurazione: addDaysFromToday(8)
    },
    {
      stato: 'disponibile',
      kmAttuali: kmBase + 8000,
      kmProssimaManutenzione: kmBase + 15000,
      prossimaManutenzione: addDaysFromToday(60),
      prossimaRevisione: addDaysFromToday(200),
      prossimaAssicurazione: addDaysFromToday(-5)
    }
  ];
  const profile = profiles[index % profiles.length];
  return {
    ...m,
    ...profile,
    kmIniziali,
    oreIniziali: null,
    oreAttuali: null,
    oreProssimaManutenzione: null
  };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {{ flottaCount?: number, seed?: number }} [options]
 */
export async function ensureFlottaAndScadenzeMacchine(db, tenantId, userId, options = {}) {
  const flottaTarget = options.flottaCount ?? 2;
  const seed = options.seed ?? Date.now();

  const snap = await db.collection(`tenants/${tenantId}/macchine`).get();
  const macchine = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  let flottaAggiunta = 0;
  let scadenzeAggiornate = 0;

  const flottaEsistente = macchine.filter((m) =>
    TIPI_FLOTTA.has((m.tipoMacchina || m.tipo || '').toLowerCase())
  );

  if (flottaEsistente.length < flottaTarget) {
    const daCreare = generaFlotta(flottaTarget - flottaEsistente.length, seed + flottaEsistente.length);
    for (let i = 0; i < daCreare.length; i++) {
      const payload = enrichFlottaPayload(
        { ...daCreare[i], creatoDa: userId },
        flottaEsistente.length + i
      );
      await addTenantDocument(db, tenantId, 'macchine', payload);
      flottaAggiunta += 1;
    }
  }

  const snapAfter = flottaAggiunta
    ? await db.collection(`tenants/${tenantId}/macchine`).get()
    : snap;
  const all = snapAfter.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const trattori = all.filter((m) => (m.tipoMacchina || m.tipo) === 'trattore');
  const attrezzi = all.filter((m) => (m.tipoMacchina || m.tipo) === 'attrezzo');
  const flotta = all.filter((m) => TIPI_FLOTTA.has((m.tipoMacchina || m.tipo || '').toLowerCase()));

  for (let i = 0; i < trattori.length; i++) {
    const m = trattori[i];
    if (m.prossimaManutenzione && m.prossimaAssicurazione && m.oreProssimaManutenzione != null) {
      continue;
    }
    const patch = enrichTrattorePayload(m, i);
    await m.ref.update(normalizeForAdmin({
      prossimaManutenzione: patch.prossimaManutenzione,
      oreProssimaManutenzione: patch.oreProssimaManutenzione,
      prossimaRevisione: patch.prossimaRevisione,
      prossimaAssicurazione: patch.prossimaAssicurazione,
      oreAttuali: patch.oreAttuali,
      updatedAt: new Date()
    }));
    scadenzeAggiornate += 1;
  }

  for (let i = 0; i < attrezzi.length; i++) {
    const m = attrezzi[i];
    const patch = enrichAttrezzoPayload(m, i);
    const needsPatch =
      !m.prossimaManutenzione ||
      (i === 1 && m.stato !== 'in_manutenzione');
    if (!needsPatch) continue;
    await m.ref.update(normalizeForAdmin({
      stato: patch.stato,
      prossimaManutenzione: patch.prossimaManutenzione,
      updatedAt: new Date()
    }));
    scadenzeAggiornate += 1;
  }

  for (let i = 0; i < flotta.length; i++) {
    const m = flotta[i];
    const needsKm = m.kmProssimaManutenzione == null || m.oreAttuali != null || m.oreProssimaManutenzione != null;
    if (!needsKm && m.prossimaAssicurazione && m.prossimaRevisione && m.prossimaManutenzione) continue;
    const patch = enrichFlottaPayload(m, i);
    await m.ref.update(normalizeForAdmin({
      stato: patch.stato,
      kmIniziali: patch.kmIniziali,
      kmAttuali: patch.kmAttuali,
      kmProssimaManutenzione: patch.kmProssimaManutenzione,
      oreIniziali: null,
      oreAttuali: null,
      oreProssimaManutenzione: null,
      prossimaManutenzione: patch.prossimaManutenzione,
      prossimaRevisione: patch.prossimaRevisione,
      prossimaAssicurazione: patch.prossimaAssicurazione,
      updatedAt: new Date()
    }));
    scadenzeAggiornate += 1;
  }

  const finalSnap = await db.collection(`tenants/${tenantId}/macchine`).get();
  const finalList = finalSnap.docs.map((d) => d.data());
  const flottaFinale = finalList.filter((m) =>
    TIPI_FLOTTA.has((m.tipoMacchina || m.tipo || '').toLowerCase())
  ).length;
  const inManutenzione = finalList.filter((m) => m.stato === 'in_manutenzione').length;
  const conScadenze = finalList.filter(
    (m) => m.prossimaManutenzione || m.prossimaAssicurazione || m.prossimaRevisione
  ).length;

  return {
    flottaAggiunta,
    scadenzeAggiornate,
    counts: {
      macchine: finalList.length,
      flotta: flottaFinale,
      inManutenzione,
      conScadenze
    }
  };
}
