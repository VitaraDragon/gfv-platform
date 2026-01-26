/**
 * Pianificazione Impianto Service - Servizio per gestione pianificazioni nuovi impianti
 * Gestisce CRUD pianificazioni con supporto multi-tenant
 * 
 * @module modules/vigneto/services/pianificazione-impianto-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { PianificazioneImpianto } from '../models/PianificazioneImpianto.js';

const COLLECTION_NAME = 'pianificazioni-impianti';

/**
 * Ottieni tutte le pianificazioni del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'createdAt')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.terrenoId - Filtra per terreno (opzionale)
 * @param {string} options.tipoColtura - Filtra per tipo coltura (opzionale)
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @returns {Promise<Array<PianificazioneImpianto>>} Array di pianificazioni
 */
export async function getAllPianificazioni(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'createdAt',
      orderDirection = 'desc',
      terrenoId = null,
      tipoColtura = null,
      stato = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (terrenoId) {
      whereFilters.push(['terrenoId', '==', terrenoId]);
    }
    if (tipoColtura) {
      whereFilters.push(['tipoColtura', '==', tipoColtura]);
    }
    if (stato) {
      whereFilters.push(['stato', '==', stato]);
    }
    
    let documents;
    try {
      // Prova prima con ordinamento
      documents = await getCollectionData(COLLECTION_NAME, {
        tenantId,
        orderBy,
        orderDirection,
        where: whereFilters.length > 0 ? whereFilters : undefined
      });
    } catch (indexError) {
      // Se l'errore è per indice mancante, prova senza ordinamento e ordina in memoria
      if (indexError.message && indexError.message.includes('index')) {
        documents = await getCollectionData(COLLECTION_NAME, {
          tenantId,
          where: whereFilters.length > 0 ? whereFilters : undefined
        });
        
        // Ordina in memoria
        documents.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return orderDirection === 'desc' ? dateB - dateA : dateA - dateB;
        });
      } else {
        // Se non è un errore di indice, rilancia
        throw indexError;
      }
    }
    
    const pianificazioni = documents.map((doc) => {
      return PianificazioneImpianto.fromData(doc);
    });
    
    return pianificazioni;
  } catch (error) {
    console.error('[PIANIFICAZIONE-IMPIANTO-SERVICE] Errore recupero pianificazioni:', error);
    // Errori critici -> lancia eccezione
    if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
      throw new Error(`Errore recupero pianificazioni: ${error.message}`);
    }
    // Errori non critici -> ritorna array vuoto
    return [];
  }
}

/**
 * Ottieni una pianificazione per ID
 * @param {string} pianificazioneId - ID pianificazione
 * @returns {Promise<PianificazioneImpianto|null>} Pianificazione o null se non trovata
 */
export async function getPianificazione(pianificazioneId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!pianificazioneId) {
      throw new Error('ID pianificazione obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, pianificazioneId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return PianificazioneImpianto.fromData(data);
  } catch (error) {
    console.error('Errore recupero pianificazione:', error);
    throw new Error(`Errore recupero pianificazione: ${error.message}`);
  }
}

/**
 * Crea una nuova pianificazione
 * @param {Object} pianificazioneData - Dati pianificazione
 * @param {string} pianificazioneData.terrenoId - Riferimento terreno (obbligatorio)
 * @param {string} pianificazioneData.tipoColtura - Tipo coltura (obbligatorio)
 * @param {number} pianificazioneData.distanzaFile - Distanza tra file in metri (obbligatorio)
 * @param {number} pianificazioneData.distanzaUnita - Distanza tra unità in metri (obbligatorio)
 * @param {number} pianificazioneData.angoloRotazione - Angolo rotazione in gradi (opzionale)
 * @param {number} pianificazioneData.larghezzaCarraie - Larghezza carraie in metri (opzionale)
 * @param {string} pianificazioneData.creatoDa - ID utente creatore (opzionale)
 * @returns {Promise<string>} ID pianificazione creata
 */
export async function createPianificazione(pianificazioneData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const pianificazione = new PianificazioneImpianto(pianificazioneData);
    
    // Validazione
    const validation = pianificazione.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Converti in formato Firestore
    const firestoreData = pianificazione.toFirestore();
    
    // Aggiungi timestamp creazione
    firestoreData.createdAt = new Date();
    firestoreData.updatedAt = new Date();
    
    // Crea documento
    const docId = await createDocument(COLLECTION_NAME, firestoreData, tenantId);
    
    return docId;
  } catch (error) {
    console.error('Errore creazione pianificazione:', error);
    throw new Error(`Errore creazione pianificazione: ${error.message}`);
  }
}

/**
 * Aggiorna una pianificazione esistente
 * @param {string} pianificazioneId - ID pianificazione
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updatePianificazione(pianificazioneId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!pianificazioneId) {
      throw new Error('ID pianificazione obbligatorio');
    }
    
    // Recupera pianificazione esistente
    const pianificazione = await getPianificazione(pianificazioneId);
    if (!pianificazione) {
      throw new Error('Pianificazione non trovata');
    }
    
    // Applica aggiornamenti
    Object.assign(pianificazione, updates);
    
    // Validazione
    const validation = pianificazione.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Converti in formato Firestore
    const firestoreData = pianificazione.toFirestore();
    
    // Aggiorna timestamp
    firestoreData.updatedAt = new Date();
    
    // Aggiorna documento
    await updateDocument(COLLECTION_NAME, pianificazioneId, firestoreData, tenantId);
  } catch (error) {
    console.error('Errore aggiornamento pianificazione:', error);
    throw new Error(`Errore aggiornamento pianificazione: ${error.message}`);
  }
}

/**
 * Elimina una pianificazione
 * @param {string} pianificazioneId - ID pianificazione
 * @returns {Promise<void>}
 */
export async function deletePianificazione(pianificazioneId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!pianificazioneId) {
      throw new Error('ID pianificazione obbligatorio');
    }
    
    await deleteDocument(COLLECTION_NAME, pianificazioneId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione pianificazione:', error);
    throw new Error(`Errore eliminazione pianificazione: ${error.message}`);
  }
}

/**
 * Conferma una pianificazione (cambia stato da "bozza" a "confermato")
 * @param {string} pianificazioneId - ID pianificazione
 * @returns {Promise<void>}
 */
export async function confermaPianificazione(pianificazioneId) {
  try {
    await updatePianificazione(pianificazioneId, {
      stato: 'confermato',
      dataConferma: new Date()
    });
  } catch (error) {
    console.error('Errore conferma pianificazione:', error);
    throw new Error(`Errore conferma pianificazione: ${error.message}`);
  }
}

/**
 * Marca una pianificazione come impiantata (cambia stato a "impiantato")
 * @param {string} pianificazioneId - ID pianificazione
 * @returns {Promise<void>}
 */
export async function marcaImpiantato(pianificazioneId) {
  try {
    await updatePianificazione(pianificazioneId, {
      stato: 'impiantato'
    });
  } catch (error) {
    console.error('Errore marcatura impiantato:', error);
    throw new Error(`Errore marcatura impiantato: ${error.message}`);
  }
}
