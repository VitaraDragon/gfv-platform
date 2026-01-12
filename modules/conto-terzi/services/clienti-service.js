/**
 * Clienti Service - Servizio per gestione clienti (conto terzi)
 * Gestisce CRUD clienti con supporto multi-tenant
 * 
 * @module modules/conto-terzi/services/clienti-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Cliente } from '../models/Cliente.js';

const COLLECTION_NAME = 'clienti';

/**
 * Ottieni tutti i clienti del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'ragioneSociale')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {string} options.stato - Filtra per stato (opzionale)
 * @returns {Promise<Array<Cliente>>} Array di clienti
 */
export async function getAllClienti(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'ragioneSociale', 
      orderDirection = 'asc',
      stato = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (stato) {
      whereFilters.push(['stato', '==', stato]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => Cliente.fromData(doc));
  } catch (error) {
    console.error('Errore recupero clienti:', error);
    throw new Error(`Errore recupero clienti: ${error.message}`);
  }
}

/**
 * Ottieni un cliente per ID
 * @param {string} clienteId - ID cliente
 * @returns {Promise<Cliente|null>} Cliente o null se non trovato
 */
export async function getCliente(clienteId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!clienteId) {
      throw new Error('ID cliente obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, clienteId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Cliente.fromData(data);
  } catch (error) {
    console.error('Errore recupero cliente:', error);
    throw new Error(`Errore recupero cliente: ${error.message}`);
  }
}

/**
 * Crea un nuovo cliente
 * @param {Object} clienteData - Dati cliente
 * @param {string} clienteData.ragioneSociale - Ragione sociale (obbligatorio)
 * @param {string} clienteData.partitaIva - Partita IVA (opzionale)
 * @param {string} clienteData.codiceFiscale - Codice fiscale (opzionale)
 * @param {string} clienteData.indirizzo - Indirizzo (opzionale)
 * @param {string} clienteData.citta - Città (opzionale)
 * @param {string} clienteData.cap - CAP (opzionale)
 * @param {string} clienteData.provincia - Provincia (opzionale)
 * @param {string} clienteData.telefono - Telefono (opzionale)
 * @param {string} clienteData.email - Email (opzionale)
 * @param {string} clienteData.note - Note (opzionale)
 * @param {string} clienteData.stato - Stato (default: 'attivo')
 * @returns {Promise<string>} ID cliente creato
 */
export async function createCliente(clienteData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const cliente = new Cliente(clienteData);
    
    // Valida
    const validation = cliente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    const clienteId = await createDocument(COLLECTION_NAME, cliente.toFirestore(), tenantId);
    
    return clienteId;
  } catch (error) {
    console.error('Errore creazione cliente:', error);
    throw new Error(`Errore creazione cliente: ${error.message}`);
  }
}

/**
 * Aggiorna un cliente esistente
 * @param {string} clienteId - ID cliente
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateCliente(clienteId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!clienteId) {
      throw new Error('ID cliente obbligatorio');
    }
    
    // Carica cliente esistente
    const clienteEsistente = await getCliente(clienteId);
    if (!clienteEsistente) {
      throw new Error('Cliente non trovato');
    }
    
    // Aggiorna con nuovi dati
    clienteEsistente.update(updates);
    
    // Valida
    const validation = clienteEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, clienteId, clienteEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento cliente:', error);
    throw new Error(`Errore aggiornamento cliente: ${error.message}`);
  }
}

/**
 * Elimina un cliente
 * @param {string} clienteId - ID cliente
 * @param {Object} options - Opzioni eliminazione
 * @param {boolean} options.force - Se true, elimina anche se ha lavori associati (default: false)
 * @returns {Promise<void>}
 * @throws {Error} Se cliente ha lavori associati e force=false
 */
export async function deleteCliente(clienteId, options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!clienteId) {
      throw new Error('ID cliente obbligatorio');
    }
    
    // Verifica se cliente ha lavori associati
    const numLavori = await getNumeroLavoriCliente(clienteId);
    
    if (numLavori > 0 && !options.force) {
      throw new Error(
        `Impossibile eliminare: il cliente ha ${numLavori} lavoro/i associato/i. ` +
        `Elimina prima i lavori o usa l'opzione force=true per eliminare comunque.`
      );
    }
    
    await deleteDocument(COLLECTION_NAME, clienteId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione cliente:', error);
    throw error; // Rilancia l'errore così la UI può gestirlo
  }
}

/**
 * Verifica se un cliente ha lavori associati
 * @param {string} clienteId - ID cliente
 * @returns {Promise<number>} Numero di lavori associati al cliente
 */
export async function getNumeroLavoriCliente(clienteId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const lavori = await getCollectionData('lavori', {
      tenantId,
      where: [['clienteId', '==', clienteId]]
    });
    
    return lavori.length;
  } catch (error) {
    console.error('Errore verifica lavori cliente:', error);
    return 0;
  }
}

/**
 * Aggiorna statistiche cliente (dataPrimoLavoro, dataUltimoLavoro, totaleLavori)
 * @param {string} clienteId - ID cliente
 * @returns {Promise<void>}
 */
export async function aggiornaStatisticheCliente(clienteId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    // Import dinamico per evitare dipendenze circolari
    const { getAllLavori } = await import('../../../core/services/lavori-service.js');
    
    // Ottieni tutti i lavori del cliente
    const lavori = await getAllLavori({
      // Filtro per clienteId verrà aggiunto quando il service lavori supporterà questo filtro
    });
    
    // Filtra per clienteId (temporaneo, finché lavori-service non supporta il filtro)
    const lavoriCliente = lavori.filter(l => l.clienteId === clienteId);
    
    if (lavoriCliente.length === 0) {
      // Nessun lavoro, resetta statistiche
      await updateCliente(clienteId, {
        dataPrimoLavoro: null,
        dataUltimoLavoro: null,
        totaleLavori: 0
      });
      return;
    }
    
    // Calcola statistiche
    const dateLavori = lavoriCliente
      .map(l => l.dataInizio)
      .filter(d => d instanceof Date)
      .sort((a, b) => a - b);
    
    const dataPrimoLavoro = dateLavori.length > 0 ? dateLavori[0] : null;
    const dataUltimoLavoro = dateLavori.length > 0 ? dateLavori[dateLavori.length - 1] : null;
    const totaleLavori = lavoriCliente.length;
    
    // Aggiorna cliente
    await updateCliente(clienteId, {
      dataPrimoLavoro,
      dataUltimoLavoro,
      totaleLavori
    });
  } catch (error) {
    console.error('Errore aggiornamento statistiche cliente:', error);
    // Non rilanciare errore, è un'operazione secondaria
  }
}

// Export default
export default {
  getAllClienti,
  getCliente,
  createCliente,
  updateCliente,
  deleteCliente,
  getNumeroLavoriCliente,
  aggiornaStatisticheCliente
};











