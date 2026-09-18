/**
 * Preventivi Service - Servizio per gestione preventivi (conto terzi)
 * Gestisce CRUD preventivi, calcolo automatico, invio email, accettazione
 * 
 * @module modules/conto-terzi/services/preventivi-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData,
  getDocument,
  runFirestoreTransaction,
  serverTimestamp
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Preventivo } from '../models/Preventivo.js';
import { calcolaTariffaPreventivo } from './tariffe-service.js';
import { getCliente } from './clienti-service.js';
import {
  PREVENTIVO_SEQ_FIELD,
  preventivoAnnoCorrente,
  formatPreventivoNumero,
  maxSeqFromNumeri,
  nextPreventivoSeq,
  decideTransizionePreventivo,
  firestoreSnapExists
} from './preventivo-lock-utils.js';

const COLLECTION_NAME = 'preventivi';

function snapData(snap) {
  if (!snap) return {};
  if (typeof snap.data === 'function') return snap.data() || {};
  return {};
}

/**
 * Alloca il prossimo numero preventivo in transazione sul documento tenant
 * (`preventivoSeqByYear.{anno}`). Due create concorrenti non prendono lo stesso PREV-anno-NNN.
 * @param {string|null} tenantId
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
export async function allocatePreventivoNumero(tenantId = null, now = new Date()) {
  const id = tenantId || getCurrentTenantId();
  if (!id) {
    throw new Error('Nessun tenant corrente disponibile');
  }

  const anno = preventivoAnnoCorrente(now);
  const prefisso = `PREV-${anno}-`;
  let maxExisting = 0;
  try {
    const preventivi = await getCollectionData(COLLECTION_NAME, {
      tenantId: id,
      where: [['numero', '>=', prefisso], ['numero', '<', `${prefisso}Z`]]
    });
    maxExisting = maxSeqFromNumeri((preventivi || []).map((p) => p.numero), anno);
  } catch (error) {
    console.warn('[preventivi] query sequenza esistenti:', error && error.message);
  }

  const tenantRef = getDocument('tenants', id);
  return runFirestoreTransaction(async (transaction) => {
    const snap = await transaction.get(tenantRef);
    if (!firestoreSnapExists(snap)) {
      throw new Error('Tenant non trovato');
    }
    const data = snapData(snap);
    const storedMap = data[PREVENTIVO_SEQ_FIELD] || {};
    const stored = storedMap[String(anno)] ?? storedMap[anno] ?? 0;
    const next = nextPreventivoSeq(stored, maxExisting);
    transaction.update(tenantRef, {
      [`${PREVENTIVO_SEQ_FIELD}.${anno}`]: next,
      updatedAt: serverTimestamp()
    });
    return formatPreventivoNumero(anno, next);
  });
}

/**
 * @returns {Promise<string>}
 */
async function generaNumeroPreventivo() {
  return allocatePreventivoNumero();
}

/**
 * Accetta/rifiuta in transazione: secondo writer concorrente vede lo stato già cambiato e fallisce.
 * Non passa da updatePreventivo (gate solo bozza/annullato).
 * @param {string} preventivoId
 * @param {'accetta'|'rifiuta'} azione
 * @param {string} [metodo]
 * @returns {Promise<Object>}
 */
export async function transizionaStatoPreventivo(preventivoId, azione, metodo = 'manager') {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error('Nessun tenant corrente disponibile');
  }
  if (!preventivoId) {
    throw new Error('ID preventivo obbligatorio');
  }

  const prevRef = getDocument(COLLECTION_NAME, preventivoId, tenantId);
  return runFirestoreTransaction(async (transaction) => {
    const snap = await transaction.get(prevRef);
    if (!firestoreSnapExists(snap)) {
      throw new Error('Preventivo non trovato');
    }
    const data = snapData(snap);
    const decision = decideTransizionePreventivo(data.stato, data.dataScadenza, azione, metodo);
    if (!decision.ok) {
      throw new Error(decision.reason);
    }
    const patch = { ...decision.patch, updatedAt: serverTimestamp() };
    if (Object.prototype.hasOwnProperty.call(patch, 'dataAccettazione')) {
      patch.dataAccettazione = serverTimestamp();
    }
    transaction.update(prevRef, patch);
    return {
      ...data,
      id: preventivoId,
      stato: decision.patch.stato,
      dataAccettazione: decision.patch.dataAccettazione || data.dataAccettazione || null
    };
  });
}

/**
 * Ottieni tutti i preventivi del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'numero')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @param {string} options.clienteId - Filtra per cliente (opzionale)
 * @returns {Promise<Array<Preventivo>>} Array di preventivi
 */
