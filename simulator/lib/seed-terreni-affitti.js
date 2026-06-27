/**
 * Seed terreni in affitto — profili semaforo dashboard (allineato a calcolaAlertAffitto).
 * @module simulator/lib/seed-terreni-affitti
 */

import { addDaysFromToday } from './seed-parco-macchine-details.js';
import { normalizeForAdmin } from './firestore-write.js';

/** Giorni da oggi → bucket grey / red / yellow / green. */
export const AFFITTO_DAY_OFFSETS = [-5, 10, 90, 200];

/**
 * @param {object} terreno
 * @param {number} profileIndex
 */
export function enrichTerrenoAffitto(terreno, profileIndex = 0) {
  const days = AFFITTO_DAY_OFFSETS[profileIndex % AFFITTO_DAY_OFFSETS.length];
  return {
    ...terreno,
    tipoPossesso: 'affitto',
    dataScadenzaAffitto: addDaysFromToday(days)
  };
}

/**
 * Applica profili affitto ai primi N terreni aziendali (salta terreni clienti).
 * @param {Array<object>} terreniList
 * @param {{ maxAffitti?: number }} [options]
 */
export function applyAffittiProfilesToTerreni(terreniList, options = {}) {
  const maxAffitti = options.maxAffitti ?? AFFITTO_DAY_OFFSETS.length;
  let affitti = 0;
  return terreniList.map((t) => {
    if (t.clienteId) return t;
    if (affitti < maxAffitti) {
      const enriched = enrichTerrenoAffitto(t, affitti);
      affitti += 1;
      return enriched;
    }
    return t;
  });
}

function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Bucket affitto — stessa logica di `core/js/dashboard-data.js` calcolaAlertAffitto. */
export function affittoColoreFromData(dataScadenzaAffitto) {
  const scadenza = toDate(dataScadenzaAffitto);
  if (!scadenza) return null;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  scadenza.setHours(0, 0, 0, 0);
  const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
  if (giorni < 0) return 'grey';
  if (giorni <= 30) return 'red';
  if (giorni <= 180) return 'yellow';
  return 'green';
}

/**
 * @param {Array<object>} terreni — documenti Firestore terreni azienda (no clienteId)
 */
export function validateAffittiSemaforoSeed(terreni) {
  const errors = [];
  const affitti = terreni.filter(
    (t) => !t.clienteId && (t.tipoPossesso || '').toLowerCase() === 'affitto' && t.dataScadenzaAffitto
  );
  const colori = new Set(affitti.map((t) => affittoColoreFromData(t.dataScadenzaAffitto)).filter(Boolean));
  const attesi = ['grey', 'red', 'yellow', 'green'];

  if (affitti.length < AFFITTO_DAY_OFFSETS.length) {
    errors.push(
      `affitti demo: attesi almeno ${AFFITTO_DAY_OFFSETS.length} terreni in affitto con scadenza (${affitti.length})`
    );
  }
  for (const c of attesi) {
    if (!colori.has(c)) {
      errors.push(`affitti demo: manca bucket semaforo "${c}" (presenti: ${[...colori].join(', ') || '—'})`);
    }
  }

  return { affitti: affitti.length, colori: [...colori], errors };
}

/**
 * Backfill affitti su tenant esistente (terreni azienda senza clienteId).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 */
export async function ensureTerreniAffittiSeed(db, tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/terreni`).get();
  const azienda = snap.docs.filter((d) => {
    const t = d.data();
    return !t.clienteId;
  });

  let patched = 0;
  for (let i = 0; i < Math.min(AFFITTO_DAY_OFFSETS.length, azienda.length); i++) {
    const doc = azienda[i];
    const t = doc.data();
    const enriched = enrichTerrenoAffitto(t, i);
    const needsPatch =
      (t.tipoPossesso || '').toLowerCase() !== 'affitto' ||
      !t.dataScadenzaAffitto ||
      affittoColoreFromData(t.dataScadenzaAffitto) !== affittoColoreFromData(enriched.dataScadenzaAffitto);
    if (!needsPatch) continue;
    await doc.ref.update(
      normalizeForAdmin({
        tipoPossesso: 'affitto',
        dataScadenzaAffitto: enriched.dataScadenzaAffitto,
        updatedAt: new Date()
      })
    );
    patched += 1;
  }

  const validation = validateAffittiSemaforoSeed(
    azienda.map((d) => {
      const t = d.data();
      if (patched && azienda.indexOf(d) < AFFITTO_DAY_OFFSETS.length) {
        return enrichTerrenoAffitto(t, azienda.indexOf(d));
      }
      return t;
    })
  );

  return { patched, ...validation };
}
