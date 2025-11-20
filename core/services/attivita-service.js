/**
 * Attivita Service - Servizio per gestione attività
 * Gestisce CRUD attività con supporto multi-tenant e filtri
 * 
 * @module core/services/attivita-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { Attivita } from '../models/Attivita.js';

const COLLECTION_NAME = 'attivita';

/**
 * Ottieni tutte le attività del tenant corrente con filtri opzionali
 * @param {Object} filters - Filtri opzionali
 * @param {string} filters.terrenoId - Filtra per terreno
 * @param {string} filters.tipoLavoro - Filtra per tipo lavoro
 * @param {string} filters.coltura - Filtra per coltura
 * @param {string} filters.dataDa - Data inizio periodo (YYYY-MM-DD)
 * @param {string} filters.dataA - Data fine periodo (YYYY-MM-DD)
 * @param {string} filters.searchText - Ricerca testuale nelle note
 * @param {string} filters.orderBy - Campo per ordinamento (default: 'data')
 * @param {string} filters.orderDirection - Direzione ordinamento ('asc' | 'desc', default: 'desc')
 * @returns {Promise<Array<Attivita>>} Array di attività
 */
export async function getAllAttivita(filters = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const {
      terrenoId,
      tipoLavoro,
      coltura,
      dataDa,
      dataA,
      searchText,
      orderBy = 'data',
      orderDirection = 'desc'
    } = filters;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (terrenoId) {
      whereFilters.push(['terrenoId', '==', terrenoId]);
    }
    if (tipoLavoro) {
      whereFilters.push(['tipoLavoro', '==', tipoLavoro]);
    }
    if (coltura) {
      whereFilters.push(['coltura', '==', coltura]);
    }
    if (dataDa) {
      whereFilters.push(['data', '>=', dataDa]);
    }
    if (dataA) {
      whereFilters.push(['data', '<=', dataA]);
    }
    
    // Recupera documenti
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      where: whereFilters,
      orderBy,
      orderDirection
    });
    
    // Converti in modelli
    let attivita = documents.map(doc => Attivita.fromData(doc));
    
    // Filtro ricerca testuale (lato client, non supportato da Firestore per array)
    if (searchText && searchText.trim().length > 0) {
      const searchLower = searchText.toLowerCase();
      attivita = attivita.filter(att => {
        return att.note && att.note.toLowerCase().includes(searchLower);
      });
    }
    
    return attivita;
  } catch (error) {
    console.error('Errore recupero attività:', error);
    throw new Error(`Errore recupero attività: ${error.message}`);
  }
}

/**
 * Ottieni un'attività per ID
 * @param {string} attivitaId - ID attività
 * @returns {Promise<Attivita|null>} Attività o null se non trovata
 */
export async function getAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!attivitaId) {
      throw new Error('ID attività obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, attivitaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Attivita.fromData(data);
  } catch (error) {
    console.error('Errore recupero attività:', error);
    throw new Error(`Errore recupero attività: ${error.message}`);
  }
}

/**
 * Crea una nuova attività
 * @param {Object} attivitaData - Dati attività
 * @param {string} attivitaData.data - Data attività (YYYY-MM-DD)
 * @param {string} attivitaData.terrenoId - ID terreno (obbligatorio)
 * @param {string} attivitaData.terrenoNome - Nome terreno (obbligatorio)
 * @param {string} attivitaData.tipoLavoro - Tipo lavoro (obbligatorio)
 * @param {string} attivitaData.coltura - Coltura (obbligatorio)
 * @param {string} attivitaData.orarioInizio - Orario inizio (HH:MM)
 * @param {string} attivitaData.orarioFine - Orario fine (HH:MM)
 * @param {number} attivitaData.pauseMinuti - Minuti di pausa
 * @param {string} attivitaData.note - Note opzionali
 * @returns {Promise<string>} ID attività creata
 */
export async function createAttivita(attivitaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const attivita = new Attivita(attivitaData);
    
    // Valida
    const validation = attivita.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const attivitaId = await createDocument(COLLECTION_NAME, attivita.toFirestore(), tenantId);
    
    return attivitaId;
  } catch (error) {
    console.error('Errore creazione attività:', error);
    throw new Error(`Errore creazione attività: ${error.message}`);
  }
}

/**
 * Aggiorna un'attività esistente
 * @param {string} attivitaId - ID attività
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateAttivita(attivitaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!attivitaId) {
      throw new Error('ID attività obbligatorio');
    }
    
    // Carica attività esistente
    const attivitaEsistente = await getAttivita(attivitaId);
    if (!attivitaEsistente) {
      throw new Error('Attività non trovata');
    }
    
    // Aggiorna con nuovi dati
    attivitaEsistente.update(updates);
    
    // Se orari sono stati aggiornati, ricalcola ore nette
    if (updates.orarioInizio || updates.orarioFine || updates.pauseMinuti !== undefined) {
      attivitaEsistente.oreNette = attivitaEsistente.calculateOreNette();
    }
    
    // Valida
    const validation = attivitaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, attivitaId, attivitaEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento attività:', error);
    throw new Error(`Errore aggiornamento attività: ${error.message}`);
  }
}

/**
 * Elimina un'attività
 * @param {string} attivitaId - ID attività
 * @returns {Promise<void>}
 */
export async function deleteAttivita(attivitaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!attivitaId) {
      throw new Error('ID attività obbligatorio');
    }
    
    await deleteDocument(COLLECTION_NAME, attivitaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione attività:', error);
    throw new Error(`Errore eliminazione attività: ${error.message}`);
  }
}

/**
 * Calcola ore nette da orari e pause
 * @param {string} orarioInizio - Orario inizio (HH:MM)
 * @param {string} orarioFine - Orario fine (HH:MM)
 * @param {number} pauseMinuti - Minuti di pausa
 * @returns {number} Ore nette (in ore decimali)
 */
export function calculateOreNette(orarioInizio, orarioFine, pauseMinuti = 0) {
  const attivita = new Attivita({
    orarioInizio,
    orarioFine,
    pauseMinuti
  });
  
  return attivita.calculateOreNette();
}

// Export default
export default {
  getAllAttivita,
  getAttivita,
  createAttivita,
  updateAttivita,
  deleteAttivita,
  calculateOreNette
};





