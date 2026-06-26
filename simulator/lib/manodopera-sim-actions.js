/**
 * Azioni manodopera lato simulatore con permessi ruolo (v2).
 * Replica regole di segnatura-ore + validazione-ore + manodopera-ore-validazione-scope.
 * Scritture Admin SDK solo dopo assert permessi — mai “numeri inventati dal manager”.
 * @module simulator/lib/manodopera-sim-actions
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  assertUtentePuoValidareOra,
  isOraDelCaposquadraSuLavoroSquadra
} from '../../core/services/manodopera-ore-validazione-scope.js';
import {
  getActingUserData,
  canSignOwnHours,
  isCaposquadraPersona,
  isManagerPersona,
  isOperaioPersona
} from './run-as-persona.js';
import { requireSimTenantId } from './sim-context.js';
import { normalizeDestinatariIds } from '../../core/services/comunicazioni-squadra-utils.js';
import {
  ASSENZA_STATO_SEGNALATA,
  ASSENZA_STATO_CONFERMATA,
  ASSENZA_CANALE_CAPOSQUADRA,
  LAVORO_STAND_BY_CAUSA_ASSENZA,
  LAVORO_STATI_STANDBY_AMMESSI,
  toGiornoKey
} from '../../core/config/manodopera-assenze-config.js';

const TIPI_ASSENZA_VALIDI = new Set([
  'malattia',
  'ferie',
  'permesso',
  'infortunio',
  'non_presenza',
  'altro'
]);

function calcolaOreNette(orarioInizio, orarioFine, pauseMinuti) {
  const [hi, mi] = orarioInizio.split(':').map(Number);
  const [hf, mf] = orarioFine.split(':').map(Number);
  const diff = hf * 60 + mf - (hi * 60 + mi) - pauseMinuti;
  return Math.max(0, parseFloat((diff / 60).toFixed(2)));
}

function assertOrarioValido(orarioInizio, orarioFine, pauseMinuti) {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(orarioInizio) || !timeRegex.test(orarioFine)) {
    throw new Error('Formato orario non valido (usa HH:MM)');
  }
  const [hi, mi] = orarioInizio.split(':').map(Number);
  const [hf, mf] = orarioFine.split(':').map(Number);
  const inizio = hi * 60 + mi;
  const fine = hf * 60 + mf;
  if (fine <= inizio) throw new Error('Orario fine deve essere maggiore di orario inizio');
  if (pauseMinuti < 0) throw new Error('Pause non possono essere negative');
  if (pauseMinuti >= fine - inizio) {
    throw new Error('Pause non possono essere maggiori o uguali al tempo di lavoro');
  }
}

/**
 * Segna ore proprie (operaio o caposquadra) — equivalente segnatura-ore.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} lavoroId
 * @param {object} oraData
 * @param {string} oraData.operaioId
 * @param {Date|string} oraData.data
 * @param {string} oraData.orarioInizio
 * @param {string} oraData.orarioFine
 * @param {number} [oraData.pauseMinuti]
 * @param {string} [oraData.note]
 * @returns {Promise<string>} id documento oreOperai
 */
export async function segnaOraSim(db, lavoroId, oraData) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();

  if (!canSignOwnHours(user)) {
    throw new Error('Solo operai o caposquadra possono segnare ore');
  }
  if (!lavoroId) throw new Error('ID lavoro obbligatorio');

  const operaioId = oraData.operaioId;
  const userId = user.id || user.uid;
  if (!operaioId || operaioId !== userId) {
    throw new Error('Puoi segnare solo le tue ore');
  }

  const { data, orarioInizio, orarioFine, pauseMinuti = 0, note = '' } = oraData;
  if (!data) throw new Error('Data obbligatoria');
  if (!orarioInizio || !orarioFine) throw new Error('Orario inizio e fine obbligatori');
  assertOrarioValido(orarioInizio, orarioFine, pauseMinuti);

  const lavoroRef = db.doc(`tenants/${tenantId}/lavori/${lavoroId}`);
  const lavoroSnap = await lavoroRef.get();
  if (!lavoroSnap.exists) throw new Error('Lavoro non trovato');
  const lavoroData = lavoroSnap.data();

  const dataDate = data instanceof Date ? data : new Date(data);
  const oreNette = calcolaOreNette(orarioInizio, orarioFine, pauseMinuti);

  const payload = {
    operaioId,
    lavoroId,
    terrenoId: lavoroData.terrenoId || null,
    data: dataDate,
    orarioInizio,
    orarioFine,
    pauseMinuti,
    oreNette,
    note: note || '',
    stato: 'da_validare',
    creatoIl: FieldValue.serverTimestamp(),
    simSegnatoDa: userId
  };

  const ref = await lavoroRef.collection('oreOperai').add(payload);
  return ref.id;
}

/**
 * Valida un'ora (caposquadra su operai squadra, manager su autonomi + ore capo).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} lavoroId
 * @param {string} oraId
 */
