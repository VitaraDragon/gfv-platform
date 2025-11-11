/**
 * Liste Service - Servizio per gestione liste personalizzate
 * Gestisce liste predefinite e custom per tipi lavoro e colture
 * 
 * @module core/services/liste-service
 */

import { 
  getDocumentData, 
  setDocument 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { ListePersonalizzate, TIPI_LAVORO_PREDEFINITI, COLTURE_PREDEFINITE } from '../models/ListePersonalizzate.js';

const COLLECTION_NAME = 'liste';
const DOCUMENT_ID = 'personalizzate';

/**
 * Ottieni liste personalizzate del tenant corrente
 * Se non esistono, crea con valori predefiniti
 * @returns {Promise<ListePersonalizzate>} Liste personalizzate
 */
export async function getListe() {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Prova a recuperare liste esistenti
    const data = await getDocumentData(COLLECTION_NAME, DOCUMENT_ID, tenantId);
    
    if (data) {
      return ListePersonalizzate.fromData(data);
    }
    
    // Se non esistono, crea con predefiniti
    const liste = new ListePersonalizzate({ id: DOCUMENT_ID });
    await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    
    return liste;
  } catch (error) {
    console.error('Errore recupero liste:', error);
    throw new Error(`Errore recupero liste: ${error.message}`);
  }
}

/**
 * Aggiunge un nuovo tipo lavoro (custom)
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function addTipoLavoro(tipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const liste = await getListe();
    
    const result = liste.addTipoLavoro(tipoLavoro);
    
    if (result.success) {
      // Salva aggiornamento
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
    
    return result;
  } catch (error) {
    console.error('Errore aggiunta tipo lavoro:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rimuove un tipo lavoro (solo custom)
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function removeTipoLavoro(tipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const liste = await getListe();
    
    const result = liste.removeTipoLavoro(tipoLavoro);
    
    if (result.success) {
      // Salva aggiornamento
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
    
    return result;
  } catch (error) {
    console.error('Errore rimozione tipo lavoro:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiunge una nuova coltura (custom)
 * @param {string} coltura - Nome coltura
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function addColtura(coltura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const liste = await getListe();
    
    const result = liste.addColtura(coltura);
    
    if (result.success) {
      // Salva aggiornamento
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
    
    return result;
  } catch (error) {
    console.error('Errore aggiunta coltura:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rimuove una coltura (solo custom)
 * @param {string} coltura - Nome coltura
 * @returns {Promise<Object>} { success: boolean, error: string|null }
 */
export async function removeColtura(coltura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const liste = await getListe();
    
    const result = liste.removeColtura(coltura);
    
    if (result.success) {
      // Salva aggiornamento
      await setDocument(COLLECTION_NAME, DOCUMENT_ID, liste.toFirestore(), tenantId);
    }
    
    return result;
  } catch (error) {
    console.error('Errore rimozione coltura:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica se un tipo lavoro è predefinito
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {boolean} true se è predefinito
 */
export function isPredefinitoTipoLavoro(tipoLavoro) {
  return TIPI_LAVORO_PREDEFINITI.some(
    predefinito => predefinito.toLowerCase() === tipoLavoro.toLowerCase()
  );
}

/**
 * Verifica se una coltura è predefinita
 * @param {string} coltura - Nome coltura
 * @returns {boolean} true se è predefinita
 */
export function isPredefinitaColtura(coltura) {
  return COLTURE_PREDEFINITE.some(
    predefinita => predefinita.toLowerCase() === coltura.toLowerCase()
  );
}

/**
 * Verifica se un tipo lavoro è usato in attività
 * @param {string} tipoLavoro - Nome tipo lavoro
 * @returns {Promise<number>} Numero di attività che usano questo tipo lavoro
 */
export async function getNumeroAttivitaTipoLavoro(tipoLavoro) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['tipoLavoro', '==', tipoLavoro]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso tipo lavoro:', error);
    return 0;
  }
}

/**
 * Verifica se una coltura è usata in attività
 * @param {string} coltura - Nome coltura
 * @returns {Promise<number>} Numero di attività che usano questa coltura
 */
export async function getNumeroAttivitaColtura(coltura) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['coltura', '==', coltura]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso coltura:', error);
    return 0;
  }
}

// Export default
export default {
  getListe,
  addTipoLavoro,
  removeTipoLavoro,
  addColtura,
  removeColtura,
  isPredefinitoTipoLavoro,
  isPredefinitaColtura,
  getNumeroAttivitaTipoLavoro,
  getNumeroAttivitaColtura
};

