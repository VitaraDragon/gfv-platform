/**
 * Tariffe Service - Servizio per gestione tariffe (conto terzi)
 * Gestisce CRUD tariffe per calcolo preventivi automatici
 * 
 * @module modules/conto-terzi/services/tariffe-service
 */

import { 
  createDocument, 
  getDocumentData, 
  updateDocument,
  deleteDocument,
  getCollectionData 
} from '../../../core/services/firebase-service.js';
import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
import { Tariffa } from '../models/Tariffa.js';

const COLLECTION_NAME = 'tariffe';

/**
 * Ottieni tutte le tariffe del tenant corrente
 * @param {Object} options - Opzioni di query
 * @param {string} options.orderBy - Campo per ordinamento (default: 'tipoLavoro')
 * @param {string} options.orderDirection - Direzione ordinamento ('asc' | 'desc')
 * @param {boolean} options.soloAttive - Filtra solo tariffe attive (default: false)
 * @param {string} options.tipoLavoro - Filtra per tipo lavoro (opzionale)
 * @param {string} options.coltura - Filtra per coltura (opzionale)
 * @returns {Promise<Array<Tariffa>>} Array di tariffe
 */
export async function getAllTariffe(options = {}) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const { 
      orderBy = 'tipoLavoro', 
      orderDirection = 'asc',
      soloAttive = false,
      tipoLavoro = null,
      coltura = null
    } = options;
    
    // Costruisci filtri where
    const whereFilters = [];
    if (soloAttive) {
      whereFilters.push(['attiva', '==', true]);
    }
    if (tipoLavoro) {
      whereFilters.push(['tipoLavoro', '==', tipoLavoro]);
    }
    if (coltura) {
      whereFilters.push(['coltura', '==', coltura]);
    }
    
    const documents = await getCollectionData(COLLECTION_NAME, {
      tenantId,
      orderBy,
      orderDirection,
      where: whereFilters.length > 0 ? whereFilters : undefined
    });
    
    return documents.map(doc => Tariffa.fromData(doc));
  } catch (error) {
    console.error('Errore recupero tariffe:', error);
    throw new Error(`Errore recupero tariffe: ${error.message}`);
  }
}

/**
 * Ottieni una tariffa per ID
 * @param {string} tariffaId - ID tariffa
 * @returns {Promise<Tariffa|null>} Tariffa o null se non trovata
 */
export async function getTariffa(tariffaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tariffaId) {
      throw new Error('ID tariffa obbligatorio');
    }
    
    const data = await getDocumentData(COLLECTION_NAME, tariffaId, tenantId);
    
    if (!data) {
      return null;
    }
    
    return Tariffa.fromData(data);
  } catch (error) {
    console.error('Errore recupero tariffa:', error);
    throw new Error(`Errore recupero tariffa: ${error.message}`);
  }
}

/**
 * Trova tariffa per tipo lavoro, coltura e tipo campo
 * @param {string} tipoLavoro - Tipo lavoro
 * @param {string} coltura - Coltura
 * @param {string} tipoCampo - Tipo campo
 * @returns {Promise<Tariffa|null>} Tariffa trovata o null
 */
export async function findTariffa(tipoLavoro, coltura, tipoCampo) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const tariffe = await getAllTariffe({
      tipoLavoro,
      coltura,
      soloAttive: true
    });
    
    // Filtra per tipoCampo
    const tariffa = tariffe.find(t => t.tipoCampo === tipoCampo);
    
    return tariffa || null;
  } catch (error) {
    console.error('Errore ricerca tariffa:', error);
    return null;
  }
}

/**
 * Crea una nuova tariffa
 * @param {Object} tariffaData - Dati tariffa
 * @returns {Promise<string>} ID tariffa creata
 */
