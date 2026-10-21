/**
 * Standby lavoro giustificato da assenza operaio (distinto da sospeso/guasto).
 *
 * @module core/services/lavoro-standby-assenza-service
 */

import { serverTimestamp } from './firebase-service.js';
import { getLavoro, updateLavoro } from './lavori-service.js';
import {
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STATI_STANDBY_AMMESSI,
  toGiornoKey
} from '../config/manodopera-assenze-config.js';
import {
  confermaAssenza,
  collegaAssenzaALavoroStandby,
  creaAssenzaConfermata,
  getAssenza,
  segnalaAssenza
} from './manodopera-assenze-service.js';

/**
 * @param {Object} lavoro
 * @returns {string|null} operaioId coinvolto
 */
export function resolveOperaioIdFromLavoro(lavoro) {
  if (!lavoro) return null;
  if (lavoro.operaioId) return lavoro.operaioId;
  // Lavoro di squadra: nessun operaio singolo sul documento; standby usa selezione esplicita
  return lavoro.standbyOperaioId || null;
}

/**
 * Mette il lavoro in standby e collega assenza confermata.
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.operaioId
 * @param {string} options.tipoAssenza
 * @param {string} [options.nota]
 * @param {string} options.managerId
 * @param {string} [options.assenzaId] — se già segnalata, solo conferma + standby
 * @param {string} [options.giornoKey] YYYY-MM-DD (default oggi)
 * @param {string} [options.tenantId]
 * @returns {Promise<{ assenzaId: string, lavoroId: string }>}
 */
export async function mettiLavoroInStandbyPerAssenza(options) {
  const {
    lavoroId,
    operaioId,
    tipoAssenza,
    nota = '',
    managerId,
    assenzaId: existingAssenzaId,
    giornoKey = toGiornoKey(new Date()),
    tenantId = null,
    assenzaGiaConfermata = false
  } = options;

  if (!lavoroId || !operaioId || !managerId) {
    throw new Error('lavoroId, operaioId e managerId obbligatori');
  }

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');

  if (lavoro.stato === 'in_standby') {
    throw new Error('Il lavoro è già in standby');
  }
  if (!LAVORO_STATI_STANDBY_AMMESSI.includes(lavoro.stato)) {
    throw new Error(
      `Standby non consentito dallo stato attuale (${lavoro.stato || 'n/d'}). Usa sospensione per altri casi.`
    );
  }

  let assenzaId = existingAssenzaId;
  if (assenzaId) {
    if (!assenzaGiaConfermata) {
      await confermaAssenza(assenzaId, managerId, tenantId);
    }
  } else {
    assenzaId = await creaAssenzaConfermata(
      {
        operaioId,
        tipo: tipoAssenza,
        dataInizioGiorno: giornoKey,
        dataFineGiorno: giornoKey,
        nota,
        lavoroId,
        confermatoDa: managerId,
        canale: 'manager'
      },
      tenantId
    );
  }

  await updateLavoro(
    lavoroId,
    {
      stato: 'in_standby',
      standbyStatoPrecedente: lavoro.stato,
      standbyCausa: LAVORO_STAND_BY_CAUSA_ASSENZA,
      standbyAssenzaId: assenzaId,
      standbyOperaioId: operaioId,
      standbyDaIl: serverTimestamp(),
      standbyNota: (nota || '').trim(),
      standbyGiornoKey: giornoKey
    }
  );

  const effectiveTenantId = tenantId || (await import('./tenant-service.js')).getCurrentTenantId();
  if (effectiveTenantId && (lavoro.macchinaId || lavoro.attrezzoId)) {
    const { liberaMacchineDaLavoro } = await import('./lavoro-macchine-lifecycle.js');
    await liberaMacchineDaLavoro(
      { id: lavoroId, macchinaId: lavoro.macchinaId, attrezzoId: lavoro.attrezzoId },
      { tenantId: effectiveTenantId }
    );
  }

  await collegaAssenzaALavoroStandby(assenzaId, lavoroId, tenantId);

  return { assenzaId, lavoroId };
}

/**
 * Ripristina stato precedente al standby (senza cancellare l'assenza storica).
 * @param {string} lavoroId
 * @param {string} managerId
 * @param {string} [tenantId]
 */
export async function riportaLavoroDaStandbyAssenza(lavoroId, managerId, tenantId = null) {
  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) throw new Error('Lavoro non trovato');
  if (lavoro.stato !== 'in_standby') {
    throw new Error('Il lavoro non è in standby');
  }
  if (lavoro.standbyCausa && lavoro.standbyCausa !== LAVORO_STAND_BY_CAUSA_ASSENZA) {
    throw new Error('Standby non legato ad assenza');
  }

  const restore =
    lavoro.standbyStatoPrecedente && LAVORO_STATI_STANDBY_AMMESSI.includes(lavoro.standbyStatoPrecedente)
      ? lavoro.standbyStatoPrecedente
      : 'assegnato';

  await updateLavoro(
    lavoroId,
    {
      stato: restore,
      standbyStatoPrecedente: null,
      standbyCausa: null,
      standbyAssenzaId: null,
      standbyOperaioId: null,
      standbyDaIl: null,
      standbyNota: null,
      standbyGiornoKey: null,
      standbyRipristinatoDa: managerId,
      standbyRipristinatoIl: serverTimestamp()
    }
  );
}

/**
 * Conferma l'assenza una volta e mette in standby solo i lavori scelti, anche nessuno.
 * @param {{ assenzaId: string, lavoroIds?: string[], managerId: string, tenantId?: string|null }} options
 * @returns {Promise<{ assenzaId: string, lavoroIds: string[] }>}
 */
export async function confermaAssenzaConStandbyLavori(options) {
  const { assenzaId, lavoroIds, managerId, tenantId = null } = options || {};
  if (!assenzaId || !managerId) {
    throw new Error('assenzaId e managerId obbligatori');
  }
  const assenza = await getAssenza(assenzaId, tenantId);
  if (!assenza) throw new Error('Segnalazione assenza non trovata');
  await confermaAssenza(assenzaId, managerId, tenantId);
  const ids = [];
  (Array.isArray(lavoroIds) ? lavoroIds : []).forEach((id) => {
    if (id == null || String(id) === '') return;
    const testo = String(id);
    if (!ids.includes(testo)) ids.push(testo);
  });
  for (const lavoroId of ids) {
    await mettiLavoroInStandbyPerAssenza({
      lavoroId,
      operaioId: assenza.operaioId,
      tipoAssenza: assenza.tipo,
      nota: assenza.nota,
      managerId,
      assenzaId,
      giornoKey: assenza.dataInizioGiorno,
      tenantId,
      assenzaGiaConfermata: true
    });
  }
  return { assenzaId, lavoroIds: ids };
}

export async function confermaSegnalazioneEStandby(options) {
  const { assenzaId, lavoroId, managerId, tenantId } = options;
  const assenza = await getAssenza(assenzaId, tenantId);
  if (!assenza) throw new Error('Segnalazione assenza non trovata');
  return mettiLavoroInStandbyPerAssenza({
    lavoroId,
    operaioId: assenza.operaioId,
    tipoAssenza: assenza.tipo,
    nota: assenza.nota,
    managerId,
    assenzaId,
    giornoKey: assenza.dataInizioGiorno,
    tenantId
  });
}

export { segnalaAssenza };
