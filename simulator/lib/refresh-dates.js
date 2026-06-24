/**
 * Ricalcola date attività (e movimenti collegati) relative a oggi.
 * @module simulator/lib/refresh-dates
 */

import { Timestamp } from 'firebase-admin/firestore';
import { generaGiorniLavorativi } from '../generators/date-calendario.js';

function dateStringToTimestamp(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {Date} [referenceDate=new Date()]
 * @returns {Promise<{ attivita: number, movimenti: number, dateRange: { from: string, to: string } }>}
 */
export async function refreshTenantDates(db, tenantId, referenceDate = new Date()) {
  const attRef = db.collection(`tenants/${tenantId}/attivita`);
  const snap = await attRef.get();

  if (snap.empty) {
    throw new Error(`Nessuna attività per tenant ${tenantId}`);
  }

  const attivita = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  const newDates = generaGiorniLavorativi(attivita.length, referenceDate);
  if (newDates.length !== attivita.length) {
    throw new Error('Conteggio date non allineato alle attività');
  }

  let movimentiUpdated = 0;

  for (let i = 0; i < attivita.length; i++) {
    const att = attivita[i];
    const newDate = newDates[i];
    await db.collection(`tenants/${tenantId}/attivita`).doc(att.id).update({
      data: newDate,
      updatedAt: new Date()
    });

    const movSnap = await db
      .collection(`tenants/${tenantId}/movimentiMagazzino`)
      .where('attivitaId', '==', att.id)
      .get();

    for (const movDoc of movSnap.docs) {
      await movDoc.ref.update({
        data: dateStringToTimestamp(newDate),
        updatedAt: new Date()
      });
      movimentiUpdated += 1;
    }
  }

  return {
    attivita: attivita.length,
    movimenti: movimentiUpdated,
    dateRange: { from: newDates[0], to: newDates[newDates.length - 1] }
  };
}