export async function validaOraSim(db, lavoroId, oraId) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();
  const userId = user.id || user.uid;
  const isCaposquadra = isCaposquadraPersona(user);
  const isManager = isManagerPersona(user);

  if (!isCaposquadra && !isManager) {
    throw new Error('Solo caposquadra o manager possono validare ore');
  }
  if (!lavoroId || !oraId) throw new Error('ID lavoro e ora obbligatori');

  const lavoroRef = db.doc(`tenants/${tenantId}/lavori/${lavoroId}`);
  const oraRef = lavoroRef.collection('oreOperai').doc(oraId);
  const [lavoroSnap, oraSnap] = await Promise.all([lavoroRef.get(), oraRef.get()]);

  if (!lavoroSnap.exists) throw new Error('Lavoro non trovato');
  if (!oraSnap.exists) throw new Error('Ora non trovata');

  const lavoroData = lavoroSnap.data();
  const oraData = oraSnap.data();
  if (oraData.stato !== 'da_validare') {
    throw new Error('Questa ora è già stata validata o rifiutata');
  }

  if (isCaposquadra && !isManager) {
    if (lavoroData.caposquadraId !== userId) {
      throw new Error('Non sei il caposquadra assegnato a questo lavoro');
    }
    if (isOraDelCaposquadraSuLavoroSquadra(oraData, lavoroData)) {
      throw new Error('Le ore del caposquadra sono validate dal manager');
    }
  } else {
    assertUtentePuoValidareOra({
      oraData,
      lavoroData,
      userId,
      isCaposquadra,
      isManager
    });
  }

  await oraRef.update({
    stato: 'validate',
    validatoDa: userId,
    validatoIl: FieldValue.serverTimestamp(),
    rifiutatoDa: null,
    motivoRifiuto: null
  });
}

/**
 * Invia comunicazione squadra (solo caposquadra assegnato al lavoro).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} lavoroId
 * @param {{ messaggio: string, data: Date|string, orario?: string, destinatari: string[] }} commData
 * @returns {Promise<string>} id documento comunicazioni
 */
export async function inviaComunicazioneSim(db, lavoroId, commData) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();
  const userId = user.id || user.uid;

  if (!isCaposquadraPersona(user)) {
    throw new Error('Solo caposquadra può inviare comunicazioni alla squadra');
  }
  if (!lavoroId) throw new Error('ID lavoro obbligatorio');

  const { messaggio, data, orario = '07:30', destinatari } = commData;
  if (!messaggio || !String(messaggio).trim()) {
    throw new Error('Messaggio comunicazione obbligatorio');
  }
  if (!data) throw new Error('Data comunicazione obbligatoria');
  const destIds = normalizeDestinatariIds(destinatari);
  if (!destIds.length) {
    throw new Error('Almeno un destinatario operaio obbligatorio');
  }

  const lavoroRef = db.doc(`tenants/${tenantId}/lavori/${lavoroId}`);
  const lavoroSnap = await lavoroRef.get();
  if (!lavoroSnap.exists) throw new Error('Lavoro non trovato');
  const lavoroData = lavoroSnap.data();
  if (lavoroData.caposquadraId !== userId) {
    throw new Error('Non sei il caposquadra assegnato a questo lavoro');
  }
  if (lavoroData.operaioId) {
    throw new Error('Comunicazione squadra solo su lavori con caposquadraId');
  }

  const caposquadraNome = `${user.nome || ''} ${user.cognome || ''}`.trim();
  const dataDate = data instanceof Date ? data : new Date(data);

  const ref = await db.collection(`tenants/${tenantId}/comunicazioni`).add({
    caposquadraId: userId,
    caposquadraNome: caposquadraNome || undefined,
    lavoroId,
    lavoroNome: lavoroData.nome || 'Lavoro',
    messaggio: String(messaggio).trim(),
    data: dataDate,
    orario,
    stato: 'attiva',
    conferme: [],
    destinatari: destIds,
    createdAt: FieldValue.serverTimestamp(),
    simInviataDa: userId,
    source: 'gfv_farm_simulator'
  });
  return ref.id;
}

/**
 * Conferma ricezione comunicazione (solo operaio destinatario).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} comunicazioneId
 */