export async function getAllPreventivi(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'numero', 
      orderDirection = 'desc',
      stato = null,
      clienteId = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (stato) {
      whereFilters.push(['stato', '==', stato]);
    }
    if (clienteId) {
      whereFilters.push(['clienteId', '==', clienteId]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => Preventivo.fromData(doc));
  } catch (error) {
    console.error('Errore recupero preventivi:', error);
    throw new Error(`Errore recupero preventivi: ${error.message}`);
  }
}

/**
 * Ottieni un preventivo per ID
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<Preventivo|null>} Preventivo o null se non trovato
 */
export async function getPreventivo(preventivoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, preventivoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Preventivo.fromData(data);
  } catch (error) {
    console.error('Errore recupero preventivo:', error);
    throw new Error(`Errore recupero preventivo: ${error.message}`);
  }
}

/**
 * Ottieni preventivo per token accettazione (per link email)
 * @param {string} token - Token accettazione
 * @returns {Promise<Preventivo|null>} Preventivo o null se non trovato
 */
export async function getPreventivoByToken(token) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!token) {
      throw new Error('Token obbligatorio');
    }
    
    const preventivi = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: [['tokenAccettazione', '==', token]]
    });
    
    if (preventivi.length === 0) {
      return null;
    }
    
    return Preventivo.fromData(preventivi[0]);
  } catch (error) {
    console.error('Errore recupero preventivo per token:', error);
    return null;
  }
}

/**
 * Calcola totale preventivo automaticamente usando tariffe
 * @param {Object} preventivoData - Dati preventivo
 * @returns {Promise<number>} Totale calcolato
 */
export async function calcolaTotalePreventivo(preventivoData) {
  try {
    const { tipoLavoro, coltura, tipoCampo, superficie } = preventivoData;
    
    if (!tipoLavoro || !coltura || !tipoCampo || !superficie || superficie <= 0) {
      return 0;
    }
    
    // Calcola usando tariffe
    const totale = await calcolaTariffaPreventivo(tipoLavoro, coltura, tipoCampo, superficie);
    
    // TODO: Aggiungere costi macchina e manodopera se specificati
    
    return totale;
  } catch (error) {
    console.error('Errore calcolo totale preventivo:', error);
    return 0;
  }
}

/**
 * Crea un nuovo preventivo
 * @param {Object} preventivoData - Dati preventivo
 * @param {boolean} calcolaAutomatico - Se true, calcola totale automaticamente (default: true)
 * @returns {Promise<string>} ID preventivo creato
 */
export async function createPreventivo(preventivoData, calcolaAutomatico = true) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Genera numero preventivo
    const numero = await generaNumeroPreventivo();
    
    // Calcola totale se richiesto
    let totale = preventivoData.totale || 0;
    if (calcolaAutomatico) {
      totale = await calcolaTotalePreventivo(preventivoData);
    }
    
    // Genera token accettazione
    const tokenAccettazione = Preventivo.generateToken();
    
    // Calcola data scadenza (default: +30 giorni)
    const giorniScadenza = preventivoData.giorniScadenza || 30;
    const dataScadenza = new Date();
    dataScadenza.setDate(dataScadenza.getDate() + giorniScadenza);
    
    const preventivo = new Preventivo({
      ...preventivoData,
      numero,
      totale,
      tokenAccettazione,
      dataScadenza,
      stato: preventivoData.stato || 'bozza'
    });
    
    // Valida
    const validation = preventivo.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const preventivoId = await createDocument(COLLECTION_NAME, preventivo.toFirestore(), tenantId);
    
    return preventivoId;
  } catch (error) {
    console.error('Errore creazione preventivo:', error);
    throw new Error(`Errore creazione preventivo: ${error.message}`);
  }
}

/**
 * Aggiorna un preventivo esistente
 * @param {string} preventivoId - ID preventivo
 * @param {Object} updates - Dati da aggiornare
 * @param {boolean} ricalcolaTotale - Se true, ricalcola totale (default: false)
 * @returns {Promise<void>}
 */
export async function updatePreventivo(preventivoId, updates, ricalcolaTotale = false) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    // Carica preventivo esistente
    const preventivoEsistente = await getPreventivo(preventivoId);
    if (!preventivoEsistente) {
      throw new Error('Preventivo non trovato');
    }
    
    // Verifica se preventivo può essere modificato (solo bozza)
    if (preventivoEsistente.stato !== 'bozza' && preventivoEsistente.stato !== 'annullato') {
      throw new Error('Preventivo non modificabile. Solo preventivi in stato "bozza" o "annullato" possono essere modificati.');
    }
    
    // Ricalcola totale se richiesto
    if (ricalcolaTotale) {
      const datiPerCalcolo = {
        ...preventivoEsistente,
        ...updates
      };
      updates.totale = await calcolaTotalePreventivo(datiPerCalcolo);
    }
    
    // Aggiorna con nuovi dati
    preventivoEsistente.update(updates);
    
    // Valida
    const validation = preventivoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, preventivoId, preventivoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento preventivo:', error);
    throw new Error(`Errore aggiornamento preventivo: ${error.message}`);
  }
}