export async function createTariffa(tariffaData) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    const tariffa = new Tariffa(tariffaData);
    
    // Valida
    const validation = tariffa.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Verifica se esiste già una tariffa con stessa combinazione
    const esistente = await findTariffa(tariffa.tipoLavoro, tariffa.coltura, tariffa.tipoCampo);
    if (esistente) {
      throw new Error('Esiste già una tariffa per questa combinazione (tipo lavoro, coltura, tipo campo)');
    }
    
    // Salva
    const tariffaId = await createDocument(COLLECTION_NAME, tariffa.toFirestore(), tenantId);
    
    return tariffaId;
  } catch (error) {
    console.error('Errore creazione tariffa:', error);
    throw new Error(`Errore creazione tariffa: ${error.message}`);
  }
}

/**
 * Aggiorna una tariffa esistente
 * @param {string} tariffaId - ID tariffa
 * @param {Object} updates - Dati da aggiornare
 * @returns {Promise<void>}
 */
export async function updateTariffa(tariffaId, updates) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tariffaId) {
      throw new Error('ID tariffa obbligatorio');
    }
    
    // Carica tariffa esistente
    const tariffaEsistente = await getTariffa(tariffaId);
    if (!tariffaEsistente) {
      throw new Error('Tariffa non trovata');
    }
    
    // Aggiorna con nuovi dati
    tariffaEsistente.update(updates);
    
    // Valida
    const validation = tariffaEsistente.validate();
    if (!validation.valid) {
      throw new Error(`Validazione fallita: ${validation.errors.join(', ')}`);
    }
    
    // Verifica se esiste già un'altra tariffa con stessa combinazione (se tipoLavoro/coltura/tipoCampo sono cambiati)
    if (updates.tipoLavoro || updates.coltura || updates.tipoCampo) {
      const tipoLavoro = updates.tipoLavoro || tariffaEsistente.tipoLavoro;
      const coltura = updates.coltura || tariffaEsistente.coltura;
      const tipoCampo = updates.tipoCampo || tariffaEsistente.tipoCampo;
      
      const esistente = await findTariffa(tipoLavoro, coltura, tipoCampo);
      if (esistente && esistente.id !== tariffaId) {
        throw new Error('Esiste già un\'altra tariffa per questa combinazione');
      }
    }
    
    // Salva
    await updateDocument(COLLECTION_NAME, tariffaId, tariffaEsistente.toFirestore(), tenantId);
  } catch (error) {
    console.error('Errore aggiornamento tariffa:', error);
    throw new Error(`Errore aggiornamento tariffa: ${error.message}`);
  }
}

/**
 * Elimina una tariffa
 * @param {string} tariffaId - ID tariffa
 * @returns {Promise<void>}
 */
export async function deleteTariffa(tariffaId) {
  try {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      throw new Error('Nessun tenant corrente disponibile');
    }
    
    if (!tariffaId) {
      throw new Error('ID tariffa obbligatorio');
    }
    
    await deleteDocument(COLLECTION_NAME, tariffaId, tenantId);
  } catch (error) {
    console.error('Errore eliminazione tariffa:', error);
    throw new Error(`Errore eliminazione tariffa: ${error.message}`);
  }
}

/**
 * Calcola tariffa per preventivo
 * @param {string} tipoLavoro - Tipo lavoro
 * @param {string} coltura - Coltura
 * @param {string} tipoCampo - Tipo campo
 * @param {number} superficie - Superficie in ettari
 * @returns {Promise<number>} Totale calcolato
 */
export async function calcolaTariffaPreventivo(tipoLavoro, coltura, tipoCampo, superficie) {
  try {
    const tariffa = await findTariffa(tipoLavoro, coltura, tipoCampo);
    
    if (!tariffa) {
      throw new Error(`Tariffa non trovata per: ${tipoLavoro} - ${coltura} - ${tipoCampo}`);
    }
    
    const tariffaFinale = tariffa.calcolaTariffaFinale();
    return tariffaFinale * superficie;
  } catch (error) {
    console.error('Errore calcolo tariffa:', error);
    throw error;
  }
}

// Export default
export default {
  getAllTariffe,
  getTariffa,
  findTariffa,
  createTariffa,
  updateTariffa,
  deleteTariffa,
  calcolaTariffaPreventivo
};