export async function confermaComunicazioneSim(db, comunicazioneId) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();
  const userId = user.id || user.uid;

  if (!isOperaioPersona(user)) {
    throw new Error('Solo operai possono confermare comunicazioni ricevute');
  }
  if (!comunicazioneId) throw new Error('ID comunicazione obbligatorio');

  const ref = db.doc(`tenants/${tenantId}/comunicazioni/${comunicazioneId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Comunicazione non trovata');

  const comm = snap.data();
  if (comm.stato !== 'attiva') {
    throw new Error('Comunicazione non più attiva');
  }

  const destIds = normalizeDestinatariIds(comm.destinatari);
  if (!destIds.includes(userId)) {
    throw new Error('Non sei destinatario di questa comunicazione');
  }

  const conferme = Array.isArray(comm.conferme) ? [...comm.conferme] : [];
  if (conferme.some((c) => c && String(c.userId) === userId)) {
    return;
  }

  conferme.push({
    userId,
    timestamp: Timestamp.now(),
    simConfermatoDa: userId
  });
  await ref.update({ conferme });
}

/**
 * Caposquadra segnala assenza operaio (es. malattia) — in attesa manager.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ operaioId: string, tipo?: string, dataGiorno?: Date|string, nota?: string, lavoroId?: string|null }} payload
 * @returns {Promise<string>} assenzaId
 */
export async function segnalaAssenzaSim(db, payload) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();
  const userId = user.id || user.uid;

  if (!isCaposquadraPersona(user)) {
    throw new Error('Solo caposquadra può segnalare assenze operai');
  }

  const { operaioId, tipo = 'malattia', dataGiorno, nota = '', lavoroId = null } = payload;
  if (!operaioId) throw new Error('Operaio obbligatorio');

  const giorno = toGiornoKey(dataGiorno || new Date());
  if (!giorno) throw new Error('Data non valida');

  if (lavoroId) {
    const lavoroSnap = await db.doc(`tenants/${tenantId}/lavori/${lavoroId}`).get();
    if (!lavoroSnap.exists) throw new Error('Lavoro non trovato');
    if (lavoroSnap.data().caposquadraId !== userId) {
      throw new Error('Non sei il caposquadra assegnato a questo lavoro');
    }
  }

  const ref = await db.collection(`tenants/${tenantId}/assenzeOperai`).add({
    operaioId,
    tipo: TIPI_ASSENZA_VALIDI.has(tipo) ? tipo : 'malattia',
    stato: ASSENZA_STATO_SEGNALATA,
    dataInizioGiorno: giorno,
    dataFineGiorno: giorno,
    nota: String(nota).trim(),
    lavoroId: lavoroId || null,
    canale: ASSENZA_CANALE_CAPOSQUADRA,
    segnalatoDa: userId,
    segnalatoIl: FieldValue.serverTimestamp(),
    source: 'gfv_farm_simulator'
  });
  return ref.id;
}

/**
 * Manager conferma assenza segnalata dal caposquadra.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} assenzaId
 */
export async function confermaAssenzaSim(db, assenzaId) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();
  const userId = user.id || user.uid;

  if (!isManagerPersona(user)) {
    throw new Error('Solo manager può confermare assenze');
  }
  if (!assenzaId) throw new Error('ID assenza obbligatorio');

  const ref = db.doc(`tenants/${tenantId}/assenzeOperai/${assenzaId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Assenza non trovata');
  if (snap.data().stato !== ASSENZA_STATO_SEGNALATA) {
    throw new Error('Assenza già gestita');
  }

  await ref.update({
    stato: ASSENZA_STATO_CONFERMATA,
    confermatoDa: userId,
    confermatoIl: FieldValue.serverTimestamp()
  });
}

/**
 * Manager conferma assenza e mette il lavoro in standby (flusso Gestione lavori).
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} lavoroId
 * @param {string} assenzaId
 * @param {string} operaioId
 * @param {string} giornoKey YYYY-MM-DD
 */
export async function mettiLavoroStandbyAssenzaSim(db, lavoroId, assenzaId, operaioId, giornoKey) {
  const tenantId = requireSimTenantId();
  const user = getActingUserData();

  if (!isManagerPersona(user)) {
    throw new Error('Solo manager può mettere lavori in standby per assenza');
  }

  await confermaAssenzaSim(db, assenzaId);

  const lavoroRef = db.doc(`tenants/${tenantId}/lavori/${lavoroId}`);
  const lavoroSnap = await lavoroRef.get();
  if (!lavoroSnap.exists) throw new Error('Lavoro non trovato');
  const lavoro = lavoroSnap.data();

  if (lavoro.stato === 'in_standby') return;
  if (!LAVORO_STATI_STANDBY_AMMESSI.includes(lavoro.stato)) {
    throw new Error(`Standby non consentito dallo stato attuale (${lavoro.stato || 'n/d'})`);
  }

  await lavoroRef.update({
    stato: 'in_standby',
    standbyStatoPrecedente: lavoro.stato,
    standbyCausa: LAVORO_STAND_BY_CAUSA_ASSENZA,
    standbyAssenzaId: assenzaId,
    standbyOperaioId: operaioId,
    standbyDaIl: FieldValue.serverTimestamp(),
    standbyGiornoKey: giornoKey
  });

  await db.doc(`tenants/${tenantId}/assenzeOperai/${assenzaId}`).update({
    standbyLavoroId: lavoroId,
    lavoroId: lavoroId
  });
}