/**
 * Invia preventivo via email (placeholder - da implementare)
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function inviaPreventivoEmail(preventivoId) {
  try {
    const preventivo = await getPreventivo(preventivoId);
    if (!preventivo) {
      throw new Error('Preventivo non trovato');
    }
    
    // Carica dati cliente
    const cliente = await getCliente(preventivo.clienteId);
    if (!cliente || !cliente.email) {
      throw new Error('Cliente non trovato o email non disponibile');
    }
    
    // TODO: Implementare invio email reale
    // Per ora aggiorna solo lo stato
    await updatePreventivo(preventivoId, {
      stato: 'inviato',
      dataInvio: new Date()
    });
    
    console.log(`📧 Preventivo ${preventivo.numero} inviato a ${cliente.email}`);
    // TODO: Inviare email con link accettazione/rifiuto
  } catch (error) {
    console.error('Errore invio preventivo:', error);
    throw new Error(`Errore invio preventivo: ${error.message}`);
  }
}

/**
 * Accetta preventivo (via email o manager)
 * @param {string} preventivoId - ID preventivo
 * @param {string} metodo - 'email' | 'manager'
 * @returns {Promise<void>}
 */
export async function accettaPreventivo(preventivoId, metodo = 'manager') {
  try {
    const preventivoAggiornato = await transizionaStatoPreventivo(preventivoId, 'accetta', metodo);
    let syncResult = null;
    try {
      const { syncPreventivoAccettatoToPiano } = await import('../../vendemmia-meccanica/services/preventivo-piano-sync-service.js');
      syncResult = await syncPreventivoAccettatoToPiano(preventivoAggiornato);
    } catch (syncErr) {
      console.warn('[VM] sync piano da preventivo accettato:', syncErr.message);
    }
    return { preventivo: preventivoAggiornato, syncResult };
  } catch (error) {
    console.error('Errore accettazione preventivo:', error);
    throw new Error(`Errore accettazione preventivo: ${error.message}`);
  }
}

/**
 * Rifiuta preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function rifiutaPreventivo(preventivoId) {
  try {
    await transizionaStatoPreventivo(preventivoId, 'rifiuta');
  } catch (error) {
    console.error('Errore rifiuto preventivo:', error);
    throw new Error(`Errore rifiuto preventivo: ${error.message}`);
  }
}

/**
 * Annulla preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function annullaPreventivo(preventivoId) {
  try {
    await updatePreventivo(preventivoId, {
      stato: 'annullato'
    });
  } catch (error) {
    console.error('Errore annullamento preventivo:', error);
    throw new Error(`Errore annullamento preventivo: ${error.message}`);
  }
}

/**
 * Elimina un preventivo
 * @param {string} preventivoId - ID preventivo
 * @returns {Promise<void>}
 */
export async function deletePreventivo(preventivoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!preventivoId) {
      throw new Error('ID preventivo obbligatorio');
    }
    
    // Verifica se preventivo ha lavoro associato
    const preventivo = await getPreventivo(preventivoId);
    if (preventivo && preventivo.lavoroId) {
      throw new Error('Impossibile eliminare: preventivo ha un lavoro associato');
    }
    
    await deleteDocument(COLLECTION_NAME, preventivoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione preventivo:', error);
    throw new Error(`Errore eliminazione preventivo: ${error.message}`);
  }
}

/**
 * Verifica preventivi scaduti e aggiorna stato
 * @returns {Promise<number>} Numero preventivi aggiornati
 */
export async function verificaPreventiviScaduti() {
  try {
    const preventivi = await getAllPreventivi({ stato: 'inviato' });
    let aggiornati = 0;
    
    for (const preventivo of preventivi) {
      if (preventivo.isScaduto()) {
        await updatePreventivo(preventivo.id, { stato: 'scaduto' });
        aggiornati++;
      }
    }
    
    return aggiornati;
  } catch (error) {
    console.error('Errore verifica preventivi scaduti:', error);
    return 0;
  }
}

// Export default
export default {
  getAllPreventivi,
  getPreventivo,
  getPreventivoByToken,
  calcolaTotalePreventivo,
  createPreventivo,
  updatePreventivo,
  inviaPreventivoEmail,
  allocatePreventivoNumero,
  transizionaStatoPreventivo,
  accettaPreventivo,
  rifiutaPreventivo,
  annullaPreventivo,
  deletePreventivo,
  verificaPreventiviScaduti
};











