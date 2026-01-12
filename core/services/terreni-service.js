/**
 * Terreni Service - Servizio per gestione terreni
 * Gestisce CRUD terreni con supporto multi-tenant
 * 
 * @module core/services/terreni-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from './firebase-service.js';
import { getCurrentTenantId } from './tenant-service.js';
import { Terreno } from '../models/Terreno.js';

const COLLECTION_NAME = 'terreni';

/**
 * Ottieni tutti i terreni del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'nome')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.clienteId - Filtra per cliente (opzionale, per conto terzi)
 * @returns {Promise<Array<Terreno>>} Array di terreni
 */
export async function getAllTerreni(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'nome', 
      orderDirection = 'asc',
      clienteId = null
    } = options;
    
    // Se c'è un filtro clienteId, carica tutti i terreni e filtra lato client
    // per evitare problemi con indice composito Firestore
    const whereFilters = [];
    let useClientSideFilter = false;
    
    if (clienteId !== null) {
      // Filtra lato client per evitare indice composito
      useClientSideFilter = true;
    }
    
    // Carica tutti i terreni (senza filtro clienteId se necessario)
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy: useClientSideFilter ? undefined : orderBy, // Non ordinare se filtriamo lato client
      orderDirection: useClientSideFilter ? undefined : orderDirection,
      where: useClientSideFilter ? undefined : (whereFilters.length > 0 ? whereFilters : undefined)
    });
    
    // Crea oggetti Terreno preservando i dati originali
    let terreni = documents.map(doc => {
      const terreno = Terreno.fromData(doc);
      // Salva dati originali per accesso nel converter
      terreno._originalData = doc;
      return terreno;
    });
    
    // Filtra lato client se necessario
    if (useClientSideFilter && clienteId !== null) {
      terreni = terreni.filter(t => t.clienteId === clienteId);
    }
    
    // Ordina lato client se necessario
    if (useClientSideFilter && orderBy) {
      terreni.sort((a, b) => {
        const aVal = a[orderBy] || '';
        const bVal = b[orderBy] || '';
        const comparison = String(aVal).localeCompare(String(bVal));
        return orderDirection === 'desc' ? -comparison : comparison;
      });
    }
    
    return terreni;
  } catch (error) {
    console.error('Errore recupero terreni:', error);
    throw new Error(`Errore recupero terreni: ${error.message}`);
  }
}

/**
 * Ottieni un terreno per ID
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<Terreno|null>} Terreno o null se non trovato
 */
export async function getTerreno(terrenoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, terrenoId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Terreno.fromData(data);
  } catch (error) {
    console.error('Errore recupero terreno:', error);
    throw new Error(`Errore recupero terreno: ${error.message}`);
  }
}

/**
 * Crea un nuovo terreno
 * @param {Object} terrenoData - Dati terreno
 * @param {string} terrenoData.nome - Nome terreno (obbligatorio)
 * @param {number} terrenoData.superficie - Superficie in ettari (opzionale)
 * @param {Object} terrenoData.coordinate - Coordinate punto centrale {lat, lng} (opzionale)
 * @param {Array} terrenoData.polygonCoords - Coordinate poligono mappa (opzionale)
 * @param {string} terrenoData.note - Note opzionali
 * @returns {Promise<string>} ID terreno creato
 */
export async function createTerreno(terrenoData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const terreno = new Terreno(terrenoData);
    
    // Valida
    const validation = terreno.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const terrenoId = await createDocument(COLLECTION_NAME, terreno.toFirestore(), tenantId);
    
    return terrenoId;
  } catch (error) {
    console.error('Errore creazione terreno:', error);
    throw new Error(`Errore creazione terreno: ${error.message}`);
  }
}

/**
 * Aggiorna un terreno esistente
 * @param {string} terrenoId - ID terreno
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTerreno(terrenoId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    // Carica terreno esistente
    const terrenoEsistente = await getTerreno(terrenoId);
    if (!terrenoEsistente) {
      throw new Error('Terreno non trovato');
    }
    
    // Aggiorna con nuovi dati
    terrenoEsistente.update(updates);
    
    // Valida
    const validation = terrenoEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, terrenoId, terrenoEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento terreno:', error);
    throw new Error(`Errore aggiornamento terreno: ${error.message}`);
  }
}

/**
 * Elimina un terreno
 * @param {string} terrenoId - ID terreno
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se usato in attività (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se terreno è usato in attività e force=false
 */
export async function deleteTerreno(terrenoId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!terrenoId) {
      throw new Error('ID terreno obbligatorio');
    }
    
    // Verifica se terreno è usato in attività
    const numAttivita = await getNumeroAttivitaTerreno(terrenoId);
    
    if (numAttivita > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: il terreno è utilizzato in ${numAttivita} attività. ` +
        `Elimina prima le attività o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, terrenoId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione terreno:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se un terreno è usato in attività
 * @param {string} terrenoId - ID terreno
 * @returns {Promise<number>} Numero di attività che usano questo terreno
 */
export async function getNumeroAttivitaTerreno(terrenoId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getCollectionData } = await import('./firebase-service.js');
    
    const attivita = await getCollectionData('attivita', {
      tenantId,
      where: [['terrenoId', '==', terrenoId]]
    });
    
    return attivita.length;
  } catch (error) {
    console.error('Errore verifica uso terreno:', error);
    return 0;
  }
}

// Export default
export default {
  getAllTerreni,
  getTerreno,
  createTerreno,
  updateTerreno,
  deleteTerreno,
  getNumeroAttivitaTerreno
};

